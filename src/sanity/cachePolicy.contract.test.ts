import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const APP_ROUTER_SEGMENT_FILE_PATTERN = /^(layout|page)\.(js|jsx|ts|tsx)$/;
const ADJACENT_CACHE_FLAGS_PATTERN = /cacheComponents:\s*true,\s*\n\s*partialPrefetching:\s*true,/;
const LEGACY_PPR_CONFIG_PATTERN = /\bppr\s*:/;
const INSTANT_BOUNDARY_REASON_PATTERN = /\/\/[^\n]+(request|session|identity|auth|URL)/i;
const PRIVATE_SEGMENT_PATH_PATTERN = /\/(\(auth\)|\(authenticated\)|portal)\//;

function listAppRouterSegments(relativeDirectory = "src/app"): string[] {
  const segments: string[] = [];

  for (const entry of readdirSync(join(root, relativeDirectory))) {
    const path = join(relativeDirectory, entry);
    if (statSync(join(root, path)).isDirectory()) {
      segments.push(...listAppRouterSegments(path));
      continue;
    }
    if (APP_ROUTER_SEGMENT_FILE_PATTERN.test(entry)) {
      segments.push(path);
    }
  }

  return segments.sort((left, right) => left.localeCompare(right));
}

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

const approvedInstantBoundaries = new Set([
  "src/app/(auth)/auth/connect/page.js",
  "src/app/(auth)/auth/guest/page.js",
  "src/app/(auth)/auth/vendor/page.js",
  "src/app/(authenticated)/account/page.js",
  "src/app/(authenticated)/vendor/page.js",
  "src/app/portal/layout.js",
]);

const incompatibleSegmentConfig =
  /export\s+const\s+(dynamic|revalidate|fetchCache|runtime|experimental_ppr)\b/;
const bareCacheTodo = /TODO(?::|\b)[^\n]*(Cache Components|cacheComponents|partial prefetch)/i;

describe("Cache Components policy", () => {
  test("enables Cache Components and Partial Prefetching together without legacy aliases", () => {
    const source = read("next.config.mjs");

    expect(source).toMatch(ADJACENT_CACHE_FLAGS_PATTERN);
    expect(source).not.toContain("experimental_ppr");
    expect(source).not.toMatch(LEGACY_PPR_CONFIG_PATTERN);
  });

  test("dynamically audits every App Router page and layout", () => {
    const segments = listAppRouterSegments();
    expect(segments.length).toBeGreaterThan(0);

    const instantBoundaries = new Set<string>();
    for (const path of segments) {
      const source = read(path);
      expect(source).not.toMatch(incompatibleSegmentConfig);
      expect(source).not.toMatch(bareCacheTodo);
      if (source.includes("export const instant = false")) {
        instantBoundaries.add(path);
        expect(source).toMatch(INSTANT_BOUNDARY_REASON_PATTERN);
      }
    }

    expect(instantBoundaries).toEqual(approvedInstantBoundaries);
  });

  test("keeps private segments outside public cache helpers and explicit runtime prefetching", () => {
    for (const path of listAppRouterSegments()) {
      const source = read(path);
      if (PRIVATE_SEGMENT_PATH_PATTERN.test(path)) {
        expect(source).not.toContain('"use cache"');
        expect(source).not.toContain("cachedSanityFetch");
      }
      expect(source).not.toContain("prefetch={true}");
    }
  });

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

  test("identity reads establish a request boundary before auth work", () => {
    for (const path of [
      "src/app/(authenticated)/account/page.js",
      "src/app/(authenticated)/vendor/page.js",
      "src/app/portal/layout.js",
      "src/lib/auth-login-pages.js",
    ]) {
      const source = read(path);
      const connectionIndex = source.indexOf("await connection()");
      const authIndex = Math.min(
        ...["await requireAuth(", "await getServerUser()"]
          .map((needle) => source.indexOf(needle))
          .filter((index) => index >= 0)
      );

      expect(connectionIndex).toBeGreaterThanOrEqual(0);
      expect(connectionIndex).toBeLessThan(authIndex);
    }
  });
});
