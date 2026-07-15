import { describe, expect, test } from "bun:test";
import { consumeSharedAiRateLimit, hashAiRateLimitKey, recordAiTelemetry } from "./runtimeService";

const env = {
  AI_RATE_LIMIT_SALT: "privacy-salt",
  AI_RUNTIME_SECRET: "runtime-secret",
  NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
};

describe("AI runtime service", () => {
  test("hashes raw identifiers deterministically without retaining them", () => {
    const first = hashAiRateLimitKey("concierge", "203.0.113.7", env);
    const second = hashAiRateLimitKey("concierge", "203.0.113.7", env);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toContain("203.0.113.7");
  });

  test("delegates limits to Convex with only a privacy-safe key", async () => {
    const calls: unknown[] = [];
    const result = await consumeSharedAiRateLimit(
      { feature: "concierge", rawKey: "203.0.113.7" },
      {
        env,
        fetchMutationImpl: async (_mutation, args) => {
          calls.push(args);
          return { allowed: true, remaining: 3, retryAfterSec: 0 };
        },
      }
    );

    expect(result.allowed).toBe(true);
    expect(JSON.stringify(calls)).not.toContain("203.0.113.7");
    expect(calls).toHaveLength(1);
  });

  test("independent instances share one atomic exhaustion result", async () => {
    let count = 0;
    const sharedMutation = async () => {
      count += 1;
      return {
        allowed: count <= 2,
        remaining: Math.max(0, 2 - count),
        retryAfterSec: count <= 2 ? 0 : 600,
      };
    };
    const instances = Array.from({ length: 3 }, () =>
      consumeSharedAiRateLimit(
        { feature: "concierge", rawKey: "same-client" },
        { env, fetchMutationImpl: sharedMutation }
      )
    );
    const results = await Promise.all(instances);
    expect(results.map((result) => result.allowed)).toEqual([true, true, false]);
  });

  test("uses a privacy-safe process-local limiter only outside production when shared config is absent", async () => {
    const rawKey = `local-${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 21 }, () =>
        consumeSharedAiRateLimit(
          { feature: "concierge", rawKey },
          { env: { NODE_ENV: "development" }, now: () => 1000 }
        )
      )
    );

    expect(results.slice(0, 20).every((result) => result.allowed)).toBe(true);
    expect(results[20]).toEqual({ allowed: false, remaining: 0, retryAfterSec: 600 });
  });

  test("fails closed in production when shared rate-limit configuration is absent", async () => {
    await expect(
      consumeSharedAiRateLimit(
        { feature: "concierge", rawKey: "production-client" },
        { env: { NODE_ENV: "production" } }
      )
    ).rejects.toThrow("AI shared runtime storage is not configured");
  });

  test("telemetry storage failure never breaks the user stream", async () => {
    await expect(
      recordAiTelemetry(
        {
          fallback: false,
          feature: "concierge",
          finishReason: "stop",
          latencyMs: 100,
          model: "primary:free",
          terminalState: "completed",
        },
        {
          env,
          fetchMutationImpl: async () => {
            throw new Error("telemetry unavailable");
          },
          logger: { error() {} },
        }
      )
    ).resolves.toBe(false);
  });
});
