import { describe, expect, test } from "bun:test";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig, { resolveBuildRevision, resolveReactInspectionModules } from "./next.config.mjs";
import { buildContentSecurityPolicy } from "./src/lib/security/contentSecurityPolicy.mjs";

const REACT_INSPECTION_MODULE = "./src/lib/dev/react-inspection-client.ts";

/** Last matching rule wins for a key, as documented for next.config headers. */
async function effectiveHeader(pathname, key) {
  let value;
  for (const rule of await nextConfig.headers()) {
    const match = getPathMatch(rule.source, { removeUnnamedParams: true, strict: true });
    if (match(pathname) === false) {
      continue;
    }
    for (const header of rule.headers) {
      if (header.key === key) {
        ({ value } = header);
      }
    }
  }
  return value;
}

describe("Next config cache headers", () => {
  test("Lets Next.js manage its own static asset caching", async () => {
    const headers = await nextConfig.headers();

    expect(headers.some(({ source }) => source === "/_next/static/:path*")).toBe(false);
  });

  test("Uses an exact revision as the served Next build identity", () => {
    const revision = "59e703531feb7e63887382801cef860badde9546";
    expect(resolveBuildRevision({ CITIUS_BUILD_REVISION: revision })).toBe(revision);
    expect(() => resolveBuildRevision({ CITIUS_BUILD_REVISION: "stale-build" })).toThrow(
      "exact 40-character"
    );
  });

  test("Loads the shared React inspection seam only for an explicit local opt-in", () => {
    expect(
      resolveReactInspectionModules({
        CITIUS_REACT_INSPECTION: "1",
        NODE_ENV: "development",
      })
    ).toEqual([REACT_INSPECTION_MODULE]);
    expect(resolveReactInspectionModules({ NODE_ENV: "development" })).toEqual([]);
    expect(
      resolveReactInspectionModules({
        CITIUS_REACT_INSPECTION: "true",
        NODE_ENV: "development",
      })
    ).toEqual([]);
  });

  test("Keeps React inspection out of every non-development build", () => {
    for (const nodeEnv of ["production", "test", undefined]) {
      expect(
        resolveReactInspectionModules({
          CITIUS_REACT_INSPECTION: "1",
          NODE_ENV: nodeEnv,
        })
      ).toEqual([]);
    }
    expect(nextConfig.instrumentationClientInject).toEqual([]);
  });

  test("Allows same-origin geolocation only on Staff Workspace documents", async () => {
    const portal = ["/portal", "/portal/attendance", "/portal/crm/check-in"];
    const publicPaths = ["/", "/account", "/contact", "/portalx", "/photo-booth"];
    const policyFor = (path) => effectiveHeader(path, "Permissions-Policy");
    expect(await Promise.all(portal.map(policyFor))).toEqual(
      portal.map(() => "camera=(), microphone=(), geolocation=(self)")
    );
    expect(await Promise.all(publicPaths.map(policyFor))).toEqual(
      publicPaths.map(() => "camera=(), microphone=(), geolocation=()")
    );
  });

  test("Sends a report-only CSP and its reporting endpoint on every document", async () => {
    const paths = ["/", "/contact", "/portal/attendance", "/account", "/api/contact"];
    const headers = await Promise.all(
      paths.map(async (path) => ({
        endpoints: await effectiveHeader(path, "Reporting-Endpoints"),
        enforced: await effectiveHeader(path, "Content-Security-Policy"),
        path,
        policy: await effectiveHeader(path, "Content-Security-Policy-Report-Only"),
      }))
    );
    for (const { endpoints, enforced, path, policy } of headers) {
      expect(policy, path).toContain("default-src 'self'");
      expect(policy, path).toContain("report-uri /api/csp-report");
      expect(policy, path).toContain("report-to csp-endpoint");
      expect(endpoints, path).toBe('csp-endpoint="/api/csp-report"');
      expect(enforced, path).toBeUndefined();
    }
  });
});

describe("Content Security Policy", () => {
  const directive = (policy, name) =>
    policy
      .split("; ")
      .find((entry) => entry.split(" ")[0] === name)
      ?.split(" ")
      .slice(1);

  test("Allows exactly the third-party origins the site loads", () => {
    const policy = buildContentSecurityPolicy();
    expect(directive(policy, "script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
      "https://challenges.cloudflare.com",
      "https://va.vercel-scripts.com",
    ]);
    expect(directive(policy, "frame-src")).toEqual([
      "https://challenges.cloudflare.com",
      "https://www.google.com",
      "https://www.youtube.com",
    ]);
    expect(directive(policy, "connect-src")).toEqual([
      "'self'",
      "https://*.convex.cloud",
      "wss://*.convex.cloud",
      "https://*.convex.site",
    ]);
    expect(directive(policy, "img-src")).toContain("https://cdn.sanity.io");
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(policy).not.toContain("razorpay");
    expect(policy).not.toContain("googleapis");
  });

  test("Adds configured Convex origins and development-only eval", () => {
    const policy = buildContentSecurityPolicy({
      convexSiteUrl: "http://127.0.0.1:3211",
      convexUrl: "http://127.0.0.1:3210/",
      development: true,
    });
    expect(directive(policy, "connect-src")).toEqual(
      expect.arrayContaining([
        "http://127.0.0.1:3210",
        "ws://127.0.0.1:3210",
        "http://127.0.0.1:3211",
      ])
    );
    expect(directive(policy, "script-src")).toContain("'unsafe-eval'");
    expect(directive(buildContentSecurityPolicy(), "script-src")).not.toContain("'unsafe-eval'");
    expect(
      directive(buildContentSecurityPolicy({ convexUrl: "javascript:alert(1)" }), "connect-src")
    ).toHaveLength(4);
  });

  test("Adds framing and upgrade directives only when enforcing", () => {
    expect(buildContentSecurityPolicy()).not.toContain("frame-ancestors");
    const enforced = buildContentSecurityPolicy({ enforce: true });
    expect(directive(enforced, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(enforced, "upgrade-insecure-requests")).toEqual([]);
  });
});
