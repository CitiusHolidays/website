"use client";

import { useSyncExternalStore } from "react";

const subscribers = new Set<() => void>();
const activeWaits = new Set<symbol>();
let activeMessage = "";

function emitChange() {
  for (const subscriber of subscribers) {
    subscriber();
  }
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function beginPortalLoading(message = "Loading Staff Workspace view") {
  const wait = Symbol(message);
  const isFirstWait = activeWaits.size === 0;
  activeWaits.add(wait);
  if (isFirstWait) {
    activeMessage = message;
    emitChange();
  }
  return wait;
}

export function endPortalLoading(wait: symbol) {
  activeWaits.delete(wait);
  if (activeWaits.size === 0 && activeMessage) {
    activeMessage = "";
    emitChange();
  }
}

export function PortalLoadingAnnouncement() {
  const message = useSyncExternalStore(
    subscribe,
    () => activeMessage,
    () => ""
  );
  return (
    <span aria-atomic="true" aria-live="polite" className="sr-only" data-portal-loading-announcer>
      {message}
    </span>
  );
}
