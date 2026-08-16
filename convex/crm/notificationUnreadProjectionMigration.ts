import { makeFunctionReference } from "convex/server";
import { ConvexError, type Value, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { propertiesWhen } from "../lib/runtimeValues";
import {
  adjustNotificationReadTargetCount,
  adjustNotificationTargetCount,
  NOTIFICATION_UNREAD_PROJECTION_VERSION,
  NOTIFICATION_UNREAD_READINESS_KEY,
  notificationIdentityProjectionKey,
  notificationTargetProjectionKey,
  projectNotificationInsert,
  projectNotificationReceipt,
} from "./notificationUnreadProjection";

const PAGE_SIZE = 50;
const STALE_MS = 60 * 60 * 1000;

type ReconciliationStage = "notifications" | "receipts" | "verifyNotifications" | "verifyReceipts";

interface ReconciliationPageArgs extends Record<string, Value> {
  cursor: string | null;
  generation: number;
  residuals: number;
  scanned: number;
  stage: ReconciliationStage;
}

const reconcilePageRef = makeFunctionReference<"mutation", ReconciliationPageArgs, null>(
  "crm/notificationUnreadProjectionMigration:reconcilePage"
);

async function loadReadiness(ctx: MutationCtx) {
  return await ctx.db
    .query("notificationUnreadProjectionReadiness")
    .withIndex("by_key", (q) => q.eq("key", NOTIFICATION_UNREAD_READINESS_KEY))
    .unique();
}

async function schedulePage(ctx: MutationCtx, args: ReconciliationPageArgs) {
  await ctx.scheduler.runAfter(0, reconcilePageRef, args);
}

function nextStage(stage: ReconciliationStage): ReconciliationStage | "complete" {
  if (stage === "notifications") {
    return "receipts";
  }
  if (stage === "receipts") {
    return "verifyNotifications";
  }
  if (stage === "verifyNotifications") {
    return "verifyReceipts";
  }
  return "complete";
}

async function reconcileNotification(ctx: MutationCtx, row: Doc<"notifications">) {
  const targetKey = notificationTargetProjectionKey(row);
  const current =
    row.projectionVersion === NOTIFICATION_UNREAD_PROJECTION_VERSION &&
    row.projectionTargetKey === targetKey;
  if (!current) {
    if (
      row.projectionVersion === NOTIFICATION_UNREAD_PROJECTION_VERSION &&
      row.projectionTargetKey
    ) {
      await adjustNotificationTargetCount(ctx, row.projectionTargetKey, -1, row.createdAt);
    }
    const projection = await projectNotificationInsert(ctx, row);
    await ctx.db.patch("notifications", row._id, projection);
  }
  if (!row.readAt || row.recipientRole || !(row.recipientStaffId || row.recipientUserId)) {
    return;
  }
  const existingReceipt = row.recipientStaffId
    ? await ctx.db
        .query("notificationReads")
        .withIndex("by_notification_staff", (q) =>
          q.eq("notificationId", row._id).eq("staffId", row.recipientStaffId)
        )
        .unique()
    : await ctx.db
        .query("notificationReads")
        .withIndex("by_notification_user", (q) =>
          q.eq("notificationId", row._id).eq("authUserId", row.recipientUserId)
        )
        .unique();
  if (!existingReceipt) {
    const receipt = {
      authUserId: row.recipientStaffId ? undefined : row.recipientUserId,
      notificationId: row._id,
      readAt: row.readAt,
      staffId: row.recipientStaffId,
    };
    const projection = await projectNotificationReceipt(ctx, row, receipt);
    await ctx.db.insert("notificationReads", { ...receipt, ...projection });
  }
}

async function receiptProjectionSource(ctx: MutationCtx, row: Doc<"notificationReads">) {
  const notification = await ctx.db.get("notifications", row.notificationId);
  if (!notification) {
    throw new ConvexError("NOTIFICATION_UNREAD_ORPHAN_RECEIPT");
  }
  return {
    identityKey: notificationIdentityProjectionKey(row),
    notification,
    targetKey: notificationTargetProjectionKey(notification),
  };
}

async function reconcileReceipt(ctx: MutationCtx, row: Doc<"notificationReads">) {
  const source = await receiptProjectionSource(ctx, row);
  if (
    row.projectionVersion === NOTIFICATION_UNREAD_PROJECTION_VERSION &&
    row.projectionIdentityKey === source.identityKey &&
    row.projectionTargetKey === source.targetKey
  ) {
    return;
  }
  if (
    row.projectionVersion === NOTIFICATION_UNREAD_PROJECTION_VERSION &&
    row.projectionIdentityKey &&
    row.projectionTargetKey
  ) {
    await adjustNotificationReadTargetCount(
      ctx,
      row.projectionIdentityKey,
      row.projectionTargetKey,
      -1,
      row.readAt
    );
  }
  const projection = await projectNotificationReceipt(ctx, source.notification, row);
  await ctx.db.patch("notificationReads", row._id, projection);
}

function notificationProjectionResidual(row: Doc<"notifications">) {
  return Number(
    row.projectionVersion !== NOTIFICATION_UNREAD_PROJECTION_VERSION ||
      row.projectionTargetKey !== notificationTargetProjectionKey(row)
  );
}

async function receiptProjectionResidual(ctx: MutationCtx, row: Doc<"notificationReads">) {
  const source = await receiptProjectionSource(ctx, row);
  return Number(
    row.projectionVersion !== NOTIFICATION_UNREAD_PROJECTION_VERSION ||
      row.projectionIdentityKey !== source.identityKey ||
      row.projectionTargetKey !== source.targetKey
  );
}

export const startReconciliation = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await loadReadiness(ctx);
    const now = Date.now();
    const active = Boolean(
      existing?.status === "running" &&
        existing.version === NOTIFICATION_UNREAD_PROJECTION_VERSION &&
        now - existing.updatedAt < STALE_MS
    );
    if (
      active ||
      (existing?.ready && existing.version === NOTIFICATION_UNREAD_PROJECTION_VERSION)
    ) {
      return { generation: existing?.generation ?? 0, scheduled: false };
    }
    const generation = (existing?.generation ?? 0) + 1;
    const value = {
      failureCode: undefined,
      generation,
      key: NOTIFICATION_UNREAD_READINESS_KEY,
      ready: false,
      residuals: 0,
      scanned: 0,
      stage: "notifications" as const,
      startedAt: now,
      status: "running" as const,
      updatedAt: now,
      version: NOTIFICATION_UNREAD_PROJECTION_VERSION,
    };
    if (existing) {
      await ctx.db.patch("notificationUnreadProjectionReadiness", existing._id, value);
    } else {
      await ctx.db.insert("notificationUnreadProjectionReadiness", value);
    }
    await schedulePage(ctx, {
      cursor: null,
      generation,
      residuals: 0,
      scanned: 0,
      stage: "notifications",
    });
    return { generation, scheduled: true };
  },
  returns: v.object({ generation: v.number(), scheduled: v.boolean() }),
});

export const reconcilePage = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    generation: v.number(),
    residuals: v.number(),
    scanned: v.number(),
    stage: v.union(
      v.literal("notifications"),
      v.literal("receipts"),
      v.literal("verifyNotifications"),
      v.literal("verifyReceipts")
    ),
  },
  handler: async (ctx, args) => {
    const readiness = await loadReadiness(ctx);
    if (
      readiness?.generation !== args.generation ||
      readiness.status !== "running" ||
      readiness.version !== NOTIFICATION_UNREAD_PROJECTION_VERSION
    ) {
      return null;
    }
    const notificationStage =
      args.stage === "notifications" || args.stage === "verifyNotifications";
    const page = notificationStage
      ? await ctx.db.query("notifications").paginate({ cursor: args.cursor, numItems: PAGE_SIZE })
      : await ctx.db
          .query("notificationReads")
          .paginate({ cursor: args.cursor, numItems: PAGE_SIZE });
    let { residuals } = args;

    if (args.stage === "notifications") {
      // SAFETY: notificationStage selected the notifications query for this page.
      for (const row of page.page as Doc<"notifications">[]) {
        // Rows often share role counters and must project in order.
        // biome-ignore lint/performance/noAwaitInLoops: ordered projection updates prevent lost deltas
        await reconcileNotification(ctx, row);
      }
    } else if (args.stage === "receipts") {
      // SAFETY: the receipts stage selected the notificationReads query for this page.
      for (const row of page.page as Doc<"notificationReads">[]) {
        // One identity may have many reads against the same role target.
        // biome-ignore lint/performance/noAwaitInLoops: ordered projection updates prevent lost deltas
        await reconcileReceipt(ctx, row);
      }
    } else if (args.stage === "verifyNotifications") {
      // SAFETY: verifyNotifications is a notificationStage and therefore selected the notifications query.
      residuals += (page.page as Doc<"notifications">[]).reduce(
        (total, row) => total + notificationProjectionResidual(row),
        0
      );
    } else {
      // SAFETY: the remaining verifyReceipts stage selected the notificationReads query.
      const pageResiduals = await Promise.all(
        (page.page as Doc<"notificationReads">[]).map((row) => receiptProjectionResidual(ctx, row))
      );
      residuals += pageResiduals.reduce((total, count) => total + count, 0);
    }

    const scanned = args.scanned + page.page.length;
    const now = Date.now();
    await ctx.db.patch("notificationUnreadProjectionReadiness", readiness._id, {
      residuals,
      scanned,
      stage: args.stage,
      updatedAt: now,
    });
    if (!page.isDone) {
      await schedulePage(ctx, {
        cursor: page.continueCursor,
        generation: args.generation,
        residuals,
        scanned,
        stage: args.stage,
      });
      return null;
    }

    const stage = nextStage(args.stage);
    if (stage !== "complete") {
      await ctx.db.patch("notificationUnreadProjectionReadiness", readiness._id, {
        residuals: stage.startsWith("verify") ? residuals : 0,
        scanned: 0,
        stage,
        updatedAt: now,
      });
      await schedulePage(ctx, {
        cursor: null,
        generation: args.generation,
        residuals: stage.startsWith("verify") ? residuals : 0,
        scanned: 0,
        stage,
      });
      return null;
    }
    await ctx.db.patch("notificationUnreadProjectionReadiness", readiness._id, {
      ...propertiesWhen(residuals > 0, () => ({ failureCode: "projection_residuals" })),
      ready: residuals === 0,
      residuals,
      stage: "complete",
      status: residuals === 0 ? "complete" : "failed",
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});
