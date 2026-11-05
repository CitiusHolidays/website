import { describe, expect, test } from "bun:test";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig, { resolveBuildRevision, resolveReactInspectionModules } from "./next.config.mjs";

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
});
