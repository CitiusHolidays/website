import { describe, expect, test } from "bun:test";
import nextConfig from "./next.config.mjs";

describe("next config cache headers", () => {
  test("lets Next.js manage its own static asset caching", async () => {
    const headers = await nextConfig.headers();

    expect(headers.some(({ source }) => source === "/_next/static/:path*")).toBe(false);
  });
});
