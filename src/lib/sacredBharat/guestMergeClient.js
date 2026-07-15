import { resolveCanonicalTempleId } from "../../data/sacredBharat/templeAliases.js";
import { normalizeGuestWishlist } from "./guestStorage";

export function hasGuestProgressDraft(draft) {
  return (draft.templeIds?.length ?? 0) > 0 || (draft.wishlist?.length ?? 0) > 0;
}

export function shouldStartGuestMerge({ draft, guestHydrated, isAuthenticated, mergeStarted }) {
  return isAuthenticated && guestHydrated && !mergeStarted && hasGuestProgressDraft(draft);
}

export function combineGuestAndServerProgress({
  guestTempleIds = [],
  guestWishlist = [],
  serverTempleIds = [],
  serverWishlist = [],
  snapshotTempleIds = [],
  snapshotWishlist = [],
}) {
  return {
    visitedTempleIds: [
      ...new Set(
        [...serverTempleIds, ...guestTempleIds, ...snapshotTempleIds].flatMap((templeId) => {
          const canonicalId = resolveCanonicalTempleId(templeId);
          return canonicalId ? [canonicalId] : [];
        })
      ),
    ],
    wishlist: normalizeGuestWishlist([...serverWishlist, ...guestWishlist, ...snapshotWishlist]),
  };
}

export async function mergeGuestProgressDraft({ clearDraft, draft, merge }) {
  if (!hasGuestProgressDraft(draft)) {
    return { progress: null, status: "empty" };
  }
  try {
    const progress = await merge({
      templeIds: draft.templeIds,
      wishlist: draft.wishlist,
    });
    clearDraft();
    return { progress, status: "success" };
  } catch {
    return { progress: null, status: "error" };
  }
}
