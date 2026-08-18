import { v } from "convex/values";
import { internal } from "../_generated/api";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import { flushDeferredNotificationCleanup, type NotificationEntityIdentity } from "./lib";

export const pnrCleanupStageValidator = v.union(v.literal("seatAllocations"), v.literal("tickets"));
export const pnrCleanupResultValidator = v.object({
  complete: v.boolean(),
  deleted: v.number(),
});
export const PNR_CLEANUP_PAGE_SIZE = 32;

export async function handleContinuePnrCleanup(
  ctx: any,
  args: {
    pnrId: string;
    stage: "seatAllocations" | "tickets";
  }
) {
  const pnrId = ctx.db.normalizeId("pnrs", args.pnrId);
  if (!pnrId) {
    return { complete: true, deleted: 0 };
  }
  const rows = await ctx.db
    .query(args.stage)
    .withIndex("by_pnrId", (q: any) => q.eq("pnrId", pnrId))
    .take(PNR_CLEANUP_PAGE_SIZE);
  const notifications: NotificationEntityIdentity[] = [];
  await Promise.all(
    rows.map(async (row: any) => {
      if (args.stage === "tickets" && row.travellerId) {
        await ctx.db.patch("travellers", row.travellerId, {
          ticketStatus: "Pending Issue",
          updatedAt: Date.now(),
        });
        await scheduleCrmMetricSync(ctx, "travellers", String(row.travellerId));
      }
      notifications.push({
        entityId: String(row._id),
        entityType: args.stage === "tickets" ? "ticket" : "seatAllocation",
      });
      await ctx.db.delete(args.stage, row._id);
      if (args.stage === "tickets") {
        await scheduleCrmMetricSync(ctx, "tickets", String(row._id));
      }
    })
  );
  await flushDeferredNotificationCleanup(ctx, notifications);
  const nextStage =
    rows.length === PNR_CLEANUP_PAGE_SIZE
      ? args.stage
      : args.stage === "tickets"
        ? "seatAllocations"
        : null;
  if (nextStage) {
    await ctx.scheduler.runAfter(0, internal.crm.ticketing.continuePnrCleanup, {
      pnrId: args.pnrId,
      stage: nextStage,
    });
  }
  return { complete: !nextStage, deleted: rows.length };
}
