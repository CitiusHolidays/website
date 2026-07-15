import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";

export const NOTIFICATION_CLEANUP_PAGE_SIZE = 64;
export const NOTIFICATION_ENTITY_GROUP_SIZE = 8;
export const NOTIFICATION_CLEANUP_MAX_IDENTITIES_PER_REQUEST = 32;

export type NotificationEntityIdentity = { entityId: string; entityType: string };

export function groupNotificationIdentities(identities: NotificationEntityIdentity[]) {
  const unique = Array.from(
    new Map(
      identities.map((identity) => [
        `${identity.entityType}\u0000${identity.entityId}`,
        { entityId: String(identity.entityId), entityType: identity.entityType },
      ])
    ).values()
  );
  const groups: NotificationEntityIdentity[][] = [];
  for (let index = 0; index < unique.length; index += NOTIFICATION_ENTITY_GROUP_SIZE) {
    groups.push(unique.slice(index, index + NOTIFICATION_ENTITY_GROUP_SIZE));
  }
  return groups;
}

export async function queueEntityNotificationCleanup(
  ctx: MutationCtx,
  identities: NotificationEntityIdentity[]
) {
  const groups = groupNotificationIdentities(identities);
  const identityCount = groups.reduce((total, group) => total + group.length, 0);
  if (identityCount > NOTIFICATION_CLEANUP_MAX_IDENTITIES_PER_REQUEST) {
    throw new Error(
      `Notification cleanup requests must be split into at most ${NOTIFICATION_CLEANUP_MAX_IDENTITIES_PER_REQUEST} identities`
    );
  }
  await Promise.all(
    groups.map((group) =>
      ctx.scheduler.runAfter(
        0,
        (internal as any).crm.notificationCleanup.continueEntityGroupCleanup,
        { identities: group }
      )
    )
  );
  return {
    groups: groups.length,
    identities: identityCount,
  };
}

export async function deleteNotificationPage(
  ctx: MutationCtx,
  entityType: string,
  entityId: string
) {
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_entity", (q) => q.eq("entityType", entityType).eq("entityId", entityId))
    .take(NOTIFICATION_CLEANUP_PAGE_SIZE);
  await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
  return {
    deleted: rows.length,
    hasMore: rows.length === NOTIFICATION_CLEANUP_PAGE_SIZE,
  };
}

export const continueEntityCleanup = internalMutation({
  args: { entityId: v.string(), entityType: v.string() },
  handler: async (ctx, args) => {
    const result = await deleteNotificationPage(ctx, args.entityType, args.entityId);
    if (result.hasMore) {
      await ctx.scheduler.runAfter(
        0,
        (internal as any).crm.notificationCleanup.continueEntityCleanup,
        args
      );
    }
    return result;
  },
});

export const continueEntityGroupCleanup = internalMutation({
  args: {
    identities: v.array(v.object({ entityId: v.string(), entityType: v.string() })),
  },
  handler: async (ctx, args) => {
    if (args.identities.length > NOTIFICATION_ENTITY_GROUP_SIZE) {
      throw new Error("Notification cleanup group exceeds its bounded worker size");
    }
    const current = args.identities;
    const continuations: NotificationEntityIdentity[] = [];
    const results = await Promise.all(
      current.map(async (identity) => ({
        identity,
        result: await deleteNotificationPage(ctx, identity.entityType, identity.entityId),
      }))
    );
    let deleted = 0;
    for (const { identity, result } of results) {
      deleted += result.deleted;
      if (result.hasMore) {
        continuations.push(identity);
      }
    }
    if (continuations.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        (internal as any).crm.notificationCleanup.continueEntityGroupCleanup,
        { identities: continuations }
      );
    }
    return { deleted, remainingEntities: continuations.length };
  },
});
