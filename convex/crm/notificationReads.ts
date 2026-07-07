import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { canReceiveNotification } from "./lib";

type NotificationAccess = {
  staffId?: Id<"staffUsers"> | null;
  authUserId?: string | null;
  roles: string[];
};

type NotificationRow = Doc<"notifications">;

const SUMMARY_SCAN_CAP = 500;

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
  const { rows, hitCap } = await fetchIndexedNotificationBatches(ctx, access, SUMMARY_SCAN_CAP);
  const visible = rows.filter((row) => canReceiveNotification(row, access));
  const unreadCount = visible.filter((row) => !row.readAt).length;
  const hasMoreUnread = hitCap && unreadCount > 0;

  return {
    unreadCount,
    ...(hasMoreUnread ? { hasMoreUnread: true as const } : {}),
  };
}
