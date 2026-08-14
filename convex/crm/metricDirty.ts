import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { loadSourceDocument, syncProjection } from "./metricProjection";
import type { MetricSourceType } from "./metricTypes";

export type MetricContextKind = "jobContext" | "queryContext";

const DIRTY_DEPENDENCY_PAGE_SIZE = 20;
const DIRTY_SOURCE_BATCH_SIZE = 10;
const JOB_CONTEXT_STAGES = [
  "expenseEntries",
  "invoices",
  "pnrs",
  "tickets",
  "travellers",
  "visaRecords",
] as const;
const QUERY_CONTEXT_STAGES = ["jobCards", "proposals"] as const;
type JobMetricDependencyStage = (typeof JOB_CONTEXT_STAGES)[number];
type QueryMetricDependencyStage = (typeof QUERY_CONTEXT_STAGES)[number];
type MetricDependencyStage = JobMetricDependencyStage | QueryMetricDependencyStage;

async function enqueueMetricDirty(
  ctx: MutationCtx,
  args:
    | { kind: "source"; sourceId: string; sourceType: MetricSourceType }
    | { kind: MetricContextKind; sourceId: string }
) {
  const key =
    args.kind === "source"
      ? `source:${args.sourceType}:${args.sourceId}`
      : `${args.kind}:${args.sourceId}`;
  const existing = await ctx.db
    .query("crmMetricDirty")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  const now = Date.now();
  if (existing) {
    await ctx.db.patch("crmMetricDirty", existing._id, {
      ...(args.kind === "source" ? {} : { cursor: undefined, stage: undefined }),
      updatedAt: now,
    });
    return false;
  }
  await ctx.db.insert("crmMetricDirty", {
    createdAt: now,
    key,
    kind: args.kind,
    sourceId: args.sourceId,
    ...(args.kind === "source" ? { sourceType: args.sourceType } : {}),
    updatedAt: now,
  });
  return true;
}

export async function enqueueMetricSourceDirty(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  sourceId: string
) {
  return await enqueueMetricDirty(ctx, { kind: "source", sourceId, sourceType });
}

export async function enqueueMetricContextDirty(
  ctx: MutationCtx,
  kind: MetricContextKind,
  sourceId: string
) {
  return await enqueueMetricDirty(ctx, { kind, sourceId });
}

export async function scheduleMetricDirtyWorker(ctx: MutationCtx) {
  await ctx.scheduler.runAfter(0, internal.crm.metricAggregates.processDirtyUnit, {});
}

async function loadJobDependencyPage(
  ctx: MutationCtx,
  jobCardId: Id<"jobCards">,
  stage: JobMetricDependencyStage,
  cursor: string | null
) {
  const paginationOpts = { cursor, numItems: DIRTY_DEPENDENCY_PAGE_SIZE };
  switch (stage) {
    case "expenseEntries":
      return await ctx.db
        .query("expenseEntries")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .paginate(paginationOpts);
    case "invoices":
      return await ctx.db
        .query("invoices")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .paginate(paginationOpts);
    case "pnrs":
      return await ctx.db
        .query("pnrs")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .paginate(paginationOpts);
    case "tickets":
      return await ctx.db
        .query("tickets")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .paginate(paginationOpts);
    case "travellers":
      return await ctx.db
        .query("travellers")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .paginate(paginationOpts);
    case "visaRecords":
      return await ctx.db
        .query("visaRecords")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .paginate(paginationOpts);
    default: {
      const unreachable: never = stage;
      throw new Error(`Unsupported job metric dependency stage: ${unreachable}`);
    }
  }
}

async function loadQueryDependencyPage(
  ctx: MutationCtx,
  queryId: Id<"queries">,
  stage: QueryMetricDependencyStage,
  cursor: string | null
) {
  const paginationOpts = { cursor, numItems: DIRTY_DEPENDENCY_PAGE_SIZE };
  switch (stage) {
    case "jobCards":
      return await ctx.db
        .query("jobCards")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
        .paginate(paginationOpts);
    case "proposals":
      return await ctx.db
        .query("proposals")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
        .paginate(paginationOpts);
    default: {
      const unreachable: never = stage;
      throw new Error(`Unsupported query metric dependency stage: ${unreachable}`);
    }
  }
}

async function processJobContextDirty(
  ctx: MutationCtx,
  dirty: Doc<"crmMetricDirty">,
  stage: JobMetricDependencyStage
) {
  const jobCardId = ctx.db.normalizeId("jobCards", dirty.sourceId);
  if (!jobCardId) {
    await ctx.db.delete("crmMetricDirty", dirty._id);
    return 0;
  }
  const page = await loadJobDependencyPage(ctx, jobCardId, stage, dirty.cursor ?? null);
  let changed = 0;
  for (const source of page.page) {
    // biome-ignore lint/performance/noAwaitInLoops: serialized projection writes avoid OCC conflicts
    const result = await syncProjection(ctx, stage, String(source._id), source);
    changed += result.changed ? 1 : 0;
  }
  if (!page.isDone) {
    await ctx.db.patch("crmMetricDirty", dirty._id, {
      cursor: page.continueCursor,
      stage,
      updatedAt: Date.now(),
    });
    return changed;
  }
  const nextStage = JOB_CONTEXT_STAGES[JOB_CONTEXT_STAGES.indexOf(stage) + 1];
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

async function processQueryContextDirty(
  ctx: MutationCtx,
  dirty: Doc<"crmMetricDirty">,
  stage: QueryMetricDependencyStage
) {
  const queryId = ctx.db.normalizeId("queries", dirty.sourceId);
  if (!queryId) {
    await ctx.db.delete("crmMetricDirty", dirty._id);
    return 0;
  }
  const page = await loadQueryDependencyPage(ctx, queryId, stage, dirty.cursor ?? null);
  let changed = 0;
  for (const source of page.page) {
    // biome-ignore lint/performance/noAwaitInLoops: serialized projection writes avoid OCC conflicts
    const result = await syncProjection(ctx, stage, String(source._id), source);
    changed += result.changed ? 1 : 0;
    if (stage === "jobCards") {
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
  const nextStage = QUERY_CONTEXT_STAGES[QUERY_CONTEXT_STAGES.indexOf(stage) + 1];
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

function initialDependencyStage(dirty: Doc<"crmMetricDirty">): MetricDependencyStage {
  if (dirty.kind === "jobContext") {
    return JOB_CONTEXT_STAGES.includes(dirty.stage as JobMetricDependencyStage)
      ? (dirty.stage as JobMetricDependencyStage)
      : JOB_CONTEXT_STAGES[0];
  }
  return QUERY_CONTEXT_STAGES.includes(dirty.stage as QueryMetricDependencyStage)
    ? (dirty.stage as QueryMetricDependencyStage)
    : QUERY_CONTEXT_STAGES[0];
}

async function processMetricDependencyDirty(ctx: MutationCtx, dirty: Doc<"crmMetricDirty">) {
  const stage = initialDependencyStage(dirty);
  return dirty.kind === "jobContext"
    ? await processJobContextDirty(ctx, dirty, stage as JobMetricDependencyStage)
    : await processQueryContextDirty(ctx, dirty, stage as QueryMetricDependencyStage);
}

export async function processDirtyUnitHandler(ctx: MutationCtx) {
  let changed = 0;
  let processed = 0;
  while (processed < DIRTY_SOURCE_BATCH_SIZE) {
    // biome-ignore lint/performance/noAwaitInLoops: each iteration consumes the next durable queue head
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
}

export async function enqueueDirtySourcesHandler(
  ctx: MutationCtx,
  args: { sourceIds: string[]; sourceType: MetricSourceType }
) {
  if (args.sourceIds.length > 50) {
    throw new Error("Metric dirty batches are limited to 50 sources");
  }
  const queueWasEmpty = !(await ctx.db.query("crmMetricDirty").withIndex("by_updatedAt").first());
  const sourceIds = new Set(args.sourceIds);
  for (const sourceId of sourceIds) {
    // biome-ignore lint/performance/noAwaitInLoops: queue writes are intentionally serialized to avoid OCC conflicts
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
}
