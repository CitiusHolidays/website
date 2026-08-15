import { describe, expect, test } from "bun:test";
import nextConfig, { resolveBuildRevision } from "./next.config.mjs";

describe("next config cache headers", () => {
  test("lets Next.js manage its own static asset caching", async () => {
    const headers = await nextConfig.headers();

    expect(headers.some(({ source }) => source === "/_next/static/:path*")).toBe(false);
  });

  test("uses an exact revision as the served Next build identity", () => {
    const revision = "59e703531feb7e63887382801cef860badde9546";
    expect(resolveBuildRevision({ CITIUS_BUILD_REVISION: revision })).toBe(revision);
    expect(() => resolveBuildRevision({ CITIUS_BUILD_REVISION: "stale-build" })).toThrow(
      "exact 40-character"
    );
  });
});
