import { paginationOptsValidator } from "convex/server";
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
import { applyCrmCursorFilters, boundedPaginationOptions } from "./paginationPolicy";
import {
  activityListPageResultValidator,
  markedNotificationsResultValidator,
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

export const listNotifications = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const rows = await fetchNotificationsForAccess(ctx, access, args.limit ?? 20);
    const receiptTimes = await notificationReadTimesForAccess(ctx, access, rows);
    return rows.map((notification) => ({
      body: notification.body,
      createdAt: new Date(notification.createdAt).toISOString(),
      entityId: notification.entityId ?? "",
      entityType: notification.entityType ?? "",
      id: notification._id,
      readAt: notificationReadAtForAccess(notification, access, receiptTimes)
        ? new Date(
            notificationReadAtForAccess(notification, access, receiptTimes) as number
          ).toISOString()
        : null,
      title: notification.title,
    }));
  },
  returns: notificationListResultValidator,
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
    const notification = await ctx.db.get(id);
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
      await patchWithE2eOwnership(ctx, "notificationReads", existing._id, { readAt });
    } else {
      await insertWithE2eOwnership(ctx, "notificationReads", {
        authUserId: access.staffId ? undefined : access.authUserId,
        notificationId: id,
        readAt,
        staffId: access.staffId,
      });
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
    await Promise.all(
      toMark.map((notification) =>
        insertWithE2eOwnership(ctx, "notificationReads", {
          authUserId: access.staffId ? undefined : access.authUserId,
          notificationId: notification._id,
          readAt: now,
          staffId: access.staffId,
        })
      )
    );

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
    const notification = await ctx.db.get(id);
    if (!notification) {
      throw new ConvexError("Notification not found");
    }
    const receipts = await ctx.db
      .query("notificationReads")
      .withIndex("by_notificationId", (q) => q.eq("notificationId", id))
      .collect();
    await Promise.all(receipts.map((receipt) => ctx.db.delete(receipt._id)));
    await ctx.db.delete(id);
    return { id };
  },
  returns: notificationIdResultValidator,
});
