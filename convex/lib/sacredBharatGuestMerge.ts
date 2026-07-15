import type { MutationCtx } from "../_generated/server";
import { resolveCanonicalTempleId } from "./sacredBharatAliases";
import { normalizeVisitedSet } from "./sacredBharatScoring";

export interface WishlistItemInput {
  itemId: string;
  itemType: "temple" | "trail";
}

export function dedupeWishlistItems(items: WishlistItemInput[]): WishlistItemInput[] {
  const seen = new Set<string>();
  const result: WishlistItemInput[] = [];
  for (const item of items) {
    const itemId =
      item.itemType === "temple" ? resolveCanonicalTempleId(item.itemId) : item.itemId.trim();
    if (!itemId) {
      continue;
    }
    const key = `${item.itemType}:${itemId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ itemId, itemType: item.itemType });
  }
  return result;
}

async function canonicalizeExistingVisits(ctx: MutationCtx, authUserId: string): Promise<void> {
  const existingVisits = await ctx.db
    .query("sacredBharatVisits")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .collect();
  const seen = new Set<string>();
  const operations: Promise<unknown>[] = [];
  for (const visit of existingVisits) {
    const [canonicalId] = normalizeVisitedSet([visit.templeId]);
    if (!canonicalId) {
      continue;
    }
    if (seen.has(canonicalId)) {
      operations.push(ctx.db.delete(visit._id));
      continue;
    }
    seen.add(canonicalId);
    if (visit.templeId !== canonicalId) {
      operations.push(ctx.db.patch(visit._id, { templeId: canonicalId }));
    }
  }
  await Promise.all(operations);
}

async function canonicalizeExistingWishlist(ctx: MutationCtx, authUserId: string): Promise<void> {
  const existingItems = await ctx.db
    .query("sacredBharatWishlist")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .collect();
  const seen = new Set<string>();
  const operations: Promise<unknown>[] = [];
  for (const item of existingItems) {
    const itemId = item.itemType === "temple" ? resolveCanonicalTempleId(item.itemId) : item.itemId;
    const key = `${item.itemType}:${itemId}`;
    if (seen.has(key)) {
      operations.push(ctx.db.delete(item._id));
      continue;
    }
    seen.add(key);
    if (item.itemId !== itemId) {
      operations.push(ctx.db.patch(item._id, { itemId }));
    }
  }
  await Promise.all(operations);
}

async function mergeGuestVisits(
  ctx: MutationCtx,
  authUserId: string,
  templeIds: string[],
  visitedAt: number
): Promise<void> {
  await Promise.all(
    templeIds.map(async (templeId) => {
      const existing = await ctx.db
        .query("sacredBharatVisits")
        .withIndex("by_authUserId_templeId", (q) =>
          q.eq("authUserId", authUserId).eq("templeId", templeId)
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("sacredBharatVisits", {
          authUserId,
          templeId,
          visitedAt,
        });
      }
    })
  );
}

export async function mergeGuestWishlist(
  ctx: MutationCtx,
  authUserId: string,
  wishlist: WishlistItemInput[],
  createdAt: number
): Promise<void> {
  const deduped = dedupeWishlistItems(wishlist);
  await Promise.all(
    deduped.map(async (item) => {
      const existing = await ctx.db
        .query("sacredBharatWishlist")
        .withIndex("by_authUserId_item", (q) =>
          q.eq("authUserId", authUserId).eq("itemType", item.itemType).eq("itemId", item.itemId)
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("sacredBharatWishlist", {
          authUserId,
          createdAt,
          itemId: item.itemId,
          itemType: item.itemType,
        });
      }
    })
  );
}

export async function applyGuestProgressMerge(
  ctx: MutationCtx,
  authUserId: string,
  args: { templeIds: string[]; wishlist?: WishlistItemInput[] },
  timestamps: { visitedAt: number; createdAt: number }
): Promise<void> {
  await Promise.all([
    canonicalizeExistingVisits(ctx, authUserId),
    canonicalizeExistingWishlist(ctx, authUserId),
  ]);
  const validIds = [...normalizeVisitedSet(args.templeIds)];
  await mergeGuestVisits(ctx, authUserId, validIds, timestamps.visitedAt);
  if (args.wishlist?.length) {
    await mergeGuestWishlist(ctx, authUserId, args.wishlist, timestamps.createdAt);
  }
}
