import { resolveCanonicalTempleId } from "../../data/sacredBharat/templeAliases.js";

const SACRED_BHARAT_DRAFT_KEY = "citius-sacred-bharat-draft";

function normalizeDraftTempleIds(templeIds) {
  return [
    ...new Set(
      (templeIds ?? []).flatMap((id) => {
        const resolved = resolveCanonicalTempleId(id);
        return resolved ? [resolved] : [];
      })
    ),
  ];
}

export function normalizeGuestWishlist(items) {
  const seen = new Set();
  return (items ?? []).flatMap((item) => {
    if (!(item && (item.itemType === "temple" || item.itemType === "trail"))) {
      return [];
    }
    const itemId = String(item.itemId ?? "").trim();
    const canonicalItemId = item.itemType === "temple" ? resolveCanonicalTempleId(itemId) : itemId;
    if (!canonicalItemId) {
      return [];
    }
    const key = `${item.itemType}:${canonicalItemId}`;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [{ itemId: canonicalItemId, itemType: item.itemType }];
  });
}

/**
 * @returns {{ templeIds: string[], wishlist: { itemType: string, itemId: string }[] }}
 */
export function readGuestDraft() {
  if (typeof window === "undefined") {
    return { templeIds: [], wishlist: [] };
  }
  try {
    const raw = window.localStorage.getItem(SACRED_BHARAT_DRAFT_KEY);
    if (!raw) {
      return { templeIds: [], wishlist: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      templeIds: normalizeDraftTempleIds(Array.isArray(parsed.templeIds) ? parsed.templeIds : []),
      wishlist: normalizeGuestWishlist(Array.isArray(parsed.wishlist) ? parsed.wishlist : []),
    };
  } catch {
    return { templeIds: [], wishlist: [] };
  }
}

/**
 * @param {{ templeIds?: string[], wishlist?: { itemType: string, itemId: string }[] }} draft
 */
export function writeGuestDraft(draft) {
  if (typeof window === "undefined") {
    return;
  }
  const current = readGuestDraft();
  window.localStorage.setItem(
    SACRED_BHARAT_DRAFT_KEY,
    JSON.stringify({
      templeIds: normalizeDraftTempleIds(draft.templeIds ?? current.templeIds),
      wishlist: normalizeGuestWishlist(draft.wishlist ?? current.wishlist),
    })
  );
}

export function clearGuestDraft() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SACRED_BHARAT_DRAFT_KEY);
}
