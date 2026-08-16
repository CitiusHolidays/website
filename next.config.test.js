import { describe, expect, test } from "bun:test";
import nextConfig, { resolveBuildRevision, resolveReactInspectionModules } from "./next.config.mjs";

const REACT_INSPECTION_MODULE = "./src/lib/dev/react-inspection-client.ts";

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

  test("loads the shared React inspection seam only for an explicit local opt-in", () => {
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

  test("keeps React inspection out of every non-development build", () => {
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
});
