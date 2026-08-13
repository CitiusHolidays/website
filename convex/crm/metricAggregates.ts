import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { isCementQueryType, type PortalDateRange } from "./lib";
import {
  enqueueMetricContextDirty,
  enqueueMetricSourceDirty,
  scheduleMetricDirtyWorker,
} from "./metricDirty";

export const METRIC_SOURCE_TYPES = [
  "approvalRequests",
  "expenseEntries",
  "invoices",
  "jobCards",
  "pnrs",
  "proposals",
  "queries",
  "tickets",
  "travellers",
  "visaRecords",
] as const;

export type MetricSourceType = (typeof METRIC_SOURCE_TYPES)[number];
export type MetricValues = Record<string, number>;
export type AggregatePeriodType = "day" | "month";

export interface AggregateSegment {
  from?: string;
  periodType: AggregatePeriodType;
  to?: string;
}

const sourceTypeValidator = v.union(
  v.literal("approvalRequests"),
  v.literal("expenseEntries"),
  v.literal("invoices"),
  v.literal("jobCards"),
  v.literal("pnrs"),
  v.literal("proposals"),
  v.literal("queries"),
  v.literal("tickets"),
  v.literal("travellers"),
  v.literal("visaRecords")
);

const RECONCILE_PAGE_SIZE = 20;
const DIRTY_DEPENDENCY_PAGE_SIZE = 20;
const DIRTY_SOURCE_BATCH_SIZE = 10;
const MAX_MONTH_BUCKETS = 600;
const MAX_DAY_BUCKETS = 64;
const READINESS_KEY = "global";
export const METRIC_VERSION = 4;
const METRIC_RECONCILIATION_STALE_MS = 60 * 60 * 1000;

interface MetricReadinessRow {
  completedSourceTypes?: string[];
  generation?: number;
  lastCompletedAt?: number;
  lastCompletedGeneration?: number;
  lastCompletedMetricVersion?: number;
  metricVersion?: number;
  startedAt?: number;
  updatedAt?: number;
}

export function summarizeMetricReadiness(
  row: MetricReadinessRow | null | undefined,
  now = Date.now(),
  oldestDirty?: { updatedAt: number } | null
) {
  const complete = Boolean(
    row?.lastCompletedGeneration && row?.lastCompletedMetricVersion === METRIC_VERSION
  );
  const reconciling = Boolean(row && row.generation !== row.lastCompletedGeneration);
  const stale = Boolean(
    row &&
      !(complete && !reconciling) &&
      now - Number((complete ? row.lastCompletedAt : row.updatedAt) ?? row.startedAt ?? 0) >=
        METRIC_RECONCILIATION_STALE_MS
  );
  return {
    complete,
    completedSources: row?.completedSourceTypes ?? [],
    dirty: {
      hasPending: Boolean(oldestDirty),
      oldestUpdatedAt: oldestDirty ? oldestDirty.updatedAt : null,
    },
    errorSummary: null,
    generation: Number(row?.generation ?? 0),
    lastCompletedAt: row?.lastCompletedAt ?? null,
    state: stale ? "stale" : reconciling ? "reconciling" : complete ? "ready" : "pending",
    version: row?.metricVersion ?? null,
  };
}

function utcDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function monthKey(day: string) {
  return day.slice(0, 7);
}

function monthStart(day: string) {
  return `${monthKey(day)}-01`;
}

function monthEnd(day: string) {
  const [year, month] = monthKey(day).split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

export function buildAggregateSegments(
  dateRange: PortalDateRange | null | undefined
): AggregateSegment[] {
  const from = dateRange?.from || undefined;
  const to = dateRange?.to || undefined;
  if (!(from || to)) {
    return [{ periodType: "month" }];
  }
  if (from && to && monthKey(from) === monthKey(to)) {
    return [{ from, periodType: "day", to }];
  }

  const segments: AggregateSegment[] = [];
  let firstFullMonth = from ? monthKey(from) : undefined;
  let lastFullMonth = to ? monthKey(to) : undefined;

  if (from && from !== monthStart(from)) {
    segments.push({ from, periodType: "day", to: monthEnd(from) });
    firstFullMonth = shiftMonth(monthKey(from), 1);
  }
  if (to && to !== monthEnd(to)) {
    segments.push({ from: monthStart(to), periodType: "day", to });
    lastFullMonth = shiftMonth(monthKey(to), -1);
  }

  if (!(firstFullMonth && lastFullMonth && firstFullMonth > lastFullMonth)) {
    segments.push({ from: firstFullMonth, periodType: "month", to: lastFullMonth });
  }
  return segments;
}

function addValue(values: MetricValues, key: string, amount: number | undefined) {
  if (amount) {
    values[key] = (values[key] ?? 0) + amount;
  }
}

export function buildMetricValues(
  sourceType: MetricSourceType,
  source: Record<string, any>,
  context: {
    jobOpen?: boolean;
    minAdvancePercent?: number;
    referenceDate?: string;
    tourManagerAssigned?: boolean;
  } = {}
): MetricValues {
  const values: MetricValues = {};
  if (sourceType === "queries") {
    const status = String(source.salesStatus ?? "");
    const type = String(source.queryType ?? "Unknown");
    const stage = String(source.leadStage || "Inquiry");
    const budget = Number(source.budgetAmount ?? 0);
    const pax = Math.max(Number(source.paxCount ?? 0), 0);
    const opportunityBudget = budget * (pax > 0 ? pax : 1);
    addValue(values, "queries.total", 1);
    addValue(values, `queries.type.${type}.count`, 1);
    addValue(values, `queries.type.${type}.budget`, opportunityBudget);
    addValue(values, `queries.stage.${stage}.count`, 1);
    addValue(values, `queries.stage.${stage}.budget`, opportunityBudget);
    if (status === "Order Confirmed") {
      addValue(values, "queries.confirmed", 1);
      addValue(values, `queries.type.${type}.confirmed`, 1);
      addValue(values, `queries.type.${type}.confirmedBudget`, opportunityBudget);
    } else if (status === "Order Lost") {
      addValue(values, "queries.lost", 1);
      addValue(values, `queries.type.${type}.lost`, 1);
    } else {
      addValue(values, "queries.active", 1);
      addValue(values, `queries.type.${type}.active`, 1);
    }
  } else if (sourceType === "proposals") {
    if (source.status === "Sent") {
      addValue(values, "proposals.sent", 1);
    }
  } else if (sourceType === "jobCards") {
    addValue(values, "jobCards.total", 1);
    if (source.status !== "Closed") {
      addValue(values, "jobCards.open", 1);
    }
  } else if (sourceType === "travellers") {
    addValue(values, "travellers.total", 1);
    if (source.roomType || source.hotelAllocation) {
      const roomType = String(source.roomType || "Unassigned");
      addValue(values, "travellers.roomingAssignments", 1);
      addValue(values, `travellers.roomType.${roomType}.assignments`, 1);
    }
    if (source.ticketStatus === "Issued") {
      addValue(values, "travellers.ticketIssued", 1);
    }
    if (["Approved", "Not Required"].includes(source.visaStatus)) {
      addValue(values, "travellers.visaApproved", 1);
    }
    if (source.hotelAllocation) {
      addValue(values, "travellers.roomingDone", 1);
    }
    if (source.fullName && source.travelHub && source.foodPreference) {
      addValue(values, "travellers.guestDataDone", 1);
    }
    if (source.passportStatus === "Received") {
      addValue(values, "travellers.passportDone", 1);
    }
    if (context.tourManagerAssigned) {
      addValue(values, "travellers.tourManagerDone", 1);
    }
  } else if (sourceType === "tickets") {
    addValue(values, "tickets.total", 1);
    addValue(values, `tickets.status.${String(source.ticketStatus ?? "Unknown")}`, 1);
    addValue(values, `tickets.type.${String(source.ticketType ?? "Unknown")}`, 1);
    if (source.ticketStatus === "Issued") {
      addValue(values, "tickets.issued", 1);
    }
    if (source.ticketStatus === "Pending Issue") {
      addValue(values, "tickets.pending", 1);
    }
    if (
      ["Name Change Required", "Reissue Required", "Refund Pending"].includes(source.ticketStatus)
    ) {
      addValue(values, "tickets.attention", 1);
    }
  } else if (sourceType === "pnrs") {
    addValue(values, "pnrs.count", 1);
    addValue(values, "pnrs.issuedSeats", Number(source.issuedSeats ?? 0));
    addValue(values, "pnrs.totalSeats", Number(source.totalSeats ?? 0));
  } else if (sourceType === "visaRecords") {
    if (!["Approved", "Not Required"].includes(source.status)) {
      addValue(values, "visas.blockers", 1);
    }
    if (
      ["Not Started", "Checklist Shared", "Documents Pending", "Awaiting"].includes(source.status)
    ) {
      addValue(values, "visas.pending", 1);
    }
  } else if (sourceType === "invoices") {
    const balanceAmount = Math.max(Number(source.balanceAmount ?? 0), 0);
    const expectedAmount = Number(source.expectedAmount ?? 0);
    addValue(values, "invoices.expected", expectedAmount);
    addValue(values, "invoices.received", Number(source.receivedAmount ?? 0));
    addValue(values, "invoices.outstanding", balanceAmount);
    if (context.jobOpen) {
      addValue(
        values,
        "invoices.advancePipeline",
        (expectedAmount * (context.minAdvancePercent ?? 70)) / 100
      );
    }
    if (balanceAmount > 0) {
      addValue(values, "invoices.pending", 1);
    }
    const referenceDate = context.referenceDate ?? new Date(Date.now()).toISOString().slice(0, 10);
    if (
      balanceAmount > 0 &&
      ((source.dueDate && source.dueDate < referenceDate) || source.status === "Overdue")
    ) {
      addValue(values, "invoices.overdue", 1);
    }
  } else if (sourceType === "expenseEntries") {
    const amount = Number(source.amount ?? 0);
    if (source.approvalStatus === "Approved") {
      addValue(values, "expenseEntries.approved", amount);
      if (source.reimbursementStatus === "Pending") {
        addValue(values, "expenseEntries.pendingReimbursement", amount);
      }
    } else if (source.approvalStatus === "Pending") {
      addValue(values, "expenseEntries.pendingApproval", amount);
    }
  } else if (sourceType === "approvalRequests" && source.status === "Pending") {
    addValue(values, "approvals.pending", 1);
  }
  return values;
}

function stableFingerprint(day: string, scopes: string[], values: MetricValues) {
  return JSON.stringify({
    day,
    scopes: [...scopes].sort(),
    values: Object.fromEntries(
      Object.entries(values).sort(([left], [right]) => left.localeCompare(right))
    ),
  });
}

function mergeValues(target: MetricValues, source: MetricValues, multiplier = 1) {
  for (const [key, value] of Object.entries(source)) {
    const next = (target[key] ?? 0) + value * multiplier;
    if (Math.abs(next) < 0.000_001) {
      delete target[key];
    } else {
      target[key] = next;
    }
  }
  return target;
}

async function applyBucketDelta(
  ctx: MutationCtx,
  scope: string,
  periodType: AggregatePeriodType,
  periodKey: string,
  values: MetricValues,
  multiplier: number
) {
  if (Object.keys(values).length === 0) {
    return;
  }
  const existing = await ctx.db
    .query("crmMetricBuckets")
    .withIndex("by_scope_period", (q) =>
      q.eq("scope", scope).eq("periodType", periodType).eq("periodKey", periodKey)
    )
    .unique();
  const nextValues = mergeValues({ ...(existing?.values ?? {}) }, values, multiplier);
  if (existing) {
    await ctx.db.patch("crmMetricBuckets", existing._id, {
      updatedAt: Date.now(),
      values: nextValues,
    });
  } else if (Object.keys(nextValues).length > 0) {
    await ctx.db.insert("crmMetricBuckets", {
      periodKey,
      periodType,
      scope,
      updatedAt: Date.now(),
      values: nextValues,
    });
  }
}

async function applyProjectionDelta(
  ctx: MutationCtx,
  projection: { day: string; scopes: string[]; values: MetricValues },
  multiplier: number
) {
  await Promise.all(
    projection.scopes.flatMap((scope) => [
      applyBucketDelta(ctx, scope, "day", projection.day, projection.values, multiplier),
      applyBucketDelta(
        ctx,
        scope,
        "month",
        monthKey(projection.day),
        projection.values,
        multiplier
      ),
    ])
  );
}

async function loadSourceDocument(
  ctx: QueryCtx | MutationCtx,
  sourceType: MetricSourceType,
  sourceId: string
): Promise<Record<string, any> | null> {
  const normalized = ctx.db.normalizeId(sourceType, sourceId as never);
  return normalized
    ? ((await ctx.db.get(sourceType, normalized as never)) as Record<string, any> | null)
    : null;
}

async function resolveProjectionContext(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  source: Record<string, any>
) {
  let job: Record<string, any> | null = null;
  let query: Record<string, any> | null = sourceType === "queries" ? source : null;

  if (sourceType === "jobCards") {
    job = source;
  } else if (
    ["travellers", "tickets", "pnrs", "visaRecords", "invoices", "expenseEntries"].includes(
      sourceType
    )
  ) {
    job = source.jobCardId
      ? ((await ctx.db.get("jobCards", source.jobCardId)) as Record<string, any> | null)
      : null;
  }
  if (!query && sourceType === "proposals" && source.queryId) {
    query = (await ctx.db.get("queries", source.queryId)) as Record<string, any> | null;
  }
  if (!query && job?.queryId) {
    query = (await ctx.db.get("queries", job.queryId)) as Record<string, any> | null;
  }

  return {
    cement: isCementQueryType(query?.queryType ?? job?.queryType),
    jobCardId: job?._id ? String(job._id) : undefined,
    jobOpen: Boolean(job && job.status !== "Closed"),
    minAdvancePercent: Number(job?.paymentTerms?.minAdvancePercent ?? 70),
    referenceDate: new Date(Date.now()).toISOString().slice(0, 10),
    ticketingOwnerId: job?.ticketingOwnerId ? String(job.ticketingOwnerId) : undefined,
    tourManagerAssigned: Boolean(job?.tourManagerName || job?.tourManagerId),
  };
}

async function removeProjection(ctx: MutationCtx, projection: Record<string, any>) {
  await applyProjectionDelta(
    ctx,
    { day: projection.day, scopes: projection.scopes, values: projection.values },
    -1
  );
  await ctx.db.delete("crmMetricProjections", projection._id);
}

async function syncProjection(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  sourceId: string,
  source: Record<string, any> | null
) {
  const existing = await ctx.db
    .query("crmMetricProjections")
    .withIndex("by_source", (q) => q.eq("sourceType", sourceType).eq("sourceId", sourceId))
    .unique();
  if (!source) {
    if (existing) {
      await removeProjection(ctx, existing);
    }
    return { changed: Boolean(existing), deleted: Boolean(existing) };
  }

  const context = await resolveProjectionContext(ctx, sourceType, source);
  const day = utcDay(Number(source.createdAt ?? source._creationTime));
  const scopes = context.cement ? ["all", "cement"] : ["all"];
  if (
    ["expenseEntries", "invoices", "travellers", "tickets", "pnrs"].includes(sourceType) &&
    context.jobCardId
  ) {
    scopes.push(`job:${context.jobCardId}`);
  }
  if (["tickets", "pnrs"].includes(sourceType) && context.ticketingOwnerId) {
    scopes.push(`ticketing:${context.ticketingOwnerId}`);
    if (context.cement) {
      scopes.push(`ticketing-cement:${context.ticketingOwnerId}`);
    }
  }
  const values = buildMetricValues(sourceType, source, context);
  const fingerprint = stableFingerprint(day, scopes, values);
  if (existing?.fingerprint === fingerprint) {
    return { changed: false, deleted: false };
  }
  if (existing) {
    await applyProjectionDelta(
      ctx,
      { day: existing.day, scopes: existing.scopes, values: existing.values },
      -1
    );
  }
  await applyProjectionDelta(ctx, { day, scopes, values }, 1);
  const payload = {
    day,
    fingerprint,
    scopes,
    sourceId,
    sourceType,
    updatedAt: Date.now(),
    values,
  };
  if (existing) {
    await ctx.db.patch("crmMetricProjections", existing._id, payload);
  } else {
    await ctx.db.insert("crmMetricProjections", payload);
  }
  return { changed: true, deleted: false };
}

async function loadSourcePage(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  cursor: string | null
) {
  const paginationOpts = { cursor, numItems: RECONCILE_PAGE_SIZE };
  switch (sourceType) {
    case "approvalRequests":
      return await ctx.db.query("approvalRequests").order("asc").paginate(paginationOpts);
    case "expenseEntries":
      return await ctx.db.query("expenseEntries").order("asc").paginate(paginationOpts);
    case "invoices":
      return await ctx.db.query("invoices").order("asc").paginate(paginationOpts);
    case "jobCards":
      return await ctx.db.query("jobCards").order("asc").paginate(paginationOpts);
    case "pnrs":
      return await ctx.db.query("pnrs").order("asc").paginate(paginationOpts);
    case "proposals":
      return await ctx.db.query("proposals").order("asc").paginate(paginationOpts);
    case "queries":
      return await ctx.db.query("queries").order("asc").paginate(paginationOpts);
    case "tickets":
      return await ctx.db.query("tickets").order("asc").paginate(paginationOpts);
    case "travellers":
      return await ctx.db.query("travellers").order("asc").paginate(paginationOpts);
    case "visaRecords":
      return await ctx.db.query("visaRecords").order("asc").paginate(paginationOpts);
  }
}

export const syncEntity = internalMutation({
  args: { sourceId: v.string(), sourceType: sourceTypeValidator },
  handler: async (ctx, args) => {
    const source = await loadSourceDocument(ctx, args.sourceType, args.sourceId);
    return await syncProjection(ctx, args.sourceType, args.sourceId, source);
  },
  returns: v.object({ changed: v.boolean(), deleted: v.boolean() }),
});

const JOB_CONTEXT_STAGES = [
  "expenseEntries",
  "invoices",
  "pnrs",
  "tickets",
  "travellers",
  "visaRecords",
] as const;
const QUERY_CONTEXT_STAGES = ["jobCards", "proposals"] as const;
type MetricDependencyStage =
  | (typeof JOB_CONTEXT_STAGES)[number]
  | (typeof QUERY_CONTEXT_STAGES)[number];

function dependencyStages(kind: "jobContext" | "queryContext"): readonly MetricDependencyStage[] {
  return kind === "jobContext" ? JOB_CONTEXT_STAGES : QUERY_CONTEXT_STAGES;
}

async function loadDependencyPage(
  ctx: MutationCtx,
  kind: "jobContext" | "queryContext",
  sourceId: string,
  stage: MetricDependencyStage,
  cursor: string | null
) {
  const parentTable = kind === "jobContext" ? "jobCards" : "queries";
  const parentId = ctx.db.normalizeId(parentTable, sourceId as never);
  if (!parentId) {
    return null;
  }
  const paginationOpts = { cursor, numItems: DIRTY_DEPENDENCY_PAGE_SIZE };
  switch (stage) {
    case "expenseEntries":
      return await ctx.db
        .query("expenseEntries")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", parentId as never))
        .paginate(paginationOpts);
    case "invoices":
      return await ctx.db
        .query("invoices")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", parentId as never))
        .paginate(paginationOpts);
    case "jobCards":
      return await ctx.db
        .query("jobCards")
        .withIndex("by_queryId", (q) => q.eq("queryId", parentId as never))
        .paginate(paginationOpts);
    case "pnrs":
      return await ctx.db
        .query("pnrs")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", parentId as never))
        .paginate(paginationOpts);
    case "proposals":
      return await ctx.db
        .query("proposals")
        .withIndex("by_queryId", (q) => q.eq("queryId", parentId as never))
        .paginate(paginationOpts);
    case "tickets":
      return await ctx.db
        .query("tickets")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", parentId as never))
        .paginate(paginationOpts);
    case "travellers":
      return await ctx.db
        .query("travellers")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", parentId as never))
        .paginate(paginationOpts);
    case "visaRecords":
      return await ctx.db
        .query("visaRecords")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", parentId as never))
        .paginate(paginationOpts);
  }
}

async function processMetricDependencyDirty(ctx: MutationCtx, dirty: any) {
  const stages = dependencyStages(dirty.kind);
  const stageIndex = Math.max(0, stages.indexOf(dirty.stage));
  const stage = stages[stageIndex] as MetricDependencyStage;
  const page = await loadDependencyPage(
    ctx,
    dirty.kind,
    dirty.sourceId,
    stage,
    dirty.cursor ?? null
  );
  if (!page) {
    await ctx.db.delete("crmMetricDirty", dirty._id);
    return 0;
  }
  let changed = 0;
  for (const source of page.page) {
    const result = await syncProjection(ctx, stage, String(source._id), source);
    changed += result.changed ? 1 : 0;
    if (dirty.kind === "queryContext" && stage === "jobCards") {
      await enqueueMetricContextDirty(ctx, "jobContext", String(source._id));
    }
  }
  if (!page.isDone) {
    await ctx.db.patch("crmMetricDirty", dirty._id, {
      cursor: page.continueCursor,
      stage,
      updatedAt: Date.now(),
    });
    return changed;
  }
  const nextStage = stages[stageIndex + 1];
  if (nextStage) {
    await ctx.db.patch("crmMetricDirty", dirty._id, {
      cursor: undefined,
      stage: nextStage,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.delete("crmMetricDirty", dirty._id);
  }
  return changed;
}

export const processDirtyUnit = internalMutation({
  args: {},
  handler: async (ctx) => {
    let changed = 0;
    let processed = 0;
    while (processed < DIRTY_SOURCE_BATCH_SIZE) {
      const dirty = await ctx.db.query("crmMetricDirty").withIndex("by_updatedAt").first();
      if (!dirty) {
        break;
      }
      if (dirty.kind === "source") {
        if (dirty.sourceType) {
          const source = await loadSourceDocument(ctx, dirty.sourceType, dirty.sourceId);
          const result = await syncProjection(ctx, dirty.sourceType, dirty.sourceId, source);
          changed += result.changed ? 1 : 0;
        }
        await ctx.db.delete("crmMetricDirty", dirty._id);
        processed += 1;
      } else {
        changed += await processMetricDependencyDirty(ctx, dirty);
        processed += 1;
        break;
      }
    }
    const next = await ctx.db.query("crmMetricDirty").withIndex("by_updatedAt").first();
    if (next) {
      await scheduleMetricDirtyWorker(ctx);
    }
    return { changed, processed, scheduled: Boolean(next) };
  },
  returns: v.object({ changed: v.number(), processed: v.number(), scheduled: v.boolean() }),
});

export const enqueueDirtySources = internalMutation({
  args: { sourceIds: v.array(v.string()), sourceType: sourceTypeValidator },
  handler: async (ctx, args) => {
    if (args.sourceIds.length > 50) {
      throw new Error("Metric dirty batches are limited to 50 sources");
    }
    const queueWasEmpty = !(await ctx.db.query("crmMetricDirty").withIndex("by_updatedAt").first());
    const sourceIds = new Set(args.sourceIds);
    for (const sourceId of sourceIds) {
      await enqueueMetricSourceDirty(ctx, args.sourceType, sourceId);
      if (args.sourceType === "jobCards") {
        await enqueueMetricContextDirty(ctx, "jobContext", sourceId);
      } else if (args.sourceType === "queries") {
        await enqueueMetricContextDirty(ctx, "queryContext", sourceId);
      }
    }
    const scheduled = queueWasEmpty && sourceIds.size > 0;
    if (scheduled) {
      await scheduleMetricDirtyWorker(ctx);
    }
    return { enqueued: sourceIds.size, scheduled };
  },
  returns: v.object({ enqueued: v.number(), scheduled: v.boolean() }),
});

export const syncJobInvoicePage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    jobCardId: v.id("jobCards"),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("invoices")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", args.jobCardId))
      .paginate({ cursor: args.cursor, numItems: RECONCILE_PAGE_SIZE });
    let changed = 0;
    for (const invoice of page.page) {
      const result = await syncProjection(ctx, "invoices", String(invoice._id), invoice);
      changed += result.changed ? 1 : 0;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, (internal as any).crm.metricAggregates.syncJobInvoicePage, {
        cursor: page.continueCursor,
        jobCardId: args.jobCardId,
      });
    }
    return { changed, isDone: page.isDone, processed: page.page.length };
  },
  returns: v.object({ changed: v.number(), isDone: v.boolean(), processed: v.number() }),
});

async function loadMetricReadiness(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("crmMetricReadiness")
    .withIndex("by_key", (q) => q.eq("key", READINESS_KEY))
    .unique();
}

async function loadMetricPublication(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("crmMetricPublications")
    .withIndex("by_key", (q) => q.eq("key", READINESS_KEY))
    .unique();
}

async function startMetricReconciliation(ctx: MutationCtx, force = false) {
  const now = Date.now();
  const current = await loadMetricReadiness(ctx);
  const reconciliationActive = Boolean(
    current &&
      current.metricVersion === METRIC_VERSION &&
      current.generation !== current.lastCompletedGeneration &&
      now - current.updatedAt < 60 * 60 * 1000
  );
  if (reconciliationActive) {
    return { alreadyRunning: true, generation: current?.generation ?? 0, scheduled: 0 };
  }
  const currentComplete = Boolean(
    current?.lastCompletedGeneration && current.lastCompletedMetricVersion === METRIC_VERSION
  );
  if (currentComplete && !force) {
    return { alreadyRunning: false, generation: current?.generation ?? 0, scheduled: 0 };
  }
  const generation = (current?.generation ?? 0) + 1;
  const nextState = {
    completedSourceTypes: [],
    generation,
    key: READINESS_KEY,
    metricVersion: METRIC_VERSION,
    startedAt: now,
    updatedAt: now,
  };
  if (current) {
    await ctx.db.patch("crmMetricReadiness", current._id, nextState);
  } else {
    await ctx.db.insert("crmMetricReadiness", nextState);
  }
  await ctx.scheduler.runAfter(0, (internal as any).crm.metricAggregates.reconcileSourcePage, {
    cursor: null,
    generation,
    metricVersion: METRIC_VERSION,
    sourceType: METRIC_SOURCE_TYPES[0],
  });
  return { alreadyRunning: false, generation, scheduled: 1 };
}

async function isRegisteredMetricGeneration(
  ctx: MutationCtx,
  generation: number,
  metricVersion: number
) {
  const state = await loadMetricReadiness(ctx);
  return Boolean(
    state &&
      state.generation === generation &&
      state.generation !== state.lastCompletedGeneration &&
      state.metricVersion === metricVersion &&
      metricVersion === METRIC_VERSION
  );
}

export const reconcileSourcePage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    generation: v.number(),
    metricVersion: v.optional(v.number()),
    sourceType: sourceTypeValidator,
  },
  handler: async (ctx, args) => {
    if (
      args.metricVersion !== METRIC_VERSION ||
      !(await isRegisteredMetricGeneration(ctx, args.generation, args.metricVersion))
    ) {
      const restart = await startMetricReconciliation(ctx);
      return {
        changed: 0,
        isDone: false,
        processed: 0,
        restarted: !restart.alreadyRunning,
        stale: true,
      };
    }
    const page = await loadSourcePage(ctx, args.sourceType, args.cursor);
    let changed = 0;
    for (const source of page.page) {
      const result = await syncProjection(ctx, args.sourceType, String(source._id), source);
      changed += result.changed ? 1 : 0;
    }
    if (page.isDone) {
      await ctx.scheduler.runAfter(0, (internal as any).crm.metricAggregates.sweepProjectionPage, {
        cursor: null,
        generation: args.generation,
        metricVersion: args.metricVersion,
        sourceType: args.sourceType,
      });
    } else {
      await ctx.scheduler.runAfter(0, (internal as any).crm.metricAggregates.reconcileSourcePage, {
        cursor: page.continueCursor,
        generation: args.generation,
        metricVersion: args.metricVersion,
        sourceType: args.sourceType,
      });
    }
    return { changed, isDone: page.isDone, processed: page.page.length };
  },
  returns: v.object({
    changed: v.number(),
    isDone: v.boolean(),
    processed: v.number(),
    restarted: v.optional(v.boolean()),
    stale: v.optional(v.boolean()),
  }),
});

async function markReconciliationSourceComplete(
  ctx: MutationCtx,
  generation: number,
  metricVersion: number,
  sourceType: MetricSourceType
) {
  const state = await loadMetricReadiness(ctx);
  if (
    !state ||
    state.generation !== generation ||
    state.metricVersion !== metricVersion ||
    metricVersion !== METRIC_VERSION
  ) {
    return { complete: false, stale: true };
  }
  const existing = await ctx.db
    .query("crmMetricReadinessSourceCompletions")
    .withIndex("by_generation_source", (q) =>
      q.eq("generation", generation).eq("sourceType", sourceType)
    )
    .unique();
  if (!existing) {
    await ctx.db.insert("crmMetricReadinessSourceCompletions", {
      completedAt: Date.now(),
      generation,
      metricVersion,
      sourceType,
    });
  }
  const completions = await ctx.db
    .query("crmMetricReadinessSourceCompletions")
    .withIndex("by_generation", (q) => q.eq("generation", generation))
    .collect();
  const completedSourceTypes = completions.map((row) => row.sourceType).sort();
  const complete = METRIC_SOURCE_TYPES.every((required) => completedSourceTypes.includes(required));
  if (complete) {
    const now = Date.now();
    const publication = await loadMetricPublication(ctx);
    if (!publication) {
      await ctx.db.insert("crmMetricPublications", {
        generation,
        key: READINESS_KEY,
        metricVersion,
        publishedAt: now,
      });
    } else if (publication.metricVersion !== metricVersion) {
      await ctx.db.patch("crmMetricPublications", publication._id, {
        generation,
        metricVersion,
        publishedAt: now,
      });
    }
    await ctx.db.patch("crmMetricReadiness", state._id, {
      completedSourceTypes,
      lastCompletedAt: now,
      lastCompletedGeneration: generation,
      lastCompletedMetricVersion: metricVersion,
      updatedAt: now,
    });
  } else {
    await ctx.db.patch("crmMetricReadiness", state._id, {
      completedSourceTypes,
      updatedAt: Date.now(),
    });
    const nextSourceType = METRIC_SOURCE_TYPES.find(
      (candidate) => !completedSourceTypes.includes(candidate)
    );
    if (nextSourceType) {
      await ctx.scheduler.runAfter(0, (internal as any).crm.metricAggregates.reconcileSourcePage, {
        cursor: null,
        generation,
        metricVersion,
        sourceType: nextSourceType,
      });
    }
  }
  return { complete, stale: false };
}

export const sweepProjectionPage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    generation: v.number(),
    metricVersion: v.optional(v.number()),
    sourceType: sourceTypeValidator,
  },
  handler: async (ctx, args) => {
    if (
      args.metricVersion !== METRIC_VERSION ||
      !(await isRegisteredMetricGeneration(ctx, args.generation, args.metricVersion))
    ) {
      const restart = await startMetricReconciliation(ctx);
      return {
        deleted: 0,
        isDone: false,
        processed: 0,
        restarted: !restart.alreadyRunning,
        stale: true,
      };
    }
    const page = await ctx.db
      .query("crmMetricProjections")
      .withIndex("by_sourceType", (q) => q.eq("sourceType", args.sourceType))
      .paginate({ cursor: args.cursor, numItems: RECONCILE_PAGE_SIZE });
    let deleted = 0;
    for (const projection of page.page) {
      const source = await loadSourceDocument(ctx, args.sourceType, projection.sourceId);
      if (!source) {
        await removeProjection(ctx, projection);
        deleted += 1;
      }
    }
    if (page.isDone) {
      await markReconciliationSourceComplete(
        ctx,
        args.generation,
        args.metricVersion,
        args.sourceType
      );
    } else {
      await ctx.scheduler.runAfter(0, (internal as any).crm.metricAggregates.sweepProjectionPage, {
        cursor: page.continueCursor,
        generation: args.generation,
        metricVersion: args.metricVersion,
        sourceType: args.sourceType,
      });
    }
    return { deleted, isDone: page.isDone, processed: page.page.length };
  },
  returns: v.object({
    deleted: v.number(),
    isDone: v.boolean(),
    processed: v.number(),
    restarted: v.optional(v.boolean()),
    stale: v.optional(v.boolean()),
  }),
});

export const reconcileAll = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dirty = await ctx.db.query("crmMetricDirty").withIndex("by_updatedAt").first();
    const reconciliation = await startMetricReconciliation(ctx, args.force === true);
    if (dirty) {
      await scheduleMetricDirtyWorker(ctx);
    }
    return {
      ...reconciliation,
      scheduled: reconciliation.scheduled + Number(Boolean(dirty)),
    };
  },
  returns: v.object({ alreadyRunning: v.boolean(), generation: v.number(), scheduled: v.number() }),
});

async function loadSegment(ctx: QueryCtx, scope: string, segment: AggregateSegment) {
  const limit = segment.periodType === "day" ? MAX_DAY_BUCKETS : MAX_MONTH_BUCKETS;
  const rows = await ctx.db
    .query("crmMetricBuckets")
    .withIndex("by_scope_period", (q) => {
      const range = q.eq("scope", scope).eq("periodType", segment.periodType);
      if (segment.from && segment.to) {
        return range.gte("periodKey", segment.from).lte("periodKey", segment.to);
      }
      if (segment.from) {
        return range.gte("periodKey", segment.from);
      }
      if (segment.to) {
        return range.lte("periodKey", segment.to);
      }
      return range;
    })
    .take(limit + 1);
  if (rows.length > limit) {
    throw new ConvexError("Aggregate date range exceeds the bounded reporting window");
  }
  return rows;
}

export async function loadMetricTotals(
  ctx: QueryCtx,
  scope: string,
  dateRange: PortalDateRange | null | undefined,
  referenceNow?: number
) {
  const [publication, oldestDirty, rows] = await Promise.all([
    loadMetricPublication(ctx),
    ctx.db.query("crmMetricDirty").withIndex("by_updatedAt").first(),
    Promise.all(
      buildAggregateSegments(dateRange).map((segment) => loadSegment(ctx, scope, segment))
    ).then((segments) => segments.flat()),
  ]);
  const values: MetricValues = {};
  for (const row of rows) {
    mergeValues(values, row.values ?? {});
  }
  const stableReadiness = publication
    ? {
        completedSourceTypes: [...METRIC_SOURCE_TYPES],
        generation: publication.generation,
        lastCompletedAt: publication.publishedAt,
        lastCompletedGeneration: publication.generation,
        lastCompletedMetricVersion: publication.metricVersion,
        metricVersion: publication.metricVersion,
        startedAt: publication.publishedAt,
        updatedAt: publication.publishedAt,
      }
    : null;
  const readinessSummary = summarizeMetricReadiness(stableReadiness, referenceNow, oldestDirty);
  return {
    bucketCount: rows.length,
    complete: readinessSummary.complete,
    readiness: readinessSummary,
    updatedAt: rows.reduce((latest, row) => Math.max(latest, row.updatedAt), 0),
    values,
  };
}

export async function loadMetricCoverage(
  ctx: QueryCtx,
  scope: string,
  dateRange: PortalDateRange | null | undefined,
  referenceNow?: number
) {
  const [totals, readiness] = await Promise.all([
    loadMetricTotals(ctx, scope, dateRange, referenceNow),
    loadMetricReadiness(ctx),
  ]);
  return {
    ...totals,
    readiness: summarizeMetricReadiness(
      readiness,
      referenceNow,
      totals.readiness.dirty.hasPending && totals.readiness.dirty.oldestUpdatedAt
        ? { updatedAt: totals.readiness.dirty.oldestUpdatedAt }
        : null
    ),
  };
}

export function aggregateMetric(values: MetricValues, key: string, fallback = 0) {
  return values[key] ?? fallback;
}
