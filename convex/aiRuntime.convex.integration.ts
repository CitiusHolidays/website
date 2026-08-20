import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const FIXED_NOW = new Date("2026-08-12T18:00:00.000Z");
const SECRET = "integration-ai-runtime-secret";

function createHarness() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  rateLimiterTest.register(t, "rateLimiter");
  return t;
}

function rateLimitArgs(keyHash: string, limit = 2) {
  return {
    feature: "concierge" as const,
    keyHash,
    limit,
    secret: SECRET,
    windowMs: 10_000,
  };
}

let previousSecret: string | undefined;

beforeEach(() => {
  previousSecret = process.env.AI_RUNTIME_SECRET;
  process.env.AI_RUNTIME_SECRET = SECRET;
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  if (previousSecret === undefined) {
    delete process.env.AI_RUNTIME_SECRET;
  } else {
    process.env.AI_RUNTIME_SECRET = previousSecret;
  }
});

describe("registered component-backed AI rate limit", () => {
  test("preserves exact result shape, independent keys, and first-use reset boundary", async () => {
    const t = createHarness();
    const firstKey = "a".repeat(64);
    const secondKey = "b".repeat(64);

    expect(await t.mutation(api.aiRuntime.consumeRateLimit, rateLimitArgs(firstKey))).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterSec: 0,
    });
    expect(await t.mutation(api.aiRuntime.consumeRateLimit, rateLimitArgs(firstKey))).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterSec: 0,
    });
    expect(await t.mutation(api.aiRuntime.consumeRateLimit, rateLimitArgs(firstKey))).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSec: 10,
    });
    expect(await t.mutation(api.aiRuntime.consumeRateLimit, rateLimitArgs(secondKey))).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterSec: 0,
    });

    vi.setSystemTime(new Date(FIXED_NOW.getTime() + 10_001));
    expect(await t.mutation(api.aiRuntime.consumeRateLimit, rateLimitArgs(firstKey))).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterSec: 0,
    });
  });

  test("serializes concurrent consumption without exceeding capacity", async () => {
    const t = createHarness();
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        t.mutation(api.aiRuntime.consumeRateLimit, rateLimitArgs("c".repeat(64), 5))
      )
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(7);
    expect(
      results
        .flatMap((result) => (result.allowed ? [result.remaining] : []))
        .sort((left, right) => left - right)
    ).toEqual([0, 1, 2, 3, 4]);
  });

  test("keeps server capability and privacy-safe key validation ahead of component state", async () => {
    const t = createHarness();
    await expect(
      t.mutation(api.aiRuntime.consumeRateLimit, {
        ...rateLimitArgs("d".repeat(64)),
        secret: "wrong",
      })
    ).rejects.toThrow("Invalid AI runtime secret");
    await expect(
      t.mutation(api.aiRuntime.consumeRateLimit, rateLimitArgs("raw-user-identifier"))
    ).rejects.toThrow("Invalid privacy-safe rate-limit key");
  });
});
