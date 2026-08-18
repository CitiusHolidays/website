import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const NOTIFICATION_UNREAD_PROJECTION_VERSION = 1;
export const NOTIFICATION_UNREAD_READINESS_KEY = "notificationUnread";

type NotificationTarget = Pick<
  Doc<"notifications">,
  "recipientRole" | "recipientStaffId" | "recipientUserId"
>;

export interface NotificationProjectionAccess {
  authUserId?: string | null;
  roles: string[];
  staffId?: Id<"staffUsers"> | null;
}

type NotificationReadIdentity = Pick<Doc<"notificationReads">, "authUserId" | "staffId">;

function projectionKey(parts: string[]) {
  return JSON.stringify([NOTIFICATION_UNREAD_PROJECTION_VERSION, ...parts]);
}

/**
 * Match the effective constraints in canReceiveNotification. A staff target
 * survives auth relink; a role paired with staff/user remains an intersection.
 */
export function notificationTargetProjectionKey(target: NotificationTarget) {
  const staffId = target.recipientStaffId ? String(target.recipientStaffId) : "";
  const userId = target.recipientUserId ?? "";
  const role = target.recipientRole ?? "";
  if (staffId) {
    return role ? projectionKey(["staffRole", staffId, role]) : projectionKey(["staff", staffId]);
  }
  if (userId) {
    return role ? projectionKey(["userRole", userId, role]) : projectionKey(["user", userId]);
  }
  return role ? projectionKey(["role", role]) : projectionKey(["all"]);
}

export function notificationIdentityProjectionKey(identity: NotificationReadIdentity) {
  if (identity.staffId) {
    return projectionKey(["staff", String(identity.staffId)]);
  }
  if (identity.authUserId) {
    return projectionKey(["user", identity.authUserId]);
  }
  throw new ConvexError("NOTIFICATION_READ_IDENTITY_REQUIRED");
}

export function notificationTargetProjectionKeysForAccess(access: NotificationProjectionAccess) {
  const keys = new Set<string>([projectionKey(["all"])]);
  if (access.staffId) {
    const staffId = String(access.staffId);
    keys.add(projectionKey(["staff", staffId]));
    for (const role of access.roles) {
      keys.add(projectionKey(["staffRole", staffId, role]));
    }
  }
  if (access.authUserId) {
    keys.add(projectionKey(["user", access.authUserId]));
    for (const role of access.roles) {
      keys.add(projectionKey(["userRole", access.authUserId, role]));
    }
  }
  for (const role of access.roles) {
    keys.add(projectionKey(["role", role]));
  }
  return Array.from(keys);
}

function notificationReadTargetProjectionKey(identityKey: string, targetKey: string) {
  return projectionKey(["read", identityKey, targetKey]);
}

function checkedCounter(current: number, delta: number) {
  const next = current + delta;
  if (!(Number.isSafeInteger(delta) && Number.isSafeInteger(next)) || next < 0) {
    throw new ConvexError("NOTIFICATION_UNREAD_PROJECTION_INVALID");
  }
  return next;
}

const projectionUpdateQueues = new WeakMap<MutationCtx, Map<string, Promise<unknown>>>();

async function serializeProjectionUpdate<Result>(
  ctx: MutationCtx,
  key: string,
  operation: () => Promise<Result>
) {
  let queue = projectionUpdateQueues.get(ctx);
  if (!queue) {
    queue = new Map();
    projectionUpdateQueues.set(ctx, queue);
  }
  const previous = queue.get(key) ?? Promise.resolve();
  const current = previous.then(operation, operation);
  queue.set(key, current);
  try {
    return await current;
  } finally {
    if (queue.get(key) === current) {
      queue.delete(key);
      if (queue.size === 0) {
        projectionUpdateQueues.delete(ctx);
      }
    }
  }
}

export async function adjustNotificationTargetCount(
  ctx: MutationCtx,
  targetKey: string,
  delta: number,
  updatedAt: number
) {
  await serializeProjectionUpdate(ctx, `target:${targetKey}`, async () => {
    const existing = await ctx.db
      .query("notificationTargetCounts")
      .withIndex("by_key", (q) => q.eq("key", targetKey))
      .unique();
    if (!existing && delta <= 0) {
      throw new ConvexError("NOTIFICATION_UNREAD_TARGET_MISSING");
    }
    const value = {
      key: targetKey,
      total: checkedCounter(existing?.total ?? 0, delta),
      updatedAt: Math.max(existing?.updatedAt ?? 0, updatedAt),
      version: NOTIFICATION_UNREAD_PROJECTION_VERSION,
    };
    if (existing) {
      await ctx.db.patch("notificationTargetCounts", existing._id, value);
    } else {
      await ctx.db.insert("notificationTargetCounts", value);
    }
  });
}

export async function adjustNotificationReadTargetCount(
  ctx: MutationCtx,
  identityKey: string,
  targetKey: string,
  delta: number,
  updatedAt: number
) {
  const key = notificationReadTargetProjectionKey(identityKey, targetKey);
  await serializeProjectionUpdate(ctx, `read:${key}`, async () => {
    const existing = await ctx.db
      .query("notificationReadTargetCounts")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!existing && delta <= 0) {
      throw new ConvexError("NOTIFICATION_UNREAD_READ_TARGET_MISSING");
    }
    const value = {
      identityKey,
      key,
      readCount: checkedCounter(existing?.readCount ?? 0, delta),
      targetKey,
      updatedAt: Math.max(existing?.updatedAt ?? 0, updatedAt),
      version: NOTIFICATION_UNREAD_PROJECTION_VERSION,
    };
    if (existing) {
      await ctx.db.patch("notificationReadTargetCounts", existing._id, value);
    } else {
      await ctx.db.insert("notificationReadTargetCounts", value);
    }
  });
}

export async function projectNotificationInsert(
  ctx: MutationCtx,
  notification: NotificationTarget & { createdAt: number }
) {
  const projectionTargetKey = notificationTargetProjectionKey(notification);
  await adjustNotificationTargetCount(ctx, projectionTargetKey, 1, notification.createdAt);
  return {
    projectionTargetKey,
    projectionVersion: NOTIFICATION_UNREAD_PROJECTION_VERSION,
  };
}

export async function projectNotificationReceipt(
  ctx: MutationCtx,
  notification: NotificationTarget,
  receipt: NotificationReadIdentity & { readAt: number }
) {
  const projectionIdentityKey = notificationIdentityProjectionKey(receipt);
  const projectionTargetKey = notificationTargetProjectionKey(notification);
  await adjustNotificationReadTargetCount(
    ctx,
    projectionIdentityKey,
    projectionTargetKey,
    1,
    receipt.readAt
  );
  return {
    projectionIdentityKey,
    projectionTargetKey,
    projectionVersion: NOTIFICATION_UNREAD_PROJECTION_VERSION,
  };
}

export async function unprojectNotificationReceipt(
  ctx: MutationCtx,
  receipt: Doc<"notificationReads">
) {
  if (
    receipt.projectionVersion !== NOTIFICATION_UNREAD_PROJECTION_VERSION ||
    !receipt.projectionIdentityKey ||
    !receipt.projectionTargetKey
  ) {
    return;
  }
  await adjustNotificationReadTargetCount(
    ctx,
    receipt.projectionIdentityKey,
    receipt.projectionTargetKey,
    -1,
    Date.now()
  );
}

export async function unprojectNotification(ctx: MutationCtx, notification: Doc<"notifications">) {
  if (
    notification.projectionVersion !== NOTIFICATION_UNREAD_PROJECTION_VERSION ||
    !notification.projectionTargetKey
  ) {
    return;
  }
  await adjustNotificationTargetCount(ctx, notification.projectionTargetKey, -1, Date.now());
}

export async function deleteNotificationReadWithProjection(
  ctx: MutationCtx,
  receipt: Doc<"notificationReads">
) {
  await unprojectNotificationReceipt(ctx, receipt);
  await ctx.db.delete("notificationReads", receipt._id);
}

export async function deleteNotificationWithProjection(
  ctx: MutationCtx,
  notification: Doc<"notifications">
) {
  const receipts = await ctx.db
    .query("notificationReads")
    .withIndex("by_notificationId", (q) => q.eq("notificationId", notification._id))
    .collect();
  for (const receipt of receipts) {
    // Several receipts may share one role-target counter and must decrement in order.
    // biome-ignore lint/performance/noAwaitInLoops: ordered projection updates prevent lost deltas
    await deleteNotificationReadWithProjection(ctx, receipt);
  }
  await unprojectNotification(ctx, notification);
  await ctx.db.delete("notifications", notification._id);
}

export async function notificationUnreadProjectionIsReady(ctx: QueryCtx | MutationCtx) {
  const readiness = await ctx.db
    .query("notificationUnreadProjectionReadiness")
    .withIndex("by_key", (q) => q.eq("key", NOTIFICATION_UNREAD_READINESS_KEY))
    .unique();
  return Boolean(
    readiness?.ready &&
      readiness.status === "complete" &&
      readiness.version === NOTIFICATION_UNREAD_PROJECTION_VERSION
  );
}

export async function notificationUnreadSummaryFromProjection(
  ctx: QueryCtx,
  access: NotificationProjectionAccess
) {
  if (!(await notificationUnreadProjectionIsReady(ctx))) {
    return null;
  }
  const identityKey = notificationIdentityProjectionKey({
    authUserId: access.authUserId ?? undefined,
    staffId: access.staffId ?? undefined,
  });
  const targetKeys = notificationTargetProjectionKeysForAccess(access);
  const rows = await Promise.all(
    targetKeys.map(async (targetKey) => {
      const readKey = notificationReadTargetProjectionKey(identityKey, targetKey);
      const [target, reads] = await Promise.all([
        ctx.db
          .query("notificationTargetCounts")
          .withIndex("by_key", (q) => q.eq("key", targetKey))
          .unique(),
        ctx.db
          .query("notificationReadTargetCounts")
          .withIndex("by_key", (q) => q.eq("key", readKey))
          .unique(),
      ]);
      const total = target?.total ?? 0;
      const readCount = reads?.readCount ?? 0;
      if (readCount > total) {
        return null;
      }
      return total - readCount;
    })
  );
  if (rows.some((row) => row === null)) {
    return null;
  }
  return {
    coverage: "complete" as const,
    unreadCount: rows.reduce<number>((total, row) => total + (row ?? 0), 0),
  };
}
