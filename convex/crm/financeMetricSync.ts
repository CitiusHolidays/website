import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { type E2eOwnershipActor, hasActiveE2eRun } from "./lib/e2eOwnership";
import type { MetricSourceType } from "./metricTypes";

export async function scheduleCrmMetricSync(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  sourceId: string,
  actor?: E2eOwnershipActor
) {
  await scheduleCrmMetricSyncBatch(ctx, sourceType, [sourceId], actor);
}

export async function scheduleCrmMetricSyncBatch(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  sourceIds: string[],
  actor?: E2eOwnershipActor
) {
  if (sourceIds.length === 0) {
    return;
  }
  if (await hasActiveE2eRun(ctx, actor)) {
    return;
  }
  await ctx.scheduler.runAfter(0, internal.crm.metricAggregates.enqueueDirtySources, {
    sourceIds,
    sourceType,
  });
}

export async function scheduleFinanceMetricSync(
  ctx: MutationCtx,
  sourceType: "expenseEntries" | "invoices",
  sourceId: string
) {
  await scheduleCrmMetricSync(ctx, sourceType, sourceId);
}

export async function scheduleJobInvoiceMetricSync(ctx: MutationCtx, jobCardId: Id<"jobCards">) {
  await scheduleCrmMetricSync(ctx, "jobCards", String(jobCardId));
}
