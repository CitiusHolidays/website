import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { isDirectorOrAdmin, notifyRoles, PERMISSIONS, requireStaff } from "./lib";

const HOUR_MS = 60 * 60 * 1000;
const VISA_READY_STATUSES = new Set(["Approved", "Not Required"]);
const TICKET_ATTENTION_STATUSES = new Set([
  "Name Change Required",
  "Reissue Required",
  "Refund Pending",
]);
const CLOSED_SALES_STATUSES = new Set(["Order Confirmed", "Order Lost"]);

export const WORKFLOW_RULE_CATALOG = [
  {
    key: "confirmed_query_without_job_card",
    label: "Confirmed query without Job Card",
    thresholdHours: 0,
    recipientRole: "Accounts",
  },
  {
    key: "query_without_contracting_owner_after_24h",
    label: "Query without Contracting SPOC after 24h",
    thresholdHours: 24,
    recipientRole: "Contracting Head",
  },
  {
    key: "job_card_without_operations_owner_after_24h",
    label: "Job Card without operations owner after 24h",
    thresholdHours: 24,
    recipientRole: "Operations Head",
  },
  {
    key: "departure_14d_visa_not_ready",
    label: "Departure in 14 days with visa blockers",
    thresholdHours: 0,
    recipientRole: "Operations Head",
  },
  {
    key: "departure_14d_ticket_not_ready",
    label: "Departure in 14 days with ticket blockers",
    thresholdHours: 0,
    recipientRole: "Head of Ticketing",
  },
  {
    key: "passport_expiry_blocks_departure",
    label: "Passport expiry blocks departure",
    thresholdHours: 0,
    recipientRole: "Operations Head",
  },
  {
    key: "ticket_attention_status",
    label: "Ticket status needs attention",
    thresholdHours: 0,
    recipientRole: "Head of Ticketing",
  },
  {
    key: "invoice_overdue_balance",
    label: "Invoice has overdue balance",
    thresholdHours: 0,
    recipientRole: "Finance",
  },
] as const;

const CATALOG_BY_KEY = new Map<string, (typeof WORKFLOW_RULE_CATALOG)[number]>(
  WORKFLOW_RULE_CATALOG.map((rule) => [rule.key, rule]),
);

const workflowRuleValidator = v.object({
  key: v.string(),
  label: v.string(),
  thresholdHours: v.number(),
  recipientRole: v.string(),
  enabled: v.boolean(),
  lastConfiguredAt: v.union(v.number(), v.null()),
});

const listRulesResultValidator = v.object({
  canManage: v.boolean(),
  rules: v.array(workflowRuleValidator),
});

const workflowRuleIdResultValidator = v.object({
  id: v.id("portalWorkflowRules"),
});

const capacityStaffValidator = v.object({
  id: v.id("staffUsers"),
  name: v.string(),
  roles: v.array(v.string()),
  department: v.string(),
});

const capacityOverviewResultValidator = v.object({
  generatedAt: v.string(),
  staff: v.array(capacityStaffValidator),
  counts: v.object({
    activeSalesQueries: v.number(),
    activeJobCards: v.number(),
    ticketAttention: v.number(),
    visaBlockers: v.number(),
    overdueInvoices: v.number(),
  }),
});

const nudgeRunResultValidator = v.object({
  checked: v.number(),
  sent: v.number(),
});

function assertCanManageRules(access: Awaited<ReturnType<typeof requireStaff>>) {
  if (!isDirectorOrAdmin(access) && !access.permissions.includes(PERMISSIONS.MANAGE_STAFF)) {
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
  if (!catalog) return null;
  const row = await getRuleRow(ctx, key);
  return {
    ...catalog,
    enabled: row?.enabled ?? true,
    thresholdHours: row?.thresholdHours ?? catalog.thresholdHours,
    recipientRole: row?.recipientRole ?? catalog.recipientRole,
    lastConfiguredAt: row?.updatedAt ?? null,
  };
}

export const listRules = query({
  args: {},
  returns: listRulesResultValidator,
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
});

export const updateRule = mutation({
  args: {
    key: v.string(),
    enabled: v.boolean(),
    thresholdHours: v.optional(v.number()),
    recipientRole: v.optional(v.string()),
  },
  returns: workflowRuleIdResultValidator,
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
      thresholdHours: args.thresholdHours ?? catalog.thresholdHours,
      recipientRole: (args.recipientRole ?? catalog.recipientRole) as any,
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
});

async function shouldTrigger(
  ctx: any,
  item: { ruleKey: string; entityType: string; entityId: string },
  quietHours = 24,
) {
  const existing = await ctx.db
    .query("portalWorkflowRuleRuns")
    .withIndex("by_rule_entity", (q: any) =>
      q.eq("ruleKey", item.ruleKey).eq("entityType", item.entityType).eq("entityId", item.entityId),
    )
    .first();
  return !existing || Date.now() - existing.lastTriggeredAt > quietHours * HOUR_MS;
}

async function markTriggered(
  ctx: any,
  item: { ruleKey: string; entityType: string; entityId: string },
) {
  const existing = await ctx.db
    .query("portalWorkflowRuleRuns")
    .withIndex("by_rule_entity", (q: any) =>
      q.eq("ruleKey", item.ruleKey).eq("entityType", item.entityType).eq("entityId", item.entityId),
    )
    .first();
  const timestamp = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { lastTriggeredAt: timestamp });
    return existing._id;
  }
  return await ctx.db.insert("portalWorkflowRuleRuns", {
    ...item,
    lastTriggeredAt: timestamp,
  });
}

async function collectRiskItems(ctx: any) {
  const [queries, jobCards, travellers, tickets, invoices] = await Promise.all([
    ctx.db.query("queries").collect(),
    ctx.db.query("jobCards").collect(),
    ctx.db.query("travellers").collect(),
    ctx.db.query("tickets").collect(),
    ctx.db.query("invoices").collect(),
  ]);
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const in14Days = new Date(now + 14 * 24 * HOUR_MS).toISOString().slice(0, 10);
  const jobCardsByQuery = new Set(
    jobCards.flatMap((job: any) => (job.queryId ? [String(job.queryId)] : [])),
  );
  const travellersByJob = new Map<string, any[]>();
  for (const traveller of travellers) {
    const bucket = travellersByJob.get(String(traveller.jobCardId)) ?? [];
    bucket.push(traveller);
    travellersByJob.set(String(traveller.jobCardId), bucket);
  }

  const risks: Array<{
    ruleKey: string;
    entityType: string;
    entityId: string;
    title: string;
    body: string;
  }> = [];
  for (const queryRow of queries) {
    if (queryRow.salesStatus === "Order Confirmed" && !jobCardsByQuery.has(String(queryRow._id))) {
      risks.push({
        ruleKey: "confirmed_query_without_job_card",
        entityType: "query",
        entityId: String(queryRow._id),
        title: "Confirmed query needs Job Card",
        body: `${queryRow.queryCode} is confirmed but no Job Card has been opened.`,
      });
    }
    if (
      !queryRow.contractingOwnerId &&
      !CLOSED_SALES_STATUSES.has(queryRow.salesStatus) &&
      now - queryRow.createdAt >= 24 * HOUR_MS
    ) {
      risks.push({
        ruleKey: "query_without_contracting_owner_after_24h",
        entityType: "query",
        entityId: String(queryRow._id),
        title: "Query needs Contracting SPOC",
        body: `${queryRow.queryCode} has no Contracting SPOC after 24 hours.`,
      });
    }
  }
  for (const job of jobCards) {
    if (!job.operationsOwnerId && now - job.createdAt >= 24 * HOUR_MS) {
      risks.push({
        ruleKey: "job_card_without_operations_owner_after_24h",
        entityType: "jobCard",
        entityId: String(job._id),
        title: "Job Card needs operations owner",
        body: `${job.jobCode} has no operations owner after 24 hours.`,
      });
    }
    if (job.travelStartDate && job.travelStartDate >= today && job.travelStartDate <= in14Days) {
      const jobTravellers = travellersByJob.get(String(job._id)) ?? [];
      if (jobTravellers.some((row) => !VISA_READY_STATUSES.has(row.visaStatus))) {
        risks.push({
          ruleKey: "departure_14d_visa_not_ready",
          entityType: "jobCard",
          entityId: String(job._id),
          title: "Visa blockers before departure",
          body: `${job.jobCode} departs within 14 days and visa readiness is incomplete.`,
        });
      }
      if (jobTravellers.some((row) => row.ticketStatus !== "Issued")) {
        risks.push({
          ruleKey: "departure_14d_ticket_not_ready",
          entityType: "jobCard",
          entityId: String(job._id),
          title: "Ticket blockers before departure",
          body: `${job.jobCode} departs within 14 days and tickets are not fully issued.`,
        });
      }
    }
  }
  for (const ticket of tickets) {
    if (TICKET_ATTENTION_STATUSES.has(ticket.ticketStatus)) {
      risks.push({
        ruleKey: "ticket_attention_status",
        entityType: "ticket",
        entityId: String(ticket._id),
        title: "Ticket needs attention",
        body: `Ticket ${ticket.ticketNumber || ticket._id} is marked ${ticket.ticketStatus}.`,
      });
    }
  }
  for (const invoice of invoices) {
    if ((invoice.balanceAmount ?? 0) > 0 && invoice.dueDate && invoice.dueDate < today) {
      risks.push({
        ruleKey: "invoice_overdue_balance",
        entityType: "invoice",
        entityId: String(invoice._id),
        title: "Invoice has overdue balance",
        body: `${invoice.invoiceNumber} has an overdue balance.`,
      });
    }
  }
  return risks;
}

export const getCapacityOverview = query({
  args: {},
  returns: capacityOverviewResultValidator,
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    const [staff, queries, jobCards, tickets, visas, invoices] = await Promise.all([
      ctx.db.query("staffUsers").collect(),
      ctx.db.query("queries").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("tickets").collect(),
      ctx.db.query("visaRecords").collect(),
      ctx.db.query("invoices").collect(),
    ]);
    const activeStaff = [];
    for (const member of staff) {
      if (!member.active) continue;
      activeStaff.push({
        id: member._id,
        name: member.name,
        roles: member.roles,
        department: member.department ?? "",
      });
    }
    let activeSalesQueries = 0;
    let activeJobCards = 0;
    let ticketAttention = 0;
    let visaBlockers = 0;
    let overdueInvoices = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const queryRow of queries) {
      if (!CLOSED_SALES_STATUSES.has(queryRow.salesStatus)) {
        activeSalesQueries += 1;
      }
    }
    for (const job of jobCards) {
      if (job.status !== "Closed") {
        activeJobCards += 1;
      }
    }
    for (const ticket of tickets) {
      if (TICKET_ATTENTION_STATUSES.has(ticket.ticketStatus)) {
        ticketAttention += 1;
      }
    }
    for (const visa of visas) {
      if (!VISA_READY_STATUSES.has(visa.status)) {
        visaBlockers += 1;
      }
    }
    for (const invoice of invoices) {
      if ((invoice.balanceAmount ?? 0) > 0 && invoice.dueDate && invoice.dueDate < today) {
        overdueInvoices += 1;
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      staff: activeStaff,
      counts: {
        activeSalesQueries,
        activeJobCards,
        ticketAttention,
        visaBlockers,
        overdueInvoices,
      },
    };
  },
});

async function dispatchWorkflowNudges(
  ctx: any,
  risks: Awaited<ReturnType<typeof collectRiskItems>>,
) {
  const results = await Promise.all(
    risks.map(async (risk) => {
      const rule = await getEffectiveRule(ctx, risk.ruleKey);
      if (!rule?.enabled || !(await shouldTrigger(ctx, risk, 24))) {
        return 0;
      }
      await notifyRoles(ctx, [rule.recipientRole], {
        title: risk.title,
        body: risk.body,
        entityType: risk.entityType,
        entityId: risk.entityId,
      });
      await markTriggered(ctx, risk);
      return 1;
    }),
  );
  return results.reduce<number>((total, sent) => total + sent, 0);
}

export const runScheduledNudges = internalMutation({
  args: {},
  returns: nudgeRunResultValidator,
  handler: async (ctx) => {
    const risks = await collectRiskItems(ctx);
    const sent = await dispatchWorkflowNudges(ctx, risks);
    return { checked: risks.length, sent };
  },
});

export const runNudgesNow = mutation({
  args: {},
  returns: nudgeRunResultValidator,
  handler: async (ctx) => {
    const access = await requireStaff(ctx);
    assertCanManageRules(access);
    const risks = await collectRiskItems(ctx);
    const sent = await dispatchWorkflowNudges(ctx, risks);
    return { checked: risks.length, sent };
  },
});
