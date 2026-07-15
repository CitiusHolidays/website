import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const publicCmsRoutes = [
  "src/app/(public)/blog/page.js",
  "src/app/(public)/blog/[slug]/page.js",
  "src/app/(public)/gallery/page.js",
  "src/app/(public)/mice/page.js",
  "src/app/(public)/pilgrimage/page.js",
  "src/app/(public)/pilgrimage/[slug]/page.js",
  "src/app/sitemap.js",
];

const identityScopedFiles = [
  "src/lib/auth-server.js",
  "src/lib/auth-login-pages.js",
  "src/app/(auth)/auth/connect/page.js",
  "src/app/(auth)/auth/guest/page.js",
  "src/app/(auth)/auth/vendor/page.js",
  "src/app/(authenticated)/account/page.js",
  "src/app/(authenticated)/vendor/page.js",
];

describe("Cache Components policy", () => {
  test("public Sanity data uses one tagged five-minute cache boundary", () => {
    const source = read("src/sanity/cachedFetch.js");

    expect(source).toContain('"use cache"');
    expect(source).toContain("cacheLife(SANITY_PUBLIC_CACHE_POLICY)");
    expect(source).toContain("revalidate: 5 * 60");
    expect(source).toContain("cacheTag(...tags)");

    for (const route of publicCmsRoutes) {
      expect(read(route)).toContain('from "@/sanity/cachedFetch"');
    }
  });

  test("identity-scoped and request-derived modules never import the public cache", () => {
    for (const path of identityScopedFiles) {
      const source = read(path);
      expect(source).not.toContain("cachedSanityFetch");
      expect(source).not.toContain('"use cache"');
      expect(source).not.toContain("unstable_noStore");
    }
  });

  test("auth opt-outs document their request-sensitive boundary without adoption TODOs", () => {
    for (const path of identityScopedFiles.filter((candidate) => candidate.includes("/app/"))) {
      const source = read(path);
      expect(source).toContain("export const instant = false");
      expect(source).not.toContain("TODO: Cache Components adoption");
    }
  });
});
