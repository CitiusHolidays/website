import { expect, test } from "bun:test";
import { createBoothMetrics } from "./visitorMetrics";

test("batches only aggregate vocabulary and drops failed batches without retry", async () => {
  const original = globalThis.fetch;
  const bodies: string[] = [];
  globalThis.fetch = Object.assign(
    (_input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => {
      bodies.push(String(init?.body));
      return Promise.reject(new Error("offline"));
    },
    { preconnect: original.preconnect }
  );
  try {
    const metrics = createBoothMetrics();
    metrics.record("visit");
    metrics.record("download_action", "paris");
    metrics.record("download_action", "paris");
    metrics.record("share_attempt", "bali");
    expect(bodies).toHaveLength(0);
    metrics.flush();
    await Promise.resolve();
    metrics.flush();
    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0])).toEqual({
      events: [
        { count: 1, event: "visit" },
        { count: 2, event: "download_action", sceneId: "paris" },
        { count: 1, event: "share_attempt", sceneId: "bali" },
      ],
    });
  } finally {
    globalThis.fetch = original;
  }
});
