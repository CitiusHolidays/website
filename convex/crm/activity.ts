import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { canReceiveNotification, PERMISSIONS, requireStaff } from "./lib";

export const listActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_ACTIVITY);
    const rows = await ctx.db.query("activityLogs").collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 50)
      .map((activity) => ({
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
    const rows = await ctx.db.query("notifications").collect();
    const roleSet = new Set(access.roles);
    return rows
      .filter(
        (row) =>
          (!row.recipientUserId || row.recipientUserId === access.authUserId) &&
          (!row.recipientRole || roleSet.has(row.recipientRole)),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 20)
      .map((notification) => ({
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
    const rows = await ctx.db.query("notifications").collect();
    const roleSet = new Set(access.roles);
    const now = Date.now();
    let marked = 0;

    for (const notification of rows) {
      if (notification.readAt) {
        continue;
      }
      if (notification.recipientUserId && notification.recipientUserId !== access.authUserId) {
        continue;
      }
      if (notification.recipientRole && !roleSet.has(notification.recipientRole)) {
        continue;
      }
      await ctx.db.patch(notification._id, { readAt: now });
      marked += 1;
    }

    return { marked };
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
