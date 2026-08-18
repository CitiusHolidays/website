import { describe, expect, test } from "bun:test";
import nextConfig from "../../next.config.mjs";
import { isRuntimeFunction } from "../lib/runtimeValues";

const PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

describe("Private route caching", () => {
  test("Marks session-aware route families private and non-cacheable at the hosting edge", async () => {
    if (!isRuntimeFunction(nextConfig.headers)) {
      throw new Error("next.config.mjs must define headers() for private route policy");
    }
    const rules = await nextConfig.headers();
    const privateSources = [
      "/account/:path*",
      "/api/auth/:path*",
      "/auth/:path*",
      "/portal/:path*",
    ];

    for (const source of privateSources) {
      const rule = rules.find((candidate) => candidate.source === source);
      expect(rule).toBeDefined();
      if (!rule) {
        continue;
      }
      expect(rule.headers).toContainEqual({ key: "Cache-Control", value: PRIVATE_CACHE_CONTROL });
      expect(rule.headers).toContainEqual({ key: "Vary", value: "Cookie" });
    }
  });
});
