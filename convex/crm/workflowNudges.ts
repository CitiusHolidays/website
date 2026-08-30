import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { isRuntimeNumber, isRuntimeString } from "../lib/runtimeValues";
import {
  ALL_ROLES,
  isDirectorOrAdmin,
  PERMISSIONS,
  publishWorkflowNotification,
  requireStaff,
} from "./lib";
import { loadMetricTotals } from "./metricAggregates";
import { classifyPassportExpiryUrgency } from "./passportExpiry";
import { assertReferenceNow } from "./referenceTimePolicy";
import {
  classifyStaleNudgeRunState,
  getNudgeRunRow,
  nudgeRunResultValidator,
  nudgeRunStateValidator,
  nullableNudgeRunStateValidator,
  presentNudgeRun,
  retryNudgeRunState,
  runNudgePage as runNudgeRunPage,
  WORKFLOW_NUDGE_REPEAT_HOURS,
  WorkflowNudgeDispatchError,
  type WorkflowNudgeStage,
} from "./workflowNudgeRun";

const HOUR_MS = 60 * 60 * 1000;
const VISA_READY_STATUSES = new Set(["Approved", "Not Required"]);
const TICKET_ATTENTION_STATUSES = new Set([
  "Name Change Required",
  "Reissue Required",
  "Refund Pending",
]);
const CLOSED_SALES_STATUSES = new Set(["Order Confirmed", "Order Lost"]);
const NUDGE_PAGE_SIZE = 50;
const NUDGE_RUN_KEY = "scheduled";
const MAX_WORKFLOW_THRESHOLD_HOURS = 30 * 24;
interface NudgeRisk {
  body: string;
  entityId: string;
  entityType: string;
  ruleKey: string;
  title: string;
}

export interface NudgeRiskRow {
  _id: string;
  balanceAmount?: number;
  contractingOwnerId?: string;
  createdAt?: number;
  dueDate?: string;
  invoiceNumber?: string;
  jobCardId?: Id<"jobCards">;
  jobCode?: string;
  operationsOwnerId?: string;
  passportExpiryDate?: string;
  queryCode?: string;
  salesStatus?: string;
  ticketNumber?: string;
  ticketStatus?: string;
  visaStatus?: string;
}

interface QueryRiskRow extends NudgeRiskRow {
  _id: Id<"queries">;
  createdAt: number;
  queryCode: string;
  salesStatus: string;
}

interface TravellerRiskRow extends NudgeRiskRow {
  jobCardId: Id<"jobCards">;
  ticketStatus: string;
  visaStatus: string;
}

interface TicketRiskRow extends NudgeRiskRow {
  ticketStatus: string;
}

function isQueryRiskRow(row: NudgeRiskRow): row is QueryRiskRow {
  return (
    isRuntimeNumber(row.createdAt) &&
    isRuntimeString(row.queryCode) &&
    isRuntimeString(row.salesStatus)
  );
}

function isTravellerRiskRow(row: NudgeRiskRow): row is TravellerRiskRow {
  return Boolean(
    row.jobCardId && isRuntimeString(row.ticketStatus) && isRuntimeString(row.visaStatus)
  );
}

function isTicketRiskRow(row: NudgeRiskRow): row is TicketRiskRow {
  return isRuntimeString(row.ticketStatus);
}

export const WORKFLOW_RULE_CATALOG = [
  {
    key: "confirmed_query_without_job_card",
    label: "Confirmed query without Job Card",
    recipientRole: "Accounts",
    thresholdHours: 0,
  },
  {
    key: "query_without_contracting_owner_after_24h",
    label: "Query without Contracting SPOC",
    recipientRole: "Contracting Head",
    thresholdHours: 24,
  },
  {
    key: "job_card_without_operations_owner_after_24h",
    label: "Job Card without operations owner",
    recipientRole: "Operations Head",
    thresholdHours: 24,
  },
  {
    key: "departure_14d_visa_not_ready",
    label: "Departure in 14 days with visa blockers",
    recipientRole: "Operations Head",
    thresholdHours: 0,
  },
  {
    key: "departure_14d_ticket_not_ready",
    label: "Departure in 14 days with ticket blockers",
    recipientRole: "Head of Ticketing",
    thresholdHours: 0,
  },
  {
    key: "passport_expiry_blocks_departure",
    label: "Passport expiry blocks departure",
    recipientRole: "Operations Head",
    thresholdHours: 0,
  },
  {
    key: "ticket_attention_status",
    label: "Ticket status needs attention",
    recipientRole: "Head of Ticketing",
    thresholdHours: 0,
  },
  {
    key: "invoice_overdue_balance",
    label: "Invoice has overdue balance",
    recipientRole: "Finance",
    thresholdHours: 0,
  },
] as const;

const CATALOG_BY_KEY = new Map<string, (typeof WORKFLOW_RULE_CATALOG)[number]>(
  WORKFLOW_RULE_CATALOG.map((rule) => [rule.key, rule])
);

interface EffectiveWorkflowRule {
  enabled: boolean;
  key: string;
  label: string;
  lastConfiguredAt: number | null;
  recipientRole: string;
  thresholdHours: number;
}
type EffectiveWorkflowRuleMap = Map<string, EffectiveWorkflowRule>;

const workflowRuleValidator = v.object({
  enabled: v.boolean(),
  key: v.string(),
  label: v.string(),
  lastConfiguredAt: v.union(v.number(), v.null()),
  recipientRole: v.string(),
  thresholdHours: v.number(),
});

const listRulesResultValidator = v.object({
  canManage: v.boolean(),
  rules: v.array(workflowRuleValidator),
});

const workflowRuleIdResultValidator = v.object({
  id: v.id("portalWorkflowRules"),
});

const capacityStaffValidator = v.object({
  department: v.string(),
  id: v.id("staffUsers"),
  name: v.string(),
  roles: v.array(v.string()),
});

const capacityOverviewResultValidator = v.object({
  counts: v.object({
    activeJobCards: v.number(),
    activeSalesQueries: v.number(),
    overdueInvoices: v.number(),
    ticketAttention: v.number(),
    visaBlockers: v.number(),
  }),
  generatedAt: v.string(),
  staff: v.array(capacityStaffValidator),
});

export function canManageWorkflowRules(access: Awaited<ReturnType<typeof requireStaff>>) {
  return isDirectorOrAdmin(access) || access.permissions.includes(PERMISSIONS.MANAGE_STAFF);
}

function assertCanManageRules(access: Awaited<ReturnType<typeof requireStaff>>) {
  if (!canManageWorkflowRules(access)) {
    throw new ConvexError("FORBIDDEN");
  }
}

async function getRuleRow(ctx: QueryCtx | MutationCtx, key: string) {
  return await ctx.db
    .query("portalWorkflowRules")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
}

export function effectiveWorkflowRulesFromRows(
  rows: Array<{
    enabled?: boolean;
    key: string;
    recipientRole?: string;
    thresholdHours?: number;
    updatedAt?: number;
  }>
): EffectiveWorkflowRuleMap {
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  return new Map(
    WORKFLOW_RULE_CATALOG.map((catalog) => {
      const row = rowsByKey.get(catalog.key);
      return [
        catalog.key,
        {
          ...catalog,
          enabled: row?.enabled ?? true,
          lastConfiguredAt: row?.updatedAt ?? null,
          recipientRole: row?.recipientRole ?? catalog.recipientRole,
          thresholdHours: validateWorkflowThresholdHours(
            row?.thresholdHours ?? catalog.thresholdHours
          ),
        },
      ];
    })
  );
}

async function loadEffectiveRules(ctx: QueryCtx | MutationCtx) {
  const rows = await ctx.db.query("portalWorkflowRules").take(WORKFLOW_RULE_CATALOG.length);
  return effectiveWorkflowRulesFromRows(rows);
}

function getEffectiveRule(rules: EffectiveWorkflowRuleMap, key: string) {
  return rules.get(key) ?? null;
}

export function validateWorkflowThresholdHours(value: number) {
  if (!(Number.isFinite(value) && value >= 0 && value <= MAX_WORKFLOW_THRESHOLD_HOURS)) {
    throw new ConvexError({
      code: "INVALID_WORKFLOW_THRESHOLD",
      message: `Workflow threshold must be between 0 and ${MAX_WORKFLOW_THRESHOLD_HOURS} hours.`,
    });
  }
  return value;
}

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    const [access, rulesByKey] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD),
      loadEffectiveRules(ctx),
    ]);
    const rules = WORKFLOW_RULE_CATALOG.flatMap((catalog) => {
      const rule = rulesByKey.get(catalog.key);
      return rule ? [rule] : [];
    });
    return {
      canManage: isDirectorOrAdmin(access) || access.permissions.includes(PERMISSIONS.MANAGE_STAFF),
      rules,
    };
  },
  returns: listRulesResultValidator,
});

export const updateRule = mutation({
  args: {
    enabled: v.boolean(),
    key: v.string(),
    recipientRole: v.optional(v.string()),
    thresholdHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    assertCanManageRules(access);
    const catalog = CATALOG_BY_KEY.get(args.key);
    if (!catalog) {
      throw new ConvexError("Unknown workflow rule");
    }
    const thresholdHours = validateWorkflowThresholdHours(
      args.thresholdHours ?? catalog.thresholdHours
    );
    const timestamp = Date.now();
    const existing = await getRuleRow(ctx, args.key);
    const requestedRoleValue = args.recipientRole ?? catalog.recipientRole;
    const requestedRole = requestedRoleValue
      ? ALL_ROLES.find((role) => role === requestedRoleValue)
      : undefined;
    if (requestedRoleValue && !requestedRole) {
      throw new ConvexError("Unknown workflow recipient role");
    }
    const patch = {
      enabled: args.enabled,
      recipientRole: requestedRole,
      thresholdHours,
      updatedAt: timestamp,
    };
    if (existing) {
      await ctx.db.patch("portalWorkflowRules", existing._id, patch);
      return { id: existing._id };
    }
    const id = await ctx.db.insert("portalWorkflowRules", {
      key: args.key,
      ...patch,
      createdAt: timestamp,
    });
    return { id };
  },
  returns: workflowRuleIdResultValidator,
});

export async function shouldTrigger(
  ctx: QueryCtx | MutationCtx,
  item: { ruleKey: string; entityType: string; entityId: string },
  quietHours: number,
  referenceNow: number
) {
  const existing = await ctx.db
    .query("portalWorkflowRuleRuns")
    .withIndex("by_rule_entity", (q) =>
      q.eq("ruleKey", item.ruleKey).eq("entityType", item.entityType).eq("entityId", item.entityId)
    )
    .first();
  return !existing || referenceNow - existing.lastTriggeredAt > quietHours * HOUR_MS;
}

async function markTriggered(
  ctx: MutationCtx,
  item: { ruleKey: string; entityType: string; entityId: string },
  referenceNow: number
) {
  const existing = await ctx.db
    .query("portalWorkflowRuleRuns")
    .withIndex("by_rule_entity", (q) =>
      q.eq("ruleKey", item.ruleKey).eq("entityType", item.entityType).eq("entityId", item.entityId)
    )
    .first();
  const timestamp = referenceNow;
  if (existing) {
    await ctx.db.patch("portalWorkflowRuleRuns", existing._id, { lastTriggeredAt: timestamp });
    return existing._id;
  }
  return await ctx.db.insert("portalWorkflowRuleRuns", {
    entityId: item.entityId,
    entityType: item.entityType,
    lastTriggeredAt: timestamp,
    ruleKey: item.ruleKey,
  });
}

async function loadNudgePage(ctx: MutationCtx, stage: WorkflowNudgeStage, cursor: string | null) {
  const paginationOpts = { cursor, numItems: NUDGE_PAGE_SIZE };
  switch (stage) {
    case "queries":
      return await ctx.db.query("queries").order("asc").paginate(paginationOpts);
    case "jobCards":
      return await ctx.db.query("jobCards").order("asc").paginate(paginationOpts);
    case "travellers":
      return await ctx.db.query("travellers").order("asc").paginate(paginationOpts);
    case "tickets":
      return await ctx.db.query("tickets").order("asc").paginate(paginationOpts);
    case "invoices":
      return await ctx.db.query("invoices").order("asc").paginate(paginationOpts);
    default:
      throw new ConvexError("Unknown workflow nudge stage");
  }
}

function enabledWorkflowRule(rules: EffectiveWorkflowRuleMap, key: string) {
  const rule = getEffectiveRule(rules, key);
  return rule?.enabled ? rule : null;
}

function formatThresholdHours(hours: number) {
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

async function collectQueryRisks(
  ctx: MutationCtx,
  rows: NudgeRiskRow[],
  referenceNow: number,
  rules: EffectiveWorkflowRuleMap
) {
  return (
    await Promise.all(
      rows.map(async (row) => {
        if (!isQueryRiskRow(row)) {
          return [];
        }
        const queryRow = row;
        const risks: NudgeRisk[] = [];
        const hasJobCard = Boolean(
          await ctx.db
            .query("jobCards")
            .withIndex("by_queryId", (q) => q.eq("queryId", queryRow._id))
            .first()
        );
        if (
          enabledWorkflowRule(rules, "confirmed_query_without_job_card") &&
          queryRow.salesStatus === "Order Confirmed" &&
          !hasJobCard
        ) {
          risks.push({
            body: `${queryRow.queryCode} is confirmed but no Job Card has been opened.`,
            entityId: String(queryRow._id),
            entityType: "query",
            ruleKey: "confirmed_query_without_job_card",
            title: "Confirmed query needs Job Card",
          });
        }
        const ownerRule = enabledWorkflowRule(rules, "query_without_contracting_owner_after_24h");
        if (
          ownerRule &&
          !(queryRow.contractingOwnerId || CLOSED_SALES_STATUSES.has(queryRow.salesStatus)) &&
          referenceNow - queryRow.createdAt >= ownerRule.thresholdHours * HOUR_MS
        ) {
          risks.push({
            body: `${queryRow.queryCode} has no Contracting SPOC after ${formatThresholdHours(ownerRule.thresholdHours)}.`,
            entityId: String(queryRow._id),
            entityType: "query",
            ruleKey: "query_without_contracting_owner_after_24h",
            title: "Query needs Contracting SPOC",
          });
        }
        return risks;
      })
    )
  ).flat();
}

function collectJobCardRisks(
  rows: NudgeRiskRow[],
  referenceNow: number,
  rules: EffectiveWorkflowRuleMap
) {
  const ownerRule = enabledWorkflowRule(rules, "job_card_without_operations_owner_after_24h");
  if (!ownerRule) {
    return [];
  }
  return rows.flatMap((job) =>
    !job.operationsOwnerId &&
    referenceNow - (job.createdAt ?? 0) >= ownerRule.thresholdHours * HOUR_MS
      ? [
          {
            body: `${job.jobCode} has no operations owner after ${formatThresholdHours(ownerRule.thresholdHours)}.`,
            entityId: String(job._id),
            entityType: "jobCard",
            ruleKey: "job_card_without_operations_owner_after_24h",
            title: "Job Card needs operations owner",
          },
        ]
      : []
  );
}

function dedupeNudgeRisks(risks: NudgeRisk[]) {
  const seen = new Set<string>();
  return risks.filter((risk) => {
    const key = `${risk.ruleKey}:${risk.entityType}:${risk.entityId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function collectTravellerRisks(
  ctx: MutationCtx,
  rows: NudgeRiskRow[],
  referenceNow: number,
  rules: EffectiveWorkflowRuleMap
) {
  const today = new Date(referenceNow).toISOString().slice(0, 10);
  const in14Days = new Date(referenceNow + 14 * 24 * HOUR_MS).toISOString().slice(0, 10);
  const risks = (
    await Promise.all(
      rows.map(async (row) => {
        if (!isTravellerRiskRow(row)) {
          return [];
        }
        const traveller = row;
        const job = await ctx.db.get("jobCards", traveller.jobCardId);
        if (!(job?.travelStartDate && job.travelStartDate >= today)) {
          return [];
        }
        const common = { entityId: String(job._id), entityType: "jobCard" };
        const travellerRisks: NudgeRisk[] = [];
        if (
          enabledWorkflowRule(rules, "departure_14d_visa_not_ready") &&
          job.travelStartDate <= in14Days &&
          !VISA_READY_STATUSES.has(traveller.visaStatus)
        ) {
          travellerRisks.push({
            ...common,
            body: `${job.jobCode} departs within 14 days and visa readiness is incomplete.`,
            ruleKey: "departure_14d_visa_not_ready",
            title: "Visa blockers before departure",
          });
        }
        if (
          enabledWorkflowRule(rules, "departure_14d_ticket_not_ready") &&
          job.travelStartDate <= in14Days &&
          traveller.ticketStatus !== "Issued"
        ) {
          travellerRisks.push({
            ...common,
            body: `${job.jobCode} departs within 14 days and tickets are not fully issued.`,
            ruleKey: "departure_14d_ticket_not_ready",
            title: "Ticket blockers before departure",
          });
        }
        const passportUrgency = classifyPassportExpiryUrgency({
          expiryDate: traveller.passportExpiryDate,
          referenceDate: today,
          travelDate: job.travelStartDate,
        });
        if (
          enabledWorkflowRule(rules, "passport_expiry_blocks_departure") &&
          ["critical", "expired"].includes(passportUrgency)
        ) {
          travellerRisks.push({
            ...common,
            body: `${job.jobCode} has passport validity that blocks departure readiness.`,
            ruleKey: "passport_expiry_blocks_departure",
            title: "Passport validity blocks departure",
          });
        }
        return travellerRisks;
      })
    )
  ).flat();
  return dedupeNudgeRisks(risks);
}

export async function collectRiskItemsPage(
  ctx: MutationCtx,
  stage: WorkflowNudgeStage,
  rows: NudgeRiskRow[],
  referenceNow: number,
  effectiveRules = effectiveWorkflowRulesFromRows([])
): Promise<NudgeRisk[]> {
  if (stage === "queries") {
    return await collectQueryRisks(ctx, rows, referenceNow, effectiveRules);
  }
  if (stage === "jobCards") {
    return collectJobCardRisks(rows, referenceNow, effectiveRules);
  }
  if (stage === "travellers") {
    return await collectTravellerRisks(ctx, rows, referenceNow, effectiveRules);
  }
  if (stage === "tickets") {
    return rows.flatMap((ticket) => {
      if (!isTicketRiskRow(ticket)) {
        return [];
      }
      return enabledWorkflowRule(effectiveRules, "ticket_attention_status") &&
        TICKET_ATTENTION_STATUSES.has(ticket.ticketStatus)
        ? [
            {
              body: `Ticket ${ticket.ticketNumber || ticket._id} is marked ${ticket.ticketStatus}.`,
              entityId: String(ticket._id),
              entityType: "ticket",
              ruleKey: "ticket_attention_status",
              title: "Ticket needs attention",
            },
          ]
        : [];
    });
  }
  const today = new Date(referenceNow).toISOString().slice(0, 10);
  return rows.flatMap((invoice) =>
    enabledWorkflowRule(effectiveRules, "invoice_overdue_balance") &&
    (invoice.balanceAmount ?? 0) > 0 &&
    invoice.dueDate &&
    invoice.dueDate < today
      ? [
          {
            body: `${invoice.invoiceNumber} has an overdue balance.`,
            entityId: String(invoice._id),
            entityType: "invoice",
            ruleKey: "invoice_overdue_balance",
            title: "Invoice has overdue balance",
          },
        ]
      : []
  );
}

export const getCapacityOverview = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    assertCanManageRules(access);
    const [staff, aggregate] = await Promise.all([
      ctx.db
        .query("staffUsers")
        .withIndex("by_active", (q) => q.eq("active", true))
        .take(200),
      loadMetricTotals(ctx, "all", undefined),
    ]);
    const activeStaff = staff.map((member) => ({
      department: member.department ?? "",
      id: member._id,
      name: member.name,
      roles: member.roles,
    }));
    const { values } = aggregate;
    const ticketAttention = Array.from(TICKET_ATTENTION_STATUSES).reduce(
      (total, status) => total + (values[`tickets.status.${status}`] ?? 0),
      0
    );
    return {
      counts: {
        activeJobCards: values["jobCards.open"] ?? 0,
        activeSalesQueries: values["queries.active"] ?? 0,
        overdueInvoices: values["invoices.overdue"] ?? 0,
        ticketAttention,
        visaBlockers: values["visas.blockers"] ?? 0,
      },
      generatedAt: new Date(aggregate.updatedAt || 0).toISOString(),
      staff: activeStaff,
    };
  },
  returns: capacityOverviewResultValidator,
});

async function dispatchWorkflowNudges(
  ctx: MutationCtx,
  risks: NudgeRisk[],
  referenceNow: number,
  rules: EffectiveWorkflowRuleMap
) {
  const results = await Promise.allSettled(
    risks.map(async (risk) => {
      const rule = getEffectiveRule(rules, risk.ruleKey);
      if (
        !(
          rule?.enabled &&
          (await shouldTrigger(ctx, risk, WORKFLOW_NUDGE_REPEAT_HOURS, referenceNow))
        )
      ) {
        return 0;
      }
      const recipientRoles = [rule.recipientRole];
      await publishWorkflowNotification(ctx, {
        bellTargets: { kind: "roles", roles: recipientRoles },
        content: {
          body: risk.body,
          entityId: risk.entityId,
          entityType: risk.entityType,
          title: risk.title,
        },
        emailTargets: { kind: "roles", roles: recipientRoles },
      });
      await markTriggered(ctx, risk, referenceNow);
      return 1;
    })
  );
  let sent = 0;
  let firstFailure: unknown;
  let hasFailure = false;
  for (const result of results) {
    if (result.status === "fulfilled") {
      sent += result.value;
    } else if (!hasFailure) {
      firstFailure = result.reason;
      hasFailure = true;
    }
  }
  if (hasFailure) {
    throw new WorkflowNudgeDispatchError(firstFailure, sent);
  }
  return sent;
}

async function processNudgeStagePage(
  ctx: MutationCtx,
  stage: WorkflowNudgeStage,
  cursor: string | null,
  referenceNow: number
) {
  const page = await loadNudgePage(ctx, stage, cursor);
  const effectiveRules = await loadEffectiveRules(ctx);
  const risks = await collectRiskItemsPage(ctx, stage, page.page, referenceNow, effectiveRules);
  const sent = await dispatchWorkflowNudges(ctx, risks, referenceNow, effectiveRules);
  return {
    checked: page.page.length,
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    sent,
  };
}

export async function runNudgePage(
  ctx: MutationCtx,
  key: string,
  referenceNow: number,
  continuationToken?: number
) {
  return await runNudgeRunPage(ctx, key, processNudgeStagePage, referenceNow, continuationToken);
}

export const runScheduledNudges = internalMutation({
  args: {
    continuationToken: v.optional(v.number()),
    runKey: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await runNudgePage(ctx, args.runKey ?? NUDGE_RUN_KEY, Date.now(), args.continuationToken),
  returns: nudgeRunResultValidator,
});

export const getNudgeRun = query({
  args: { referenceNow: v.number(), runKey: v.string() },
  handler: async (ctx, args) => {
    const referenceNow = assertReferenceNow(args.referenceNow);
    const access = await requireStaff(ctx);
    assertCanManageRules(access);
    return presentNudgeRun(await getNudgeRunRow(ctx, args.runKey), referenceNow);
  },
  returns: nullableNudgeRunStateValidator,
});

export const classifyStaleNudgeRun = mutation({
  args: { runKey: v.string() },
  handler: async (ctx, args) => {
    const referenceNow = Date.now();
    const access = await requireStaff(ctx);
    assertCanManageRules(access);
    return presentNudgeRun(
      await classifyStaleNudgeRunState(ctx, args.runKey, referenceNow),
      referenceNow
    );
  },
  returns: nullableNudgeRunStateValidator,
});

export const retryNudgeRun = mutation({
  args: { runKey: v.string() },
  handler: async (ctx, args) => {
    const referenceNow = Date.now();
    const access = await requireStaff(ctx);
    assertCanManageRules(access);
    const run = presentNudgeRun(
      await retryNudgeRunState(ctx, args.runKey, referenceNow),
      referenceNow
    );
    if (!run) {
      throw new ConvexError("Workflow nudge run not found");
    }
    return run;
  },
  returns: nudgeRunStateValidator,
});

export const runNudgesNow = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx);
    assertCanManageRules(access);
    const key = `manual:${access.authUserId ?? access.email}`;
    return await runNudgePage(ctx, key, Date.now());
  },
  returns: nudgeRunResultValidator,
});
