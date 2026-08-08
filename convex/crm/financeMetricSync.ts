import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { MetricSourceType } from "./metricAggregates";

export async function scheduleCrmMetricSync(
  ctx: Pick<MutationCtx, "scheduler">,
  sourceType: MetricSourceType,
  sourceId: string
) {
  await ctx.scheduler.runAfter(0, internal.crm.metricAggregates.syncEntity, {
    sourceId,
    sourceType,
  });
}

export async function scheduleFinanceMetricSync(
  ctx: Pick<MutationCtx, "scheduler">,
  sourceType: "expenseEntries" | "invoices",
  sourceId: string
) {
  await scheduleCrmMetricSync(ctx, sourceType, sourceId);
}

export async function scheduleJobInvoiceMetricSync(
  ctx: Pick<MutationCtx, "scheduler">,
  jobCardId: Id<"jobCards">
) {
  await ctx.scheduler.runAfter(0, (internal as any).crm.metricAggregates.syncJobInvoicePage, {
    cursor: null,
    jobCardId,
  });
}
