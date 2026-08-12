import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { hasActiveE2eRun } from "./lib/e2eOwnership";
import type { MetricSourceType } from "./metricAggregates";

export async function scheduleCrmMetricSync(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  sourceId: string
) {
  if (await hasActiveE2eRun(ctx)) {
    return;
  }
  await ctx.scheduler.runAfter(0, internal.crm.metricAggregates.syncEntity, {
    sourceId,
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
  if (await hasActiveE2eRun(ctx)) {
    return;
  }
  await ctx.scheduler.runAfter(0, (internal as any).crm.metricAggregates.syncJobInvoicePage, {
    cursor: null,
    jobCardId,
  });
}
