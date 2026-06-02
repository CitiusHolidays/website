import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { PERMISSIONS, requireStaff } from "./lib";

export const listActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const [, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_ACTIVITY),
      ctx.db.query("activityLogs").collect(),
    ]);
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
    const [access, rows] = await Promise.all([
      requireStaff(ctx),
      ctx.db.query("notifications").collect(),
    ]);
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
    await requireStaff(ctx);
    const id = ctx.db.normalizeId("notifications", args.notificationId);
    if (!id) {
      return null;
    }
    await ctx.db.patch(id, { readAt: Date.now() });
    return { id };
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx),
      ctx.db.query("notifications").collect(),
    ]);
    const roleSet = new Set(access.roles);
    const now = Date.now();
    const readableNotifications = rows.filter((notification) => {
      if (notification.readAt) {
        return false;
      }
      if (notification.recipientUserId && notification.recipientUserId !== access.authUserId) {
        return false;
      }
      if (notification.recipientRole && !roleSet.has(notification.recipientRole)) {
        return false;
      }
      return true;
    });
    await Promise.all(
      readableNotifications.map((notification) => ctx.db.patch(notification._id, { readAt: now })),
    );

    return { marked: readableNotifications.length };
  },
});

export const removeNotification = mutation({
  args: {
    notificationId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const id = ctx.db.normalizeId("notifications", args.notificationId);
    if (!id) {
      throw new ConvexError("Invalid notification id");
    }
    const notification = await ctx.db.get(id);
    if (!notification) {
      throw new ConvexError("Notification not found");
    }
    await ctx.db.delete(id);
    return { id };
  },
});
