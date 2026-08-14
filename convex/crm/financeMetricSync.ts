import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { hasActiveE2eRun } from "./lib/e2eOwnership";
import type { MetricSourceType } from "./metricTypes";

export async function scheduleCrmMetricSync(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  sourceId: string
) {
  await scheduleCrmMetricSyncBatch(ctx, sourceType, [sourceId]);
}

export async function scheduleCrmMetricSyncBatch(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  sourceIds: string[]
) {
  if (sourceIds.length === 0) {
    return;
  }
  if (await hasActiveE2eRun(ctx)) {
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
