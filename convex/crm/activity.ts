import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { canReceiveNotification, PERMISSIONS, requireStaff } from "./lib";
import {
  fetchAllNotificationsForAccess,
  fetchNotificationsForAccess,
  notificationSummaryForAccessFromDb,
} from "./notificationReads";

export const listActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_ACTIVITY);
    const limit = args.limit ?? 50;
    const rows = await ctx.db
      .query("activityLogs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
    return rows.map((activity) => ({
      id: activity._id,
      entityType: activity.entityType,
      entityId: activity.entityId ?? "",
      action: activity.action,
      message: activity.message,
      actorName: activity.actorName,
      createdAt: new Date(activity.createdAt).toISOString(),
    }));
  },
});

export const listNotifications = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const rows = await fetchNotificationsForAccess(ctx, access, args.limit ?? 20);
    return rows.map((notification) => ({
      id: notification._id,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType ?? "",
      entityId: notification.entityId ?? "",
      readAt: notification.readAt ? new Date(notification.readAt).toISOString() : null,
      createdAt: new Date(notification.createdAt).toISOString(),
    }));
  },
});

export const notificationSummary = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx);
    return notificationSummaryForAccessFromDb(ctx, access);
  },
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
    await ctx.db.patch(id, { readAt: Date.now() });
    return { id };
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx);
    const now = Date.now();
    const toMark = (await fetchAllNotificationsForAccess(ctx, access)).filter(
      (notification) => !notification.readAt,
    );
    await Promise.all(
      toMark.map((notification) => ctx.db.patch(notification._id, { readAt: now })),
    );

    return { marked: toMark.length };
  },
});

export const removeNotification = mutation({
  args: {
    notificationId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const id = ctx.db.normalizeId("notifications", args.notificationId);
    if (!id) {
      throw new ConvexError("Invalid notification id");
    }
    const notification = await ctx.db.get(id);
    if (!notification) {
      throw new ConvexError("Notification not found");
    }
    if (!canReceiveNotification(notification, access)) {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.delete(id);
    return { id };
  },
});
