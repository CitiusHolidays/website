import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { consumeRateLimit, recordTelemetry } from "./aiRuntime";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import type { TestIndexQuery } from "./testSupport/runtimeContracts";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}

function makeSharedCtx(nowRef: { value: number }) {
  const tables = { aiRateLimits: [], aiTelemetry: [] } satisfies Record<string, Row[]>;
  let nextId = 1;
  const ctx = {
    db: {
      delete: (_table: string, id: string) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows.splice(index, 1);
          }
        }
      },
      insert: (table: string, value: RuntimeObject) => {
        const id = `${table}_${nextId}`;
        nextId += 1;
        tables[table].push({ _id: id, ...value });
        return id;
      },
      patch: (_table: string, id: string, value: RuntimeObject) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows[index] = { ...rows[index], ...value };
          }
        }
      },
      query(table: string) {
        let rows = tables[table];
        return {
          unique: async () => rows[0] ?? null,
          withIndex(_name: string, callback: (query: TestIndexQuery) => TestIndexQuery) {
            const filters: [string, RuntimeValue][] = [];
            const query: TestIndexQuery = {
              eq(field: string, value: RuntimeValue) {
                filters.push([field, value]);
                return query;
              },
            };
            callback(query);
            rows = rows.filter((row) => filters.every(([field, value]) => row[field] === value));
            return this;
          },
        };
      },
    },
    now: () => nowRef.value,
  };
  return { ctx, tables };
}

async function withSecret<T>(run: () => Promise<T>) {
  const previous = process.env.AI_RUNTIME_SECRET;
  process.env.AI_RUNTIME_SECRET = "test-ai-secret";
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.AI_RUNTIME_SECRET;
    } else {
      process.env.AI_RUNTIME_SECRET = previous;
    }
  }
}

describe("shared AI runtime state", () => {
  test("pins and mounts the reviewed component behind the app compatibility mutation", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { dependencies: Record<string, string> };
    const config = readFileSync(new URL("./convex.config.ts", import.meta.url), "utf8");
    const binding = readFileSync(new URL("./lib/rateLimiterComponent.ts", import.meta.url), "utf8");
    expect(packageJson.dependencies["@convex-dev/rate-limiter"]).toBe("0.3.2");
    expect(config).toContain('from "@convex-dev/rate-limiter/convex.config.js"');
    expect(config).toContain("app.use(rateLimiter)");
    expect(binding).toContain("components as typeof components & InstalledComponents");
  });

  test("enforces one atomic bucket across simulated instances and cold starts", async () => {
    await withSecret(async () => {
      const now = { value: 1000 };
      const shared = makeSharedCtx(now);
      const args = {
        feature: "concierge",
        keyHash: "a".repeat(64),
        limit: 2,
        secret: "test-ai-secret",
        windowMs: 10_000,
      } as const;

      // SAFETY: This test controls the asserted value at the framework boundary below.
      expect((await (consumeRateLimit as any)._handler(shared.ctx, args)).allowed).toBe(true);
      // SAFETY: This test controls the asserted value at the framework boundary below.
      expect((await (consumeRateLimit as any)._handler(shared.ctx, args)).allowed).toBe(true);
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const exhausted = await (consumeRateLimit as any)._handler(shared.ctx, args);
      expect(exhausted.allowed).toBe(false);
      expect(exhausted.retryAfterSec).toBe(10);

      now.value = 11_001;
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const renewed = await (consumeRateLimit as any)._handler(shared.ctx, args);
      expect(renewed.allowed).toBe(true);
      expect(renewed.remaining).toBe(1);
    });
  });

  test("stores bounded telemetry fields without prompt or response content", async () => {
    await withSecret(async () => {
      const now = { value: 5000 };
      const shared = makeSharedCtx(now);
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await (recordTelemetry as any)._handler(shared.ctx, {
        fallback: true,
        feature: "journeyPlanner",
        finishReason: "stop",
        inputTokens: 120,
        latencyMs: 812,
        model: "fallback:free",
        outputTokens: 80,
        secret: "test-ai-secret",
        terminalState: "completed",
      });

      const [row] = shared.tables.aiTelemetry;
      expect(row.feature).toBe("journeyPlanner");
      expect(row.fallback).toBe(true);
      expect(row.retentionUntil).toBeGreaterThan(now.value);
      expect(row).not.toHaveProperty("prompt");
      expect(row).not.toHaveProperty("response");
      expect(row).not.toHaveProperty("content");
    });
  });

  test("rejects callers without the server capability", async () => {
    await withSecret(async () => {
      const shared = makeSharedCtx({ value: 0 });
      await expect(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        (consumeRateLimit as any)._handler(shared.ctx, {
          feature: "concierge",
          keyHash: "b".repeat(64),
          limit: 1,
          secret: "wrong",
          windowMs: 1000,
        })
      ).rejects.toThrow("Invalid AI runtime secret");
    });
  });
});
