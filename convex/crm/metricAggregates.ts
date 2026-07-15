import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { isCementQueryType, type PortalDateRange } from "./lib";

export const METRIC_SOURCE_TYPES = [
  "approvalRequests",
  "invoices",
  "jobCards",
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
  v.literal("invoices"),
  v.literal("jobCards"),
  v.literal("proposals"),
  v.literal("queries"),
  v.literal("tickets"),
  v.literal("travellers"),
  v.literal("visaRecords")
);

const RECONCILE_PAGE_SIZE = 20;
const MAX_MONTH_BUCKETS = 600;
const MAX_DAY_BUCKETS = 64;
const READINESS_KEY = "global";
export const METRIC_VERSION = 2;
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
  now = Date.now()
) {
  const complete = Boolean(
    row?.lastCompletedGeneration && row?.lastCompletedMetricVersion === METRIC_VERSION
  );
  const stale = Boolean(
    row &&
      now - Number((complete ? row.lastCompletedAt : row.updatedAt) ?? row.startedAt ?? 0) >=
        METRIC_RECONCILIATION_STALE_MS
  );
  return {
    complete,
    completedSources: row?.completedSourceTypes ?? [],
    errorSummary: null,
    generation: Number(row?.generation ?? 0),
    lastCompletedAt: row?.lastCompletedAt ?? null,
    state: complete
      ? stale
        ? "stale"
        : "ready"
      : stale
        ? "stale"
        : row
          ? "reconciling"
          : "pending",
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
  context: { referenceDate?: string; tourManagerAssigned?: boolean } = {}
): MetricValues {
  const values: MetricValues = {};
  if (sourceType === "queries") {
    const status = String(source.salesStatus ?? "");
    const type = String(source.queryType ?? "Unknown");
    const stage = String(source.leadStage || "Inquiry");
    const budget = Number(source.budgetAmount ?? 0);
    addValue(values, "queries.total", 1);
    addValue(values, `queries.type.${type}.count`, 1);
    addValue(values, `queries.type.${type}.budget`, budget);
    addValue(values, `queries.stage.${stage}.count`, 1);
    addValue(values, `queries.stage.${stage}.budget`, budget);
    if (status === "Order Confirmed") {
      addValue(values, "queries.confirmed", 1);
      addValue(values, `queries.type.${type}.confirmed`, 1);
      addValue(values, `queries.type.${type}.confirmedBudget`, budget);
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
    addValue(values, `tickets.status.${String(source.ticketStatus ?? "Unknown")}`, 1);
    if (source.ticketStatus === "Issued") {
      addValue(values, "tickets.issued", 1);
    }
    if (source.ticketStatus === "Pending Issue") {
      addValue(values, "tickets.pending", 1);
    }
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
    addValue(values, "invoices.expected", Number(source.expectedAmount ?? 0));
    addValue(values, "invoices.received", Number(source.receivedAmount ?? 0));
    addValue(values, "invoices.outstanding", balanceAmount);
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
    await ctx.db.patch(existing._id, { updatedAt: Date.now(), values: nextValues });
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
    ? ((await ctx.db.get(normalized as never)) as Record<string, any> | null)
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
  } else if (["travellers", "tickets", "visaRecords", "invoices"].includes(sourceType)) {
    job = source.jobCardId
      ? ((await ctx.db.get(source.jobCardId)) as Record<string, any> | null)
      : null;
  }
  if (!query && sourceType === "proposals" && source.queryId) {
    query = (await ctx.db.get(source.queryId)) as Record<string, any> | null;
  }
  if (!query && job?.queryId) {
    query = (await ctx.db.get(job.queryId)) as Record<string, any> | null;
  }

  return {
    cement: isCementQueryType(query?.queryType ?? job?.queryType),
    jobCardId: job?._id ? String(job._id) : undefined,
    referenceDate: new Date(Date.now()).toISOString().slice(0, 10),
    tourManagerAssigned: Boolean(job?.tourManagerName || job?.tourManagerId),
  };
}

async function removeProjection(ctx: MutationCtx, projection: Record<string, any>) {
  await applyProjectionDelta(
    ctx,
    { day: projection.day, scopes: projection.scopes, values: projection.values },
    -1
  );
  await ctx.db.delete(projection._id);
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
  if (sourceType === "travellers" && context.jobCardId) {
    scopes.push(`job:${context.jobCardId}`);
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
    await ctx.db.patch(existing._id, payload);
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
    case "invoices":
      return await ctx.db.query("invoices").order("asc").paginate(paginationOpts);
    case "jobCards":
      return await ctx.db.query("jobCards").order("asc").paginate(paginationOpts);
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
});

async function loadMetricReadiness(ctx: MutationCtx) {
  return await ctx.db
    .query("crmMetricReadiness")
    .withIndex("by_key", (q) => q.eq("key", READINESS_KEY))
    .unique();
}

async function startMetricReconciliation(ctx: MutationCtx) {
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
    await ctx.db.patch(current._id, nextState);
  } else {
    await ctx.db.insert("crmMetricReadiness", nextState);
  }
  await Promise.all(
    METRIC_SOURCE_TYPES.map((sourceType) =>
      ctx.scheduler.runAfter(0, (internal as any).crm.metricAggregates.reconcileSourcePage, {
        cursor: null,
        generation,
        metricVersion: METRIC_VERSION,
        sourceType,
      })
    )
  );
  return { alreadyRunning: false, generation, scheduled: METRIC_SOURCE_TYPES.length };
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
  const completedSourceTypes = Array.from(
    new Set([...state.completedSourceTypes, sourceType])
  ).sort();
  const complete = METRIC_SOURCE_TYPES.every((required) => completedSourceTypes.includes(required));
  const now = Date.now();
  await ctx.db.patch(state._id, {
    completedSourceTypes,
    ...(complete ? { lastCompletedAt: now, lastCompletedGeneration: generation } : {}),
    ...(complete ? { lastCompletedMetricVersion: metricVersion } : {}),
    updatedAt: now,
  });
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
});

export const reconcileAll = internalMutation({
  args: {},
  handler: async (ctx) => await startMetricReconciliation(ctx),
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
  dateRange: PortalDateRange | null | undefined
) {
  const [readiness, rows] = await Promise.all([
    ctx.db
      .query("crmMetricReadiness")
      .withIndex("by_key", (q) => q.eq("key", READINESS_KEY))
      .unique(),
    Promise.all(
      buildAggregateSegments(dateRange).map((segment) => loadSegment(ctx, scope, segment))
    ).then((segments) => segments.flat()),
  ]);
  const values: MetricValues = {};
  for (const row of rows) {
    mergeValues(values, row.values ?? {});
  }
  const readinessSummary = summarizeMetricReadiness(readiness);
  return {
    bucketCount: rows.length,
    complete: readinessSummary.complete,
    readiness: readinessSummary,
    updatedAt: rows.reduce((latest, row) => Math.max(latest, row.updatedAt), 0),
    values,
  };
}

export function aggregateMetric(values: MetricValues, key: string, fallback = 0) {
  return values[key] ?? fallback;
}
