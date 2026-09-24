import type { BoothMetric, BoothMetricEntry } from "./contracts";

/** Session-only batches; no visitor identifiers, photos, retries or persistence. */
export function createBoothMetrics() {
  let events: BoothMetricEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (!events.length) {
      return;
    }
    const body = JSON.stringify({ events });
    events = [];
    // Metrics are optional; a disabled gateway or network failure never blocks the photo.
    fetch("/api/event-photo-booth/events", {
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST",
    }).catch(() => undefined);
  }
  function record(event: BoothMetric, sceneId?: string) {
    const existing = events.find((item) => item.event === event && item.sceneId === sceneId);
    if (existing && existing.count < 10) {
      existing.count += 1;
    } else {
      const entry: BoothMetricEntry = { count: 1, event };
      if (sceneId) {
        entry.sceneId = sceneId;
      }
      events.push(entry);
    }
    if (events.length >= 20) {
      flush();
    } else {
      timer ??= setTimeout(flush, 5000);
    }
  }
  return { flush, record };
}
