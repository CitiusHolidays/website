import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { api } from "@convex/_generated/api";
import { fromPartial } from "@total-typescript/shoehorn";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import type { JsonObject } from "../jsonValue";
import { handleBoothMetrics } from "./metricsGateway";

type Options = NonNullable<Parameters<typeof handleBoothMetrics>[1]>;
const RATE_KEY = /^[a-f0-9]{64}$/;
const keys = [
  "EVENT_PHOTO_BOOTH_GATEWAY_SECRET",
  "NEXT_PUBLIC_CONVEX_URL",
  "NODE_ENV",
  "BETTER_AUTH_URL",
  "SITE_URL",
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
// SAFETY: Restore all environment edits after each isolated test.
const env = fromPartial<Record<string, string | undefined>>(process.env);
afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) {
      delete env[key];
    } else {
      env[key] = original[key];
    }
  }
});
function request(body: JsonObject) {
  return new Request("https://citius.test/api/event-photo-booth/events", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      origin: "https://citius.test",
      "x-forwarded-for": "192.0.2.100",
    },
    method: "POST",
  });
}
function setup(send: Options["send"]) {
  env.EVENT_PHOTO_BOOTH_GATEWAY_SECRET = "test-secret";
  env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
  env.NODE_ENV = "test";
  return { send, tokenFor: async () => null };
}
const good = {
  events: [
    { count: 1, event: "visit" },
    { count: 2, event: "share_attempt", sceneId: "paris" },
  ],
};

describe("photo-booth metrics gateway", () => {
  test("batches enum counts with no visitor identifiers and forwards verified auth", async () => {
    let received: unknown;
    let token: unknown;
    // SAFETY: the route is the sole caller and passes the bounded gateway DTO asserted below.
    const send = fromPartial<Options["send"]>(
      (
        _ref: Parameters<NonNullable<Options["send"]>>[0],
        args: FunctionArgs<typeof api.eventPhotoBooth.recordMetricGateway>,
        transport: { token?: string }
      ) => {
        received = args;
        ({ token } = transport);
        return Promise.resolve(null);
      }
    );
    const options = setup(send);
    const response = await handleBoothMetrics(request(good), {
      ...options,
      tokenFor: async () => "verified-jwt",
    });
    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(received).toEqual({
      ...good,
      gatewaySecret: "test-secret",
      rateLimitKeyHash: expect.stringMatching(RATE_KEY),
    });
    expect(JSON.stringify(received)).not.toContain("192.0.2.100");
    expect(token).toBe("verified-jwt");
  });
  test("rejects photo/contact/extra fields, invalid scenes and oversized batches without sending", async () => {
    let calls = 0;
    // SAFETY: failure tests must never call this minimal mutation stub.
    const options = setup(
      fromPartial<Options["send"]>(() => {
        calls += 1;
        return Promise.resolve(null);
      })
    );
    for (const invalid of [
      { ...good, photo: "data:image" },
      { events: [{ count: 1, email: "a@b.test", event: "visit" }] },
      { events: [{ count: 1, event: "share_attempt" }] },
      { events: [{ count: 11, event: "visit" }] },
      { events: Array.from({ length: 21 }, () => ({ count: 1, event: "visit" })) },
      { events: [{ count: 1, event: "download_action", sceneId: "https://evil" }] },
    ]) {
      // biome-ignore lint/performance/noAwaitInLoops: ordered rejected requests assert no mutation is invoked.
      expect((await handleBoothMetrics(request(invalid), options)).status).toBe(400);
    }
    expect((await handleBoothMetrics(request({ photo: "a".repeat(5000) }), options)).status).toBe(
      413
    );
    expect(calls).toBe(0);
  });
  test("fails metrics closed on missing config or foreign origin and surfaces rate limiting", async () => {
    // SAFETY: force the installed rate-limiter error contract at the transport boundary.
    const options = setup(
      fromPartial<Options["send"]>(() =>
        Promise.reject(
          new ConvexError({ kind: "RateLimited", name: "photoBoothMetrics", retryAfter: 1500 })
        )
      )
    );
    const limited = await handleBoothMetrics(request(good), options);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("2");
    Reflect.deleteProperty(env, "EVENT_PHOTO_BOOTH_GATEWAY_SECRET");
    expect((await handleBoothMetrics(request(good), options)).status).toBe(503);
    env.NODE_ENV = "production";
    env.SITE_URL = "https://other.test";
    env.BETTER_AUTH_URL = "https://other.test";
    expect((await handleBoothMetrics(request(good), options)).status).toBe(403);
  });
  test("native staff-artwork decoder is externalized for Convex Node deployment", () => {
    const config = JSON.parse(
      readFileSync(new URL("../../../convex.json", import.meta.url), "utf8")
    );
    expect(config.node.externalPackages).toContain("sharp");
  });
});
