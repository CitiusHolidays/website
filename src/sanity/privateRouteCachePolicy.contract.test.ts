import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import nextConfig from "../../next.config.mjs";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

describe("private route cache policy", () => {
  test("marks session-aware route families private and non-cacheable at the hosting edge", async () => {
    if (typeof nextConfig.headers !== "function") {
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

  test("blocks auth-dependent rendering before request-time work without a Suspense auth shell", () => {
    const routeSources = [
      read("src/app/portal/layout.js"),
      read("src/app/(authenticated)/account/page.js"),
      read("src/lib/auth-login-pages.js"),
    ];

    for (const source of routeSources) {
      expect(source).toContain("await connection()");
      expect(source).not.toContain("PortalAuthBoundary");
      expect(source).not.toContain("<Suspense");
    }

    const authLoginSource = read("src/lib/auth-login-pages.js");
    expect(authLoginSource).toContain("const user = await getServerUser();");
    expect(authLoginSource).not.toContain("getServerUser().catch(() => null)");
  });

  test("provides a retry boundary without echoing auth transport details", () => {
    const boundarySources = [
      read("src/app/(auth)/error.js"),
      read("src/app/(authenticated)/error.js"),
      read("src/app/portal/error.js"),
      read("src/components/auth/PrivateAuthError.js"),
    ];

    for (const source of boundarySources) {
      expect(source).toContain("PrivateAuthError");
      expect(source).toContain("reset");
      expect(source).not.toContain("cookie");
      expect(source).not.toContain("token");
    }
  });
});
