"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { resolveCanonicalTempleId } from "../../data/sacredBharat/templeAliases.js";
import {
  combineGuestAndServerProgress,
  hasGuestProgressDraft,
  mergeGuestProgressDraft,
  shouldStartGuestMerge,
} from "./guestMergeClient";
import {
  clearGuestDraft,
  normalizeGuestWishlist,
  readGuestDraft,
  writeGuestDraft,
} from "./guestStorage";
import { computeProgress } from "./scoring";

async function performObservableGuestMerge(mergeGuestMutation, update) {
  const draft = readGuestDraft();
  if (!hasGuestProgressDraft(draft)) {
    update.setMergeStatus("idle");
    return false;
  }
  update.setMergeSnapshot(null);
  update.setMergeStatus("syncing");
  const outcome = await mergeGuestProgressDraft({
    clearDraft: clearGuestDraft,
    draft,
    merge: mergeGuestMutation,
  });
  if (outcome.status === "success") {
    update.setGuestTempleIds([]);
    update.setGuestWishlist([]);
    update.setMergeSnapshot(outcome.progress);
    update.setMergeStatus("success");
    return true;
  }
  update.setMergeStatus("error");
  return false;
}

export function useSacredBharat() {
  const { isAuthenticated } = useConvexAuth();
  const serverProgress = useQuery(api.sacredBharat.getMyProgress, isAuthenticated ? {} : "skip");
  const markVisitedMutation = useMutation(api.sacredBharat.markTempleVisited);
  const unmarkVisitedMutation = useMutation(api.sacredBharat.unmarkTempleVisited);
  const mergeGuestMutation = useMutation(api.sacredBharat.mergeGuestProgress);
  const toggleWishlistMutation = useMutation(api.sacredBharat.toggleWishlistItem);

  const [guestTempleIds, setGuestTempleIds] = useState([]);
  const [guestWishlist, setGuestWishlist] = useState([]);
  const [guestHydrated, setGuestHydrated] = useState(false);
  const [mergeAuthState, setMergeAuthState] = useState(isAuthenticated);
  const [mergeSnapshot, setMergeSnapshot] = useState(null);
  const [mergeStatus, setMergeStatus] = useState("idle");
  const autoMergeStarted = useRef(false);

  if (mergeAuthState !== isAuthenticated) {
    setMergeAuthState(isAuthenticated);
    setMergeSnapshot(null);
    setMergeStatus("idle");
  }

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
    if (!isAuthenticated) {
      autoMergeStarted.current = false;
      return;
    }
    const draft = readGuestDraft();
    if (
      !shouldStartGuestMerge({
        draft,
        guestHydrated,
        isAuthenticated,
        mergeStarted: autoMergeStarted.current,
      })
    ) {
      return;
    }
    autoMergeStarted.current = true;
    performObservableGuestMerge(mergeGuestMutation, {
      setGuestTempleIds,
      setGuestWishlist,
      setMergeSnapshot,
      setMergeStatus,
    }).catch(() => undefined);
  }, [guestHydrated, isAuthenticated, mergeGuestMutation]);

  let mergeSnapshotArrived = false;
  if (mergeSnapshot && serverProgress) {
    const serverTempleIds = new Set(serverProgress.visitedTempleIds ?? []);
    const serverWishlistKeys = new Set(
      (serverProgress.wishlist ?? []).map((item) => `${item.itemType}:${item.itemId}`)
    );
    mergeSnapshotArrived =
      (mergeSnapshot.visitedTempleIds ?? []).every((id) => serverTempleIds.has(id)) &&
      (mergeSnapshot.wishlist ?? []).every((item) =>
        serverWishlistKeys.has(`${item.itemType}:${item.itemId}`)
      );
  }
  const activeMergeSnapshot = mergeSnapshotArrived ? null : mergeSnapshot;

  const combinedProgress = combineGuestAndServerProgress({
    guestTempleIds,
    guestWishlist,
    serverTempleIds: isAuthenticated ? (serverProgress?.visitedTempleIds ?? []) : [],
    serverWishlist: isAuthenticated ? (serverProgress?.wishlist ?? []) : [],
    snapshotTempleIds: isAuthenticated ? (activeMergeSnapshot?.visitedTempleIds ?? []) : [],
    snapshotWishlist: isAuthenticated ? (activeMergeSnapshot?.wishlist ?? []) : [],
  });
  const { visitedTempleIds, wishlist: visibleWishlist } = combinedProgress;

  const progress = {
    ...computeProgress(visitedTempleIds),
    visits: serverProgress?.visits ?? activeMergeSnapshot?.visits ?? [],
    wishlist: visibleWishlist,
  };

  const persistGuest = (templeIds, wishlist = guestWishlist) => {
    setGuestTempleIds(templeIds);
    writeGuestDraft({ templeIds, wishlist });
  };

  const markVisited = async (templeId) => {
    const canonicalId = resolveCanonicalTempleId(templeId);
    if (isAuthenticated) {
      setMergeSnapshot(null);
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
      setMergeSnapshot(null);
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
    const [normalizedItem] = normalizeGuestWishlist([{ itemId, itemType }]);
    if (!normalizedItem) {
      return;
    }
    if (isAuthenticated) {
      setMergeSnapshot(null);
      await toggleWishlistMutation(normalizedItem);
      return;
    }
    const key = `${normalizedItem.itemType}:${normalizedItem.itemId}`;
    const exists = guestWishlist.some((item) => `${item.itemType}:${item.itemId}` === key);
    const next = exists
      ? guestWishlist.filter((item) => `${item.itemType}:${item.itemId}` !== key)
      : normalizeGuestWishlist([...guestWishlist, normalizedItem]);
    setGuestWishlist(next);
    writeGuestDraft({ templeIds: guestTempleIds, wishlist: next });
  };

  const isWishlisted = (itemType, itemId) => {
    const [normalizedItem] = normalizeGuestWishlist([{ itemId, itemType }]);
    if (!normalizedItem) {
      return false;
    }
    return visibleWishlist.some(
      (item) => item.itemType === normalizedItem.itemType && item.itemId === normalizedItem.itemId
    );
  };

  return {
    hasGuestDraft: hasGuestProgressDraft({ templeIds: guestTempleIds, wishlist: guestWishlist }),
    isAuthenticated,
    isLoading: !guestHydrated,
    isWishlisted,
    markVisited,
    mergeStatus: isAuthenticated ? mergeStatus : "idle",
    progress,
    retryGuestMerge: () =>
      performObservableGuestMerge(mergeGuestMutation, {
        setGuestTempleIds,
        setGuestWishlist,
        setMergeSnapshot,
        setMergeStatus,
      }),
    toggleVisited,
    toggleWishlist,
    unmarkVisited,
    visitedTempleIds,
  };
}
