"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  PORTAL_COMMAND_PALETTE_PANEL_TOP,
} from "@/lib/portal/portalOverlayLayout";
import { PORTAL_Z_INDEX } from "@/lib/portal/zIndex";

const DESKTOP_QUERY = "(min-width: 1024px)";
const SERVER_MEDIA_SNAPSHOT = "false";
const EMPTY_BOUNDS = { left: 0, top: 0, width: 0 };

function getDesktopSidebarSnapshot() {
  if (typeof window === "undefined") {
    return SERVER_MEDIA_SNAPSHOT;
  }
  return String(window.matchMedia(DESKTOP_QUERY).matches);
}

function subscribeToDesktopSidebar(onStoreChange) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function usePortalMainBounds(enabled) {
  const [bounds, setBounds] = useState(EMPTY_BOUNDS);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }

    const main = document.getElementById("portal-main");
    if (!main) {
      return;
    }

    const syncBounds = () => {
      const rect = main.getBoundingClientRect();
      setBounds({
        left: rect.left,
        top: rect.top,
        width: rect.width,
      });
    };

    syncBounds();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncBounds);
    resizeObserver?.observe(main);
    window.addEventListener("resize", syncBounds);
    window.addEventListener("scroll", syncBounds, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncBounds);
      window.removeEventListener("scroll", syncBounds, true);
    };
  }, [enabled]);

  return bounds;
}

export function usePortalOverlayFrame({
  open = false,
  panelTop = PORTAL_COMMAND_PALETTE_PANEL_TOP,
} = {}) {
  const hasDesktopSidebar = useSyncExternalStore(
    subscribeToDesktopSidebar,
    getDesktopSidebarSnapshot,
    () => SERVER_MEDIA_SNAPSHOT
  ) === "true";
  const measuredBounds = usePortalMainBounds(open);
  const fallbackLeft = hasDesktopSidebar ? 256 : 0;
  const left = measuredBounds.width > 0 ? measuredBounds.left : fallbackLeft;
  const width = measuredBounds.width > 0 ? measuredBounds.width : `calc(100vw - ${fallbackLeft}px)`;
  const frameTop = measuredBounds.width > 0 ? measuredBounds.top : 68;

  return {
    backdropStyle: {
      inset: 0,
      pointerEvents: "auto",
      position: "absolute",
    },
    frameStyle: {
      bottom: 0,
      left,
      pointerEvents: "none",
      position: "fixed",
      top: frameTop,
      width,
      zIndex: PORTAL_Z_INDEX.commandPalette,
    },
    panelStyle: {
      left,
      paddingInline: "0.75rem",
      pointerEvents: "none",
      position: "fixed",
      top: panelTop,
      width,
      zIndex: PORTAL_Z_INDEX.commandPalette,
    },
  };
}
