import { paginationOptsValidator } from "convex/server";
import "./notificationUnreadProjectionMigration";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { canReceiveNotification } from "./lib/notifications";
import { PERMISSIONS } from "./lib/rolePolicy";
import { requireStaff } from "./lib/staffAccess";
import {
  fetchAllNotificationsForAccess,
  fetchNotificationsForAccess,
  notificationReadAtForAccess,
  notificationReadTimesForAccess,
  notificationSummaryForAccessFromDb,
} from "./notificationReads";
import {
  deleteNotificationWithProjection,
  NOTIFICATION_UNREAD_PROJECTION_VERSION,
  projectNotificationReceipt,
} from "./notificationUnreadProjection";
import { applyCrmCursorFilters, boundedPaginationOptions } from "./paginationPolicy";
import {
  activityListPageResultValidator,
  markedNotificationsResultValidator,
  notificationBellStateResultValidator,
  notificationIdResultValidator,
  notificationListResultValidator,
  notificationSummaryResultValidator,
  nullableNotificationIdResultValidator,
} from "./peopleWorkflowReturnContracts";

export const listActivity = query({
  args: {
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_ACTIVITY);
    const page = await applyCrmCursorFilters(
      ctx.db.query("activityLogs").withIndex("by_createdAt").order("desc"),
      { equals: { action: args.action, entityType: args.entityType } }
    ).paginate(boundedPaginationOptions(args.paginationOpts));
    return {
      ...page,
      page: page.page.map((activity) => ({
        action: activity.action,
        actorName: activity.actorName,
        createdAt: new Date(activity.createdAt).toISOString(),
        entityId: activity.entityId ?? "",
        entityType: activity.entityType,
        id: activity._id,
        message: activity.message,
      })),
    };
  },
  returns: activityListPageResultValidator,
});

async function notificationListForAccess(
  ctx: Parameters<typeof fetchNotificationsForAccess>[0],
  access: Awaited<ReturnType<typeof requireStaff>>,
  limit: number
) {
  const rows = await fetchNotificationsForAccess(ctx, access, limit);
  const receiptTimes = await notificationReadTimesForAccess(ctx, access, rows);
  return rows.map((notification) => {
    const readAt = notificationReadAtForAccess(notification, access, receiptTimes);
    return {
      body: notification.body,
      createdAt: new Date(notification.createdAt).toISOString(),
      entityId: notification.entityId ?? "",
      entityType: notification.entityType ?? "",
      id: notification._id,
      readAt: readAt ? new Date(readAt).toISOString() : null,
      title: notification.title,
    };
  });
}

export const listNotifications = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    return await notificationListForAccess(ctx, access, args.limit ?? 20);
  },
  returns: notificationListResultValidator,
});

export const notificationBellState = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const [notifications, summary] = await Promise.all([
      notificationListForAccess(ctx, access, Math.min(20, Math.max(1, args.limit ?? 8))),
      notificationSummaryForAccessFromDb(ctx, access),
    ]);
    return { ...summary, notifications };
  },
  returns: notificationBellStateResultValidator,
});

export const notificationSummary = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx);
    return notificationSummaryForAccessFromDb(ctx, access);
  },
  returns: notificationSummaryResultValidator,
});

export const markNotificationRead = mutation({
  args: {
    notificationId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const id = ctx.db.normalizeId("notifications", args.notificationId);
    if (!id) {
      return null;
    }
    const notification = await ctx.db.get("notifications", id);
    if (!notification) {
      return null;
    }
    if (!canReceiveNotification(notification, access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const existing = access.staffId
      ? await ctx.db
          .query("notificationReads")
          .withIndex("by_notification_staff", (q) =>
            q.eq("notificationId", id).eq("staffId", access.staffId)
          )
          .unique()
      : await ctx.db
          .query("notificationReads")
          .withIndex("by_notification_user", (q) =>
            q.eq("notificationId", id).eq("authUserId", access.authUserId)
          )
          .unique();
    const readAt = Date.now();
    if (existing) {
      if (
        existing.projectionVersion === NOTIFICATION_UNREAD_PROJECTION_VERSION &&
        existing.projectionIdentityKey &&
        existing.projectionTargetKey
      ) {
        await patchWithE2eOwnership(ctx, "notificationReads", existing._id, { readAt });
      } else {
        const projection = await projectNotificationReceipt(ctx, notification, {
          authUserId: access.staffId ? undefined : access.authUserId,
          readAt,
          staffId: access.staffId,
        });
        await patchWithE2eOwnership(ctx, "notificationReads", existing._id, {
          ...projection,
          readAt,
        });
      }
    } else {
      const receipt = {
        authUserId: access.staffId ? undefined : access.authUserId,
        notificationId: id,
        readAt,
        staffId: access.staffId,
      };
      const projection = await projectNotificationReceipt(ctx, notification, receipt);
      await insertWithE2eOwnership(ctx, "notificationReads", { ...receipt, ...projection });
    }
    return { id };
  },
  returns: nullableNotificationIdResultValidator,
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx);
    const now = Date.now();
    const visible = await fetchAllNotificationsForAccess(ctx, access);
    const receiptTimes = await notificationReadTimesForAccess(ctx, access, visible);
    const toMark = visible.filter(
      (notification) => !notificationReadAtForAccess(notification, access, receiptTimes)
    );
    for (const notification of toMark) {
      const receipt = {
        authUserId: access.staffId ? undefined : access.authUserId,
        notificationId: notification._id,
        readAt: now,
        staffId: access.staffId,
      };
      // One identity may mark several rows from the same target, so read-counter
      // updates are intentionally ordered inside this transaction.
      // biome-ignore lint/performance/noAwaitInLoops: ordered projection updates prevent lost deltas
      const projection = await projectNotificationReceipt(ctx, notification, receipt);
      await insertWithE2eOwnership(ctx, "notificationReads", { ...receipt, ...projection });
    }

    return { marked: toMark.length };
  },
  returns: markedNotificationsResultValidator,
});

export const removeNotification = mutation({
  args: {
    notificationId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_ACTIVITY);
    const id = ctx.db.normalizeId("notifications", args.notificationId);
    if (!id) {
      throw new ConvexError("Invalid notification id");
    }
    const notification = await ctx.db.get("notifications", id);
    if (!notification) {
      throw new ConvexError("Notification not found");
    }
    await deleteNotificationWithProjection(ctx, notification);
    return { id };
  },
  returns: notificationIdResultValidator,
});
