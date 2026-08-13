import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation, query } from "../_generated/server";
import { isDirectorOrAdmin, PERMISSIONS, publishWorkflowNotification, requireStaff } from "./lib";
import { loadMetricTotals } from "./metricAggregates";
import { classifyPassportExpiryUrgency } from "./passportExpiry";

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
const NUDGE_RUN_STALE_MS = 15 * 60 * 1000;
const MAX_NUDGE_RETRIES = 3;
const MAX_WORKFLOW_THRESHOLD_HOURS = 30 * 24;
export const WORKFLOW_NUDGE_REPEAT_HOURS = 24;
const MAX_FAILURE_MESSAGE_LENGTH = 500;
const TRANSIENT_FAILURE_PATTERN =
  /429|connection|fetch|network|rate.?limit|temporar|timeout|unavailable/i;
const NUDGE_STAGES = ["queries", "jobCards", "travellers", "tickets", "invoices"] as const;
type NudgeStage = (typeof NUDGE_STAGES)[number];
type NudgeRunStatus = "completed" | "failed" | "running" | "stale";
interface NudgeRunPageResult {
  checked: number;
  sent: number;
  status: NudgeRunStatus;
}
interface NudgeRisk {
  body: string;
  entityId: string;
  entityType: string;
  ruleKey: string;
  title: string;
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

const nudgeRunResultValidator = v.object({
  checked: v.number(),
  sent: v.number(),
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("stale")
  ),
});

const nudgeRunStateValidator = v.object({
  checked: v.number(),
  consecutiveFailedRuns: v.number(),
  cursor: v.union(v.string(), v.null()),
  effectiveStatus: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("stale")
  ),
  failedAt: v.union(v.number(), v.null()),
  failureCode: v.union(v.string(), v.null()),
  failureKind: v.union(
    v.literal("deterministic"),
    v.literal("stale"),
    v.literal("transient"),
    v.null()
  ),
  failureMessage: v.union(v.string(), v.null()),
  healthStatus: v.union(v.literal("healthy"), v.literal("attention"), v.literal("degraded")),
  key: v.string(),
  lastRetryAt: v.union(v.number(), v.null()),
  previousFailure: v.union(
    v.object({
      code: v.string(),
      failedAt: v.number(),
      kind: v.union(v.literal("deterministic"), v.literal("stale"), v.literal("transient")),
    }),
    v.null()
  ),
  referenceNow: v.number(),
  retryCount: v.number(),
  sent: v.number(),
  stage: v.union(
    v.literal("queries"),
    v.literal("jobCards"),
    v.literal("travellers"),
    v.literal("tickets"),
    v.literal("invoices"),
    v.literal("complete")
  ),
  staleAt: v.union(v.number(), v.null()),
  startedAt: v.number(),
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("stale")
  ),
  updatedAt: v.number(),
});

const nullableNudgeRunStateValidator = v.union(nudgeRunStateValidator, v.null());

function assertCanManageRules(access: Awaited<ReturnType<typeof requireStaff>>) {
  if (!(isDirectorOrAdmin(access) || access.permissions.includes(PERMISSIONS.MANAGE_STAFF))) {
    throw new ConvexError("FORBIDDEN");
  }
}

async function getRuleRow(ctx: any, key: string) {
  return await ctx.db
    .query("portalWorkflowRules")
    .withIndex("by_key", (q: any) => q.eq("key", key))
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

async function loadEffectiveRules(ctx: any) {
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
    const patch = {
      enabled: args.enabled,
      recipientRole: (args.recipientRole ?? catalog.recipientRole) as any,
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
  ctx: any,
  item: { ruleKey: string; entityType: string; entityId: string },
  quietHours = WORKFLOW_NUDGE_REPEAT_HOURS,
  referenceNow = Date.now()
) {
  const existing = await ctx.db
    .query("portalWorkflowRuleRuns")
    .withIndex("by_rule_entity", (q: any) =>
      q.eq("ruleKey", item.ruleKey).eq("entityType", item.entityType).eq("entityId", item.entityId)
    )
    .first();
  return !existing || referenceNow - existing.lastTriggeredAt > quietHours * HOUR_MS;
}

async function markTriggered(
  ctx: any,
  item: { ruleKey: string; entityType: string; entityId: string },
  referenceNow = Date.now()
) {
  const existing = await ctx.db
    .query("portalWorkflowRuleRuns")
    .withIndex("by_rule_entity", (q: any) =>
      q.eq("ruleKey", item.ruleKey).eq("entityType", item.entityType).eq("entityId", item.entityId)
    )
    .first();
  const timestamp = referenceNow;
  if (existing) {
    await ctx.db.patch("portalWorkflowRuleRuns", existing._id, { lastTriggeredAt: timestamp });
    return existing._id;
  }
  return await ctx.db.insert("portalWorkflowRuleRuns", {
    ...item,
    lastTriggeredAt: timestamp,
  });
}

async function loadNudgePage(ctx: any, stage: NudgeStage, cursor: string | null) {
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
  ctx: any,
  rows: any[],
  referenceNow: number,
  rules: EffectiveWorkflowRuleMap
) {
  return (
    await Promise.all(
      rows.map(async (queryRow) => {
        const risks: NudgeRisk[] = [];
        const hasJobCard = Boolean(
          await ctx.db
            .query("jobCards")
            .withIndex("by_queryId", (q: any) => q.eq("queryId", queryRow._id))
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

function collectJobCardRisks(rows: any[], referenceNow: number, rules: EffectiveWorkflowRuleMap) {
  const ownerRule = enabledWorkflowRule(rules, "job_card_without_operations_owner_after_24h");
  if (!ownerRule) {
    return [];
  }
  return rows.flatMap((job) =>
    !job.operationsOwnerId && referenceNow - job.createdAt >= ownerRule.thresholdHours * HOUR_MS
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
  ctx: any,
  rows: any[],
  referenceNow: number,
  rules: EffectiveWorkflowRuleMap
) {
  const today = new Date(referenceNow).toISOString().slice(0, 10);
  const in14Days = new Date(referenceNow + 14 * 24 * HOUR_MS).toISOString().slice(0, 10);
  const risks = (
    await Promise.all(
      rows.map(async (traveller) => {
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
  ctx: any,
  stage: NudgeStage,
  rows: any[],
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
    return rows.flatMap((ticket) =>
      enabledWorkflowRule(effectiveRules, "ticket_attention_status") &&
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
        : []
    );
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
  ctx: any,
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

class WorkflowNudgeDispatchError extends Error {
  cause: unknown;
  original: unknown;
  sent: number;

  constructor(original: unknown, sent: number) {
    super(errorMessage(original));
    this.cause = original;
    this.name = "WorkflowNudgeDispatchError";
    this.original = original;
    this.sent = sent;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown workflow nudge failure";
  }
}

export function classifyNudgeFailure(error: unknown) {
  const original = error instanceof WorkflowNudgeDispatchError ? error.original : error;
  const message = errorMessage(original).slice(0, MAX_FAILURE_MESSAGE_LENGTH);
  const data = original instanceof ConvexError ? original.data : (original as any)?.data;
  let rawCode = "WORKFLOW_NUDGE_FAILURE";
  if (typeof data === "object" && data && "code" in data) {
    rawCode = String((data as { code: unknown }).code);
  } else if (original instanceof Error) {
    rawCode = original.name;
  }
  const code = rawCode.slice(0, 80);
  const transient = TRANSIENT_FAILURE_PATTERN.test(`${code} ${message}`);
  return {
    code,
    kind: transient ? ("transient" as const) : ("deterministic" as const),
    message,
  };
}

async function getNudgeRunRow(ctx: any, key: string) {
  return await ctx.db
    .query("portalWorkflowNudgeRuns")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .unique();
}

export function isNudgeRunStale(run: any, referenceNow = Date.now()) {
  return run?.status === "running" && referenceNow - run.updatedAt >= NUDGE_RUN_STALE_MS;
}

function nudgeHealthStatus(consecutiveFailedRuns: number, effectiveStatus: string) {
  if (consecutiveFailedRuns >= 2) {
    return "degraded" as const;
  }
  if (["failed", "stale"].includes(effectiveStatus)) {
    return "attention" as const;
  }
  return "healthy" as const;
}

export function presentNudgeRun(run: any, referenceNow = Date.now()) {
  if (!run) {
    return null;
  }
  const effectiveStatus = isNudgeRunStale(run, referenceNow) ? "stale" : run.status;
  const consecutiveFailedRuns = run.consecutiveFailedRuns ?? 0;
  const previousFailure =
    run.previousFailureCode && run.previousFailureKind && run.previousFailedAt
      ? {
          code: run.previousFailureCode,
          failedAt: run.previousFailedAt,
          kind: run.previousFailureKind,
        }
      : null;
  return {
    checked: run.checked,
    consecutiveFailedRuns,
    cursor: run.cursor,
    effectiveStatus,
    failedAt: run.failedAt ?? null,
    failureCode: run.failureCode ?? null,
    failureKind: run.failureKind ?? null,
    failureMessage: run.failureMessage ?? null,
    healthStatus: nudgeHealthStatus(consecutiveFailedRuns, effectiveStatus),
    key: run.key,
    lastRetryAt: run.lastRetryAt ?? null,
    previousFailure,
    referenceNow: run.referenceNow,
    retryCount: run.retryCount ?? 0,
    sent: run.sent,
    stage: run.stage,
    staleAt: run.staleAt ?? null,
    startedAt: run.startedAt,
    status: run.status,
    updatedAt: run.updatedAt,
  };
}

async function persistStaleRun(ctx: any, run: any, referenceNow: number) {
  const failureAlreadyCounted = run.failureCountedStartedAt === run.startedAt;
  const patch = {
    consecutiveFailedRuns: (run.consecutiveFailedRuns ?? 0) + (failureAlreadyCounted ? 0 : 1),
    failureCode: "STALE_RUN",
    failureCountedStartedAt: run.startedAt,
    failureKind: "stale" as const,
    failureMessage: "Workflow nudge progress exceeded the active-run timeout.",
    staleAt: referenceNow,
    status: "stale" as const,
    updatedAt: referenceNow,
  };
  await ctx.db.patch("portalWorkflowNudgeRuns", run._id, patch);
  return { ...run, ...patch };
}

export function isScheduledNudgeCadenceEligible(run: any, referenceNow = Date.now()) {
  return (
    run?.key === NUDGE_RUN_KEY &&
    typeof run.startedAt === "number" &&
    referenceNow >= run.startedAt + WORKFLOW_NUDGE_REPEAT_HOURS * HOUR_MS
  );
}

function previousFailureFields(run: any) {
  if (["failed", "stale"].includes(run?.status) && run?.failureCode && run?.failureKind) {
    return {
      previousFailedAt: run.failedAt ?? run.staleAt ?? run.updatedAt,
      previousFailureCode: run.failureCode,
      previousFailureKind: run.failureKind,
    };
  }
  return {
    previousFailedAt: run?.previousFailedAt,
    previousFailureCode: run?.previousFailureCode,
    previousFailureKind: run?.previousFailureKind,
  };
}

async function loadOrStartNudgeRun(
  ctx: any,
  key: string,
  referenceNow: number,
  continuationToken?: number
) {
  let existing = await getNudgeRunRow(ctx, key);
  if (existing?.status === "running") {
    if (isNudgeRunStale(existing, referenceNow)) {
      existing = await persistStaleRun(ctx, existing, referenceNow);
      if (
        continuationToken !== undefined ||
        !isScheduledNudgeCadenceEligible(existing, referenceNow)
      ) {
        return { canProcess: false, run: existing };
      }
    } else {
      return {
        canProcess:
          continuationToken !== undefined &&
          continuationToken === (existing.continuationToken ?? 0),
        run: existing,
      };
    }
  }
  if (existing?.key === NUDGE_RUN_KEY && !isScheduledNudgeCadenceEligible(existing, referenceNow)) {
    return { canProcess: false, run: existing };
  }
  if (existing && existing.key !== NUDGE_RUN_KEY && ["failed", "stale"].includes(existing.status)) {
    return { canProcess: false, run: existing };
  }
  if (continuationToken !== undefined) {
    return { canProcess: false, run: existing ?? null };
  }
  const payload = {
    checked: 0,
    consecutiveFailedRuns: existing?.consecutiveFailedRuns ?? 0,
    continuationToken: (existing?.continuationToken ?? 0) + 1,
    cursor: null,
    failedAt: undefined,
    failureCode: undefined,
    failureKind: undefined,
    failureMessage: undefined,
    key,
    lastRetryAt: undefined,
    ...previousFailureFields(existing),
    referenceNow,
    retryCount: 0,
    sent: 0,
    stage: "queries" as const,
    staleAt: undefined,
    startedAt: referenceNow,
    status: "running" as const,
    updatedAt: referenceNow,
  };
  if (existing) {
    await ctx.db.patch("portalWorkflowNudgeRuns", existing._id, payload);
    return { canProcess: true, run: { ...existing, ...payload } };
  }
  const id = await ctx.db.insert("portalWorkflowNudgeRuns", payload);
  return { canProcess: true, run: { _id: id, ...payload } };
}

async function advanceNudgeRunPage(ctx: any, key: string, referenceNow: number, run: any) {
  const stage = run.stage as NudgeStage;
  const page = await loadNudgePage(ctx, stage, run.cursor);
  const effectiveRules = await loadEffectiveRules(ctx);
  const risks = await collectRiskItemsPage(ctx, stage, page.page, run.referenceNow, effectiveRules);
  const sent = await dispatchWorkflowNudges(ctx, risks, run.referenceNow, effectiveRules);
  const checked = page.page.length;
  try {
    const nextStage = (
      page.isDone ? (NUDGE_STAGES[NUDGE_STAGES.indexOf(stage) + 1] ?? "complete") : stage
    ) as NudgeStage | "complete";
    const nextCursor = page.isDone ? null : page.continueCursor;
    const status: NudgeRunStatus = nextStage === "complete" ? "completed" : "running";
    const nextToken = (run.continuationToken ?? 0) + 1;
    await ctx.db.patch("portalWorkflowNudgeRuns", run._id, {
      checked: run.checked + checked,
      consecutiveFailedRuns: status === "completed" ? 0 : (run.consecutiveFailedRuns ?? 0),
      continuationToken: nextToken,
      cursor: nextCursor,
      failedAt: undefined,
      failureCode: undefined,
      failureKind: undefined,
      failureMessage: undefined,
      sent: run.sent + sent,
      stage: nextStage,
      status,
      updatedAt: referenceNow,
    });
    if (status === "running") {
      await ctx.scheduler.runAfter(0, internal.crm.workflowNudges.runScheduledNudges, {
        continuationToken: nextToken,
        runKey: key,
      });
    }
    return { checked, sent, status };
  } catch (error) {
    const failure = new WorkflowNudgeDispatchError(error, sent);
    throw failure;
  }
}

async function recordNudgeRunFailure(
  ctx: any,
  key: string,
  referenceNow: number,
  run: any,
  error: unknown
): Promise<NudgeRunPageResult> {
  const diagnostic = classifyNudgeFailure(error);
  const sent = error instanceof WorkflowNudgeDispatchError ? error.sent : 0;
  const retryCount = run.retryCount ?? 0;
  const willRetry = diagnostic.kind === "transient" && retryCount < MAX_NUDGE_RETRIES;
  const nextToken = (run.continuationToken ?? 0) + 1;
  await ctx.db.patch("portalWorkflowNudgeRuns", run._id, {
    consecutiveFailedRuns: willRetry
      ? (run.consecutiveFailedRuns ?? 0)
      : (run.consecutiveFailedRuns ?? 0) + (run.failureCountedStartedAt === run.startedAt ? 0 : 1),
    continuationToken: nextToken,
    failedAt: referenceNow,
    failureCode: diagnostic.code,
    failureCountedStartedAt: willRetry ? run.failureCountedStartedAt : run.startedAt,
    failureKind: diagnostic.kind,
    failureMessage: diagnostic.message,
    lastRetryAt: willRetry ? referenceNow : run.lastRetryAt,
    retryCount: willRetry ? retryCount + 1 : retryCount,
    sent: run.sent + sent,
    status: willRetry ? "running" : "failed",
    updatedAt: referenceNow,
  });
  if (willRetry) {
    await ctx.scheduler.runAfter(
      nudgeRetryDelayMs(retryCount),
      internal.crm.workflowNudges.runScheduledNudges,
      { continuationToken: nextToken, runKey: key }
    );
  }
  return {
    checked: 0,
    sent,
    status: willRetry ? ("running" as const) : ("failed" as const),
  };
}

export async function runNudgePage(
  ctx: any,
  key: string,
  referenceNow = Date.now(),
  continuationToken?: number
): Promise<NudgeRunPageResult> {
  const loaded = await loadOrStartNudgeRun(ctx, key, referenceNow, continuationToken);
  const { run } = loaded;
  if (!run) {
    return { checked: 0, sent: 0, status: "completed" as const };
  }
  if (!loaded.canProcess || run.stage === "complete" || run.status === "completed") {
    return { checked: 0, sent: 0, status: run.status as NudgeRunStatus };
  }
  try {
    return await advanceNudgeRunPage(ctx, key, referenceNow, run);
  } catch (error) {
    return await recordNudgeRunFailure(ctx, key, referenceNow, run, error);
  }
}

export function nudgeRetryDelayMs(completedRetries: number) {
  return 60_000 * 2 ** Math.max(0, Math.min(MAX_NUDGE_RETRIES - 1, completedRetries));
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
  args: { runKey: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    assertCanManageRules(access);
    return presentNudgeRun(await getNudgeRunRow(ctx, args.runKey));
  },
  returns: nullableNudgeRunStateValidator,
});

export async function classifyStaleNudgeRunState(
  ctx: any,
  runKey: string,
  referenceNow = Date.now()
) {
  const run = await getNudgeRunRow(ctx, runKey);
  if (!run) {
    return null;
  }
  if (run.status !== "running") {
    return run;
  }
  if (!isNudgeRunStale(run, referenceNow)) {
    throw new ConvexError("NUDGE_RUN_ACTIVE");
  }
  return await persistStaleRun(ctx, run, referenceNow);
}

export const classifyStaleNudgeRun = mutation({
  args: { runKey: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    assertCanManageRules(access);
    return presentNudgeRun(await classifyStaleNudgeRunState(ctx, args.runKey));
  },
  returns: nullableNudgeRunStateValidator,
});

export async function retryNudgeRunState(ctx: any, runKey: string, referenceNow = Date.now()) {
  let run = await getNudgeRunRow(ctx, runKey);
  if (!run) {
    throw new ConvexError("Workflow nudge run not found");
  }
  if (run.status === "running") {
    if (!isNudgeRunStale(run, referenceNow)) {
      return run;
    }
    run = await persistStaleRun(ctx, run, referenceNow);
  }
  if (!["failed", "stale"].includes(run.status)) {
    return run;
  }
  const retryCount = run.retryCount ?? 0;
  if (retryCount >= MAX_NUDGE_RETRIES) {
    throw new ConvexError("NUDGE_RETRY_LIMIT");
  }
  const continuationToken = (run.continuationToken ?? 0) + 1;
  const patch = {
    continuationToken,
    lastRetryAt: referenceNow,
    retryCount: retryCount + 1,
    status: "running" as const,
    updatedAt: referenceNow,
  };
  await ctx.db.patch("portalWorkflowNudgeRuns", run._id, patch);
  await ctx.scheduler.runAfter(0, internal.crm.workflowNudges.runScheduledNudges, {
    continuationToken,
    runKey,
  });
  return { ...run, ...patch };
}

export const retryNudgeRun = mutation({
  args: { runKey: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    assertCanManageRules(access);
    const run = presentNudgeRun(await retryNudgeRunState(ctx, args.runKey));
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
    return await runNudgePage(ctx, key);
  },
  returns: nudgeRunResultValidator,
});
