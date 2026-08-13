import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { canReceiveNotification } from "./lib/notifications";
import { notificationUnreadSummaryFromProjection } from "./notificationUnreadProjection";

interface NotificationAccess {
  authUserId?: string | null;
  roles: string[];
  staffId?: Id<"staffUsers"> | null;
}

type NotificationRow = Doc<"notifications">;

const SUMMARY_SCAN_CAP = 500;

export async function notificationReadTimesForAccess(
  ctx: QueryCtx,
  access: NotificationAccess,
  notifications: NotificationRow[]
) {
  const receipts = await Promise.all(
    notifications.map((notification) =>
      access.staffId
        ? ctx.db
            .query("notificationReads")
            .withIndex("by_notification_staff", (q) =>
              q.eq("notificationId", notification._id).eq("staffId", access.staffId ?? undefined)
            )
            .unique()
        : ctx.db
            .query("notificationReads")
            .withIndex("by_notification_user", (q) =>
              q
                .eq("notificationId", notification._id)
                .eq("authUserId", access.authUserId ?? undefined)
            )
            .unique()
    )
  );
  const readTimes = new Map<string, number>();
  for (const receipt of receipts) {
    if (receipt) {
      readTimes.set(String(receipt.notificationId), receipt.readAt);
    }
  }
  return readTimes;
}

export function notificationReadAtForAccess(
  notification: NotificationRow,
  access: NotificationAccess,
  receiptTimes: Map<string, number>
) {
  const receipt = receiptTimes.get(String(notification._id));
  if (receipt) {
    return receipt;
  }
  const individuallyTargeted =
    (access.staffId && notification.recipientStaffId === access.staffId) ||
    (access.authUserId && notification.recipientUserId === access.authUserId);
  return individuallyTargeted && !notification.recipientRole ? notification.readAt : undefined;
}

function dedupeNotifications(rows: NotificationRow[]) {
  const seen = new Set<Id<"notifications">>();
  const deduped: NotificationRow[] = [];
  for (const row of rows) {
    if (seen.has(row._id)) {
      continue;
    }
    seen.add(row._id);
    deduped.push(row);
  }
  return deduped;
}

async function fetchIndexedNotificationBatches(
  ctx: QueryCtx,
  access: NotificationAccess,
  takePerSource: number
) {
  const batches: NotificationRow[][] = [];
  let hitCap = false;

  if (access.authUserId) {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_recipientUserId_createdAt", (q) =>
        q.eq("recipientUserId", access.authUserId ?? undefined)
      )
      .order("desc")
      .take(takePerSource);
    if (rows.length >= takePerSource) {
      hitCap = true;
    }
    batches.push(rows);
  }

  if (access.staffId) {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_recipientStaffId_createdAt", (q) =>
        q.eq("recipientStaffId", access.staffId ?? undefined)
      )
      .order("desc")
      .take(takePerSource);
    if (rows.length >= takePerSource) {
      hitCap = true;
    }
    batches.push(rows);
  }

  const roleBatches = await Promise.all(
    access.roles.map((role) =>
      ctx.db
        .query("notifications")
        .withIndex("by_recipientRole_createdAt", (q) => q.eq("recipientRole", role as never))
        .order("desc")
        .take(takePerSource)
    )
  );
  for (const rows of roleBatches) {
    if (rows.length >= takePerSource) {
      hitCap = true;
    }
    batches.push(rows);
  }

  return {
    hitCap,
    rows: dedupeNotifications(batches.flat()),
  };
}

export async function fetchNotificationsForAccess(
  ctx: QueryCtx,
  access: NotificationAccess,
  limit: number
) {
  const buffer = Math.max(limit * 3, limit);
  const { rows } = await fetchIndexedNotificationBatches(ctx, access, buffer);
  return rows
    .filter((row) => canReceiveNotification(row, access))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export async function fetchAllNotificationsForAccess(ctx: QueryCtx, access: NotificationAccess) {
  const batches: NotificationRow[][] = [];

  if (access.authUserId) {
    batches.push(
      await ctx.db
        .query("notifications")
        .withIndex("by_recipientUserId", (q) =>
          q.eq("recipientUserId", access.authUserId ?? undefined)
        )
        .collect()
    );
  }

  if (access.staffId) {
    batches.push(
      await ctx.db
        .query("notifications")
        .withIndex("by_recipientStaffId", (q) =>
          q.eq("recipientStaffId", access.staffId ?? undefined)
        )
        .collect()
    );
  }

  const roleBatches = await Promise.all(
    access.roles.map((role) =>
      ctx.db
        .query("notifications")
        .withIndex("by_recipientRole", (q) => q.eq("recipientRole", role as never))
        .collect()
    )
  );
  batches.push(...roleBatches);

  return dedupeNotifications(batches.flat()).filter((row) => canReceiveNotification(row, access));
}

export async function notificationSummaryForAccessFromDb(
  ctx: QueryCtx,
  access: NotificationAccess
) {
  const projected = await notificationUnreadSummaryFromProjection(ctx, access);
  if (projected) {
    return projected;
  }
  const { rows, hitCap } = await fetchIndexedNotificationBatches(ctx, access, SUMMARY_SCAN_CAP);
  const visible = rows.filter((row) => canReceiveNotification(row, access));
  const receiptTimes = await notificationReadTimesForAccess(ctx, access, visible);
  const unreadCount = visible.filter(
    (row) => !notificationReadAtForAccess(row, access, receiptTimes)
  ).length;
  const hasMoreUnread = hitCap && unreadCount > 0;

  return {
    coverage: "partial" as const,
    unreadCount,
    ...(hasMoreUnread ? { hasMoreUnread: true as const } : {}),
  };
}
