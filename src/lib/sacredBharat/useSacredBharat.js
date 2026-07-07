"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { clearGuestDraft, readGuestDraft, writeGuestDraft } from "./guestStorage";
import { computeProgress } from "./scoring";
import { resolveCanonicalTempleId } from "../../data/sacredBharat/templeAliases.js";

export function useSacredBharat() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const serverProgress = useQuery(api.sacredBharat.getMyProgress, isAuthenticated ? {} : "skip");
  const markVisitedMutation = useMutation(api.sacredBharat.markTempleVisited);
  const unmarkVisitedMutation = useMutation(api.sacredBharat.unmarkTempleVisited);
  const mergeGuestMutation = useMutation(api.sacredBharat.mergeGuestProgress);
  const toggleWishlistMutation = useMutation(api.sacredBharat.toggleWishlistItem);

  const [guestTempleIds, setGuestTempleIds] = useState([]);
  const [guestWishlist, setGuestWishlist] = useState([]);
  const [guestHydrated, setGuestHydrated] = useState(false);
  const mergeAttempted = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const draft = readGuestDraft();
      setGuestTempleIds(draft.templeIds);
      setGuestWishlist(draft.wishlist);
      setGuestHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!(isAuthenticated && guestHydrated) || mergeAttempted.current) {
      return;
    }
    const draft = readGuestDraft();
    if (draft.templeIds.length === 0 && draft.wishlist.length === 0) {
      return;
    }

    mergeAttempted.current = true;
    mergeGuestMutation({ templeIds: draft.templeIds, wishlist: draft.wishlist })
      .then(() => {
        clearGuestDraft();
        setGuestTempleIds([]);
        setGuestWishlist([]);
      })
      .catch(() => {
        mergeAttempted.current = false;
      });
  }, [isAuthenticated, guestHydrated, mergeGuestMutation]);

  const visitedTempleIds =
    isAuthenticated && serverProgress ? (serverProgress.visitedTempleIds ?? []) : guestTempleIds;

  const progress =
    isAuthenticated && serverProgress
      ? {
          ...computeProgress(visitedTempleIds),
          visits: serverProgress.visits ?? [],
          wishlist: serverProgress.wishlist ?? [],
        }
      : {
          ...computeProgress(visitedTempleIds),
          visits: [],
          wishlist: guestWishlist,
        };

  const persistGuest = (templeIds, wishlist = guestWishlist) => {
    setGuestTempleIds(templeIds);
    writeGuestDraft({ templeIds, wishlist });
  };

  const markVisited = async (templeId) => {
    const canonicalId = resolveCanonicalTempleId(templeId);
    if (isAuthenticated) {
      await markVisitedMutation({ templeId: canonicalId });
      return;
    }
    if (!visitedTempleIds.includes(canonicalId)) {
      persistGuest([...visitedTempleIds, canonicalId]);
    }
  };

  const unmarkVisited = async (templeId) => {
    const canonicalId = resolveCanonicalTempleId(templeId);
    if (isAuthenticated) {
      await unmarkVisitedMutation({ templeId: canonicalId });
      return;
    }
    persistGuest(visitedTempleIds.filter((id) => id !== canonicalId));
  };

  const toggleVisited = async (templeId) => {
    const canonicalId = resolveCanonicalTempleId(templeId);
    if (visitedTempleIds.includes(canonicalId)) {
      await unmarkVisited(canonicalId);
    } else {
      await markVisited(canonicalId);
    }
  };

  const toggleWishlist = async (itemType, itemId) => {
    if (isAuthenticated) {
      await toggleWishlistMutation({ itemId, itemType });
      return;
    }
    const key = `${itemType}:${itemId}`;
    const exists = guestWishlist.some((w) => `${w.itemType}:${w.itemId}` === key);
    const next = exists
      ? guestWishlist.filter((w) => `${w.itemType}:${w.itemId}` !== key)
      : [...guestWishlist, { itemId, itemType }];
    setGuestWishlist(next);
    writeGuestDraft({ templeIds: guestTempleIds, wishlist: next });
  };

  const isWishlisted = (itemType, itemId) =>
    progress.wishlist?.some((w) => w.itemType === itemType && w.itemId === itemId) ?? false;

  const isLoading =
    authLoading ||
    !(guestHydrated || isAuthenticated) ||
    (isAuthenticated && serverProgress === undefined);

  return {
    isAuthenticated,
    isLoading,
    isWishlisted,
    markVisited,
    progress,
    toggleVisited,
    toggleWishlist,
    unmarkVisited,
    visitedTempleIds,
  };
}
