"use client";

import { useSyncExternalStore } from "react";
import {
  getPortalLoadingMessage,
  subscribeToPortalLoading,
} from "@/components/portal/portalLoadingStore";

export function PortalLoadingAnnouncement() {
  const message = useSyncExternalStore(subscribeToPortalLoading, getPortalLoadingMessage, () => "");
  return (
    <span aria-atomic="true" aria-live="polite" className="sr-only" data-portal-loading-announcer>
      {message}
    </span>
  );
}
