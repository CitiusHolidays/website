"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { clearGuestDraft, readGuestDraft, writeGuestDraft } from "./guestStorage";
import { computeProgress } from "./scoring";

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
    if (!isAuthenticated || !guestHydrated || mergeAttempted.current) return;
    const draft = readGuestDraft();
    if (draft.templeIds.length === 0) return;

    mergeAttempted.current = true;
    mergeGuestMutation({ templeIds: draft.templeIds })
      .then(() => {
        clearGuestDraft();
        setGuestTempleIds([]);
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
          wishlist: serverProgress.wishlist ?? [],
          visits: serverProgress.visits ?? [],
        }
      : {
          ...computeProgress(visitedTempleIds),
          wishlist: guestWishlist,
          visits: [],
        };

  const persistGuest = (templeIds, wishlist = guestWishlist) => {
    setGuestTempleIds(templeIds);
    writeGuestDraft({ templeIds, wishlist });
  };

  const markVisited = async (templeId) => {
    if (isAuthenticated) {
      await markVisitedMutation({ templeId });
      return;
    }
    if (!visitedTempleIds.includes(templeId)) {
      persistGuest([...visitedTempleIds, templeId]);
    }
  };

  const unmarkVisited = async (templeId) => {
    if (isAuthenticated) {
      await unmarkVisitedMutation({ templeId });
      return;
    }
    persistGuest(visitedTempleIds.filter((id) => id !== templeId));
  };

  const toggleVisited = async (templeId) => {
    if (visitedTempleIds.includes(templeId)) {
      await unmarkVisited(templeId);
    } else {
      await markVisited(templeId);
    }
  };

  const toggleWishlist = async (itemType, itemId) => {
    if (isAuthenticated) {
      await toggleWishlistMutation({ itemType, itemId });
      return;
    }
    const key = `${itemType}:${itemId}`;
    const exists = guestWishlist.some((w) => `${w.itemType}:${w.itemId}` === key);
    const next = exists
      ? guestWishlist.filter((w) => `${w.itemType}:${w.itemId}` !== key)
      : [...guestWishlist, { itemType, itemId }];
    setGuestWishlist(next);
    writeGuestDraft({ templeIds: guestTempleIds, wishlist: next });
  };

  const isWishlisted = (itemType, itemId) =>
    progress.wishlist?.some((w) => w.itemType === itemType && w.itemId === itemId) ?? false;

  const isLoading =
    authLoading ||
    (!guestHydrated && !isAuthenticated) ||
    (isAuthenticated && serverProgress === undefined);

  return {
    isAuthenticated,
    isLoading,
    visitedTempleIds,
    progress,
    markVisited,
    unmarkVisited,
    toggleVisited,
    toggleWishlist,
    isWishlisted,
  };
}
