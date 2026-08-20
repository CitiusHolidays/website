"use client";

import { useSyncExternalStore } from "react";

const PRERENDER_YEAR = 2026;

export function useCurrentYear() {
  return useSyncExternalStore(
    () => () => undefined,
    () => new Date().getFullYear(),
    () => PRERENDER_YEAR
  );
}
