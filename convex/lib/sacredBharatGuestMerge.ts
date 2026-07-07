import type { MutationCtx } from "../_generated/server";
import { normalizeVisitedSet } from "./sacredBharatScoring";

export type WishlistItemInput = {
  itemType: "temple" | "trail";
  itemId: string;
};

export function dedupeWishlistItems(items: WishlistItemInput[]): WishlistItemInput[] {
  const seen = new Set<string>();
  const result: WishlistItemInput[] = [];
  for (const item of items) {
    const key = `${item.itemType}:${item.itemId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
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
  const validIds = [...normalizeVisitedSet(args.templeIds)];
  await mergeGuestVisits(ctx, authUserId, validIds, timestamps.visitedAt);
  if (args.wishlist?.length) {
    await mergeGuestWishlist(ctx, authUserId, args.wishlist, timestamps.createdAt);
  }
}
