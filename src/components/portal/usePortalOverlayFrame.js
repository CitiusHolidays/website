"use client";

import { useSyncExternalStore } from "react";
import { PORTAL_Z_INDEX } from "@/lib/portal/zIndex";

const DESKTOP_QUERY = "(min-width: 1024px)";
const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SERVER_MEDIA_SNAPSHOT = "false:false";

function getMediaSnapshot() {
  if (typeof window === "undefined") {
    return SERVER_MEDIA_SNAPSHOT;
  }
  return `${window.matchMedia(DESKTOP_QUERY).matches}:${window.matchMedia(REDUCE_MOTION_QUERY).matches}`;
}

function subscribeToMediaState(onStoreChange) {
  const sidebarQuery = window.matchMedia(DESKTOP_QUERY);
  const motionQuery = window.matchMedia(REDUCE_MOTION_QUERY);
  sidebarQuery.addEventListener("change", onStoreChange);
  motionQuery.addEventListener("change", onStoreChange);
  return () => {
    sidebarQuery.removeEventListener("change", onStoreChange);
    motionQuery.removeEventListener("change", onStoreChange);
  };
}

export function usePortalOverlayFrame({ panelTop = "calc(4rem + 1.5rem)" } = {}) {
  const mediaSnapshot = useSyncExternalStore(
    subscribeToMediaState,
    getMediaSnapshot,
    () => SERVER_MEDIA_SNAPSHOT
  );
  const [hasDesktopSidebar, reduceMotion] = mediaSnapshot
    .split(":")
    .map((value) => value === "true");
  const left = hasDesktopSidebar ? "16rem" : "0px";
  const backdropFilter = reduceMotion ? "none" : "blur(10px)";

  return {
    backdropStyle: {
      backdropFilter,
      background: reduceMotion ? "rgb(15 23 42 / 0.28)" : "rgb(15 23 42 / 0.14)",
      border: 0,
      bottom: 0,
      cursor: "default",
      left,
      position: "fixed",
      right: 0,
      top: "4rem",
      WebkitBackdropFilter: backdropFilter,
      zIndex: PORTAL_Z_INDEX.commandPalette,
    },
    panelStyle: {
      left,
      paddingInline: "0.75rem",
      pointerEvents: "none",
      position: "fixed",
      right: 0,
      top: panelTop,
      zIndex: PORTAL_Z_INDEX.commandPalette,
    },
  };
}
