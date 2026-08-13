import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { MetricSourceType } from "./metricAggregates";

export type MetricContextKind = "jobContext" | "queryContext";

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
