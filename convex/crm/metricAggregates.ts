import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import type { PortalDateRange } from "./lib";
import {
  enqueueDirtySourcesHandler,
  processDirtyUnitHandler,
  scheduleMetricDirtyWorker,
} from "./metricDirty";
import {
  loadSourceDocument,
  mergeValues,
  monthKey,
  removeProjection,
  syncProjection,
} from "./metricProjection";
import {
  type AggregatePeriodType,
  METRIC_SOURCE_TYPES,
  type MetricSourceType,
  type MetricValues,
  metricSourceTypeValidator,
} from "./metricTypes";

export interface AggregateSegment {
  from?: string;
  periodType: AggregatePeriodType;
  to?: string;
}

const RECONCILE_PAGE_SIZE = 20;
const MAX_MONTH_BUCKETS = 600;
const MAX_DAY_BUCKETS = 64;
const READINESS_KEY = "global";
export const METRIC_VERSION = 4;
const METRIC_RECONCILIATION_STALE_MS = 60 * 60 * 1000;

const syncJobInvoicePageRef = makeFunctionReference<
  "mutation",
  { cursor: string | null; jobCardId: Id<"jobCards"> },
  unknown
>("crm/metricAggregates:syncJobInvoicePage");
const reconcileSourcePageRef = makeFunctionReference<
  "mutation",
  {
    cursor: string | null;
    generation: number;
    metricVersion?: number;
    sourceType: MetricSourceType;
  },
  unknown
>("crm/metricAggregates:reconcileSourcePage");
const sweepProjectionPageRef = makeFunctionReference<
  "mutation",
  {
    cursor: string | null;
    generation: number;
    metricVersion?: number;
    sourceType: MetricSourceType;
  },
  unknown
>("crm/metricAggregates:sweepProjectionPage");

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

function metricReadinessState({
  complete,
  reconciling,
  stale,
}: {
  complete: boolean;
  reconciling: boolean;
  stale: boolean;
}) {
  if (stale) {
    return "stale" as const;
  }
  if (reconciling) {
    return "reconciling" as const;
  }
  return complete ? ("ready" as const) : ("pending" as const);
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
    state: metricReadinessState({ complete, reconciling, stale }),
    version: row?.metricVersion ?? null,
  };
}

function monthStart(day: string) {
  return `${monthKey(day)}-01`;
}

function monthEnd(day: string) {
  const [year, month] = monthKey(day).split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
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
    default: {
      const unreachable: never = sourceType;
      throw new Error(`Unsupported metric source: ${unreachable}`);
    }
  }
}

export const syncEntity = internalMutation({
  args: { sourceId: v.string(), sourceType: metricSourceTypeValidator },
  handler: async (ctx, args) => {
    const source = await loadSourceDocument(ctx, args.sourceType, args.sourceId);
    return await syncProjection(ctx, args.sourceType, args.sourceId, source);
  },
  returns: v.object({ changed: v.boolean(), deleted: v.boolean() }),
});

export const processDirtyUnit = internalMutation({
  args: {},
  handler: processDirtyUnitHandler,
  returns: v.object({ changed: v.number(), processed: v.number(), scheduled: v.boolean() }),
});

export const enqueueDirtySources = internalMutation({
  args: { sourceIds: v.array(v.string()), sourceType: metricSourceTypeValidator },
  handler: enqueueDirtySourcesHandler,
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
    const results = await Promise.all(
      page.page.map((invoice) => syncProjection(ctx, "invoices", String(invoice._id), invoice))
    );
    const changed = results.filter((result) => result.changed).length;
    if (!page.isDone) {
      // SAFETY: this internal function is declared in this module; generated API types update after codegen.
      await ctx.scheduler.runAfter(0, syncJobInvoicePageRef, {
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
  // SAFETY: this internal function is declared in this module; generated API types update after codegen.
  await ctx.scheduler.runAfter(0, reconcileSourcePageRef, {
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
    sourceType: metricSourceTypeValidator,
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
    const results = await Promise.all(
      page.page.map((source) => syncProjection(ctx, args.sourceType, String(source._id), source))
    );
    const changed = results.filter((result) => result.changed).length;
    if (page.isDone) {
      // SAFETY: this internal function is declared in this module; generated API types update after codegen.
      await ctx.scheduler.runAfter(0, sweepProjectionPageRef, {
        cursor: null,
        generation: args.generation,
        metricVersion: args.metricVersion,
        sourceType: args.sourceType,
      });
    } else {
      // SAFETY: this internal function is declared in this module; generated API types update after codegen.
      await ctx.scheduler.runAfter(0, reconcileSourcePageRef, {
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
      // SAFETY: this internal function is declared in this module; generated API types update after codegen.
      await ctx.scheduler.runAfter(0, reconcileSourcePageRef, {
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
    sourceType: metricSourceTypeValidator,
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
    const deletionResults = await Promise.all(
      page.page.map(async (projection) => {
        const source = await loadSourceDocument(ctx, args.sourceType, projection.sourceId);
        if (source) {
          return false;
        }
        await removeProjection(ctx, projection);
        return true;
      })
    );
    const deleted = deletionResults.filter(Boolean).length;
    if (page.isDone) {
      await markReconciliationSourceComplete(
        ctx,
        args.generation,
        args.metricVersion,
        args.sourceType
      );
    } else {
      // SAFETY: this internal function is declared in this module; generated API types update after codegen.
      await ctx.scheduler.runAfter(0, sweepProjectionPageRef, {
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
