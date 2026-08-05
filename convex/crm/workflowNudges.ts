import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation, query } from "../_generated/server";
import { isDirectorOrAdmin, notifyRoles, PERMISSIONS, requireStaff } from "./lib";
import { loadMetricTotals } from "./metricAggregates";

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
const NUDGE_STAGES = ["queries", "jobCards", "tickets", "invoices"] as const;
type NudgeStage = (typeof NUDGE_STAGES)[number];
type NudgeRisk = {
  body: string;
  entityId: string;
  entityType: string;
  ruleKey: string;
  title: string;
};

export const WORKFLOW_RULE_CATALOG = [
  {
    key: "confirmed_query_without_job_card",
    label: "Confirmed query without Job Card",
    recipientRole: "Accounts",
    thresholdHours: 0,
  },
  {
    key: "query_without_contracting_owner_after_24h",
    label: "Query without Contracting SPOC after 24h",
    recipientRole: "Contracting Head",
    thresholdHours: 24,
  },
  {
    key: "job_card_without_operations_owner_after_24h",
    label: "Job Card without operations owner after 24h",
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
});

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

async function getEffectiveRule(ctx: any, key: string) {
  const catalog = CATALOG_BY_KEY.get(key);
  if (!catalog) {
    return null;
  }
  const row = await getRuleRow(ctx, key);
  return {
    ...catalog,
    enabled: row?.enabled ?? true,
    lastConfiguredAt: row?.updatedAt ?? null,
    recipientRole: row?.recipientRole ?? catalog.recipientRole,
    thresholdHours: row?.thresholdHours ?? catalog.thresholdHours,
  };
}

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD),
      Promise.all(WORKFLOW_RULE_CATALOG.map((rule) => getEffectiveRule(ctx, rule.key))),
    ]);
    const rules = rows.flatMap((rule) => (rule ? [rule] : []));
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
    const timestamp = Date.now();
    const existing = await getRuleRow(ctx, args.key);
    const patch = {
      enabled: args.enabled,
      recipientRole: (args.recipientRole ?? catalog.recipientRole) as any,
      thresholdHours: args.thresholdHours ?? catalog.thresholdHours,
      updatedAt: timestamp,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
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

async function shouldTrigger(
  ctx: any,
  item: { ruleKey: string; entityType: string; entityId: string },
  quietHours = 24,
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
    await ctx.db.patch(existing._id, { lastTriggeredAt: timestamp });
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
    case "tickets":
      return await ctx.db.query("tickets").order("asc").paginate(paginationOpts);
    case "invoices":
      return await ctx.db.query("invoices").order("asc").paginate(paginationOpts);
  }
}

export async function collectRiskItemsPage(
  ctx: any,
  stage: NudgeStage,
  rows: any[],
  referenceNow: number
): Promise<NudgeRisk[]> {
  const today = new Date(referenceNow).toISOString().slice(0, 10);
  const in14Days = new Date(referenceNow + 14 * 24 * HOUR_MS).toISOString().slice(0, 10);
  const risks: NudgeRisk[] = [];

  if (stage === "queries") {
    for (const queryRow of rows) {
      const hasJobCard = Boolean(
        await ctx.db
          .query("jobCards")
          .withIndex("by_queryId", (q: any) => q.eq("queryId", queryRow._id))
          .first()
      );
      if (queryRow.salesStatus === "Order Confirmed" && !hasJobCard) {
        risks.push({
          body: `${queryRow.queryCode} is confirmed but no Job Card has been opened.`,
          entityId: String(queryRow._id),
          entityType: "query",
          ruleKey: "confirmed_query_without_job_card",
          title: "Confirmed query needs Job Card",
        });
      }
      if (
        !(queryRow.contractingOwnerId || CLOSED_SALES_STATUSES.has(queryRow.salesStatus)) &&
        referenceNow - queryRow.createdAt >= 24 * HOUR_MS
      ) {
        risks.push({
          body: `${queryRow.queryCode} has no Contracting SPOC after 24 hours.`,
          entityId: String(queryRow._id),
          entityType: "query",
          ruleKey: "query_without_contracting_owner_after_24h",
          title: "Query needs Contracting SPOC",
        });
      }
    }
    return risks;
  }

  if (stage === "jobCards") {
    for (const job of rows) {
      if (!job.operationsOwnerId && referenceNow - job.createdAt >= 24 * HOUR_MS) {
        risks.push({
          body: `${job.jobCode} has no operations owner after 24 hours.`,
          entityId: String(job._id),
          entityType: "jobCard",
          ruleKey: "job_card_without_operations_owner_after_24h",
          title: "Job Card needs operations owner",
        });
      }
      if (job.travelStartDate && job.travelStartDate >= today && job.travelStartDate <= in14Days) {
        // A Job Card is the bounded parent for its travellers; the page never
        // collects the entire traveller table.
        const travellers = await ctx.db
          .query("travellers")
          .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", job._id))
          .take(500);
        if (travellers.some((row: any) => !VISA_READY_STATUSES.has(row.visaStatus))) {
          risks.push({
            body: `${job.jobCode} departs within 14 days and visa readiness is incomplete.`,
            entityId: String(job._id),
            entityType: "jobCard",
            ruleKey: "departure_14d_visa_not_ready",
            title: "Visa blockers before departure",
          });
        }
        if (travellers.some((row: any) => row.ticketStatus !== "Issued")) {
          risks.push({
            body: `${job.jobCode} departs within 14 days and tickets are not fully issued.`,
            entityId: String(job._id),
            entityType: "jobCard",
            ruleKey: "departure_14d_ticket_not_ready",
            title: "Ticket blockers before departure",
          });
        }
      }
    }
    return risks;
  }

  if (stage === "tickets") {
    return rows.flatMap((ticket) =>
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

  return rows.flatMap((invoice) =>
    (invoice.balanceAmount ?? 0) > 0 && invoice.dueDate && invoice.dueDate < today
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
  referenceNow: number
) {
  const rules = new Map<string, Awaited<ReturnType<typeof getEffectiveRule>>>();
  const results = await Promise.all(
    risks.map(async (risk) => {
      let rule = rules.get(risk.ruleKey);
      if (rule === undefined) {
        rule = await getEffectiveRule(ctx, risk.ruleKey);
        rules.set(risk.ruleKey, rule);
      }
      if (!(rule?.enabled && (await shouldTrigger(ctx, risk, 24, referenceNow)))) {
        return 0;
      }
      await notifyRoles(ctx, [rule.recipientRole], {
        body: risk.body,
        entityId: risk.entityId,
        entityType: risk.entityType,
        title: risk.title,
      });
      await markTriggered(ctx, risk, referenceNow);
      return 1;
    })
  );
  return results.reduce<number>((total, sent) => total + sent, 0);
}

async function loadOrStartNudgeRun(ctx: any, key: string, referenceNow: number) {
  const existing = await ctx.db
    .query("portalWorkflowNudgeRuns")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .unique();
  if (existing?.status === "running") {
    return existing;
  }
  const payload = {
    checked: 0,
    cursor: null,
    key,
    referenceNow,
    sent: 0,
    stage: "queries" as const,
    startedAt: referenceNow,
    status: "running" as const,
    updatedAt: referenceNow,
  };
  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return { ...existing, ...payload };
  }
  const id = await ctx.db.insert("portalWorkflowNudgeRuns", payload);
  return { _id: id, ...payload };
}

async function runNudgePage(ctx: any, key: string, referenceNow = Date.now()) {
  const run = await loadOrStartNudgeRun(ctx, key, referenceNow);
  if (run.stage === "complete" || run.status === "completed") {
    return { checked: 0, sent: 0 };
  }
  const stage = run.stage as NudgeStage;
  const page = await loadNudgePage(ctx, stage, run.cursor);
  const risks = await collectRiskItemsPage(ctx, stage, page.page, run.referenceNow);
  const sent = await dispatchWorkflowNudges(ctx, risks, run.referenceNow);
  const checked = page.page.length;
  const nextStage = (page.isDone
    ? NUDGE_STAGES[NUDGE_STAGES.indexOf(stage) + 1] ?? "complete"
    : stage) as NudgeStage | "complete";
  const nextCursor = page.isDone ? null : page.continueCursor;
  const status = nextStage === "complete" ? "completed" : "running";
  await ctx.db.patch(run._id, {
    checked: run.checked + checked,
    cursor: nextCursor,
    sent: run.sent + sent,
    stage: nextStage,
    status,
    updatedAt: Date.now(),
  });
  if (status === "running") {
    await ctx.scheduler.runAfter(0, internal.crm.workflowNudges.runScheduledNudges, {
      runKey: key,
    });
  }
  return { checked, sent };
}

export const runScheduledNudges = internalMutation({
  args: { runKey: v.optional(v.string()) },
  handler: async (ctx, args) => await runNudgePage(ctx, args.runKey ?? NUDGE_RUN_KEY),
  returns: nudgeRunResultValidator,
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
