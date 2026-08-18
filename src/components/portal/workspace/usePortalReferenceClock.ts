import { useEffect, useState } from "react";

export const OPERATION_REFERENCE_TICK_MS = 30_000;

export function localIsoDate(referenceNow: number) {
  const date = new Date(referenceNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function millisecondsUntilNextLocalDay(referenceNow: number) {
  const date = new Date(referenceNow);
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return Math.max(1, nextDay.getTime() - referenceNow);
}

/**
 * Owns a coarse time input only while a time-sensitive operation surface is visible.
 * Closing the surface tears down the timer immediately.
 */
export function useActiveOperationReferenceNow(active: boolean) {
  const [referenceNow, setReferenceNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    const refresh = () => setReferenceNow(Date.now());
    refresh();
    const interval = globalThis.setInterval(refresh, OPERATION_REFERENCE_TICK_MS);
    return () => globalThis.clearInterval(interval);
  }, [active]);

  return referenceNow;
}

/** Refreshes a date-only query input at the next local day boundary while its route is active. */
export function useActiveLocalReferenceDate(active: boolean) {
  const [referenceDate, setReferenceDate] = useState(() => localIsoDate(Date.now()));

  useEffect(() => {
    if (!active) {
      return;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const referenceNow = Date.now();
      setReferenceDate(localIsoDate(referenceNow));
      timeout = globalThis.setTimeout(refresh, millisecondsUntilNextLocalDay(referenceNow));
    };
    refresh();
    return () => {
      if (timeout !== undefined) {
        globalThis.clearTimeout(timeout);
      }
    };
  }, [active]);

  return referenceDate;
}
