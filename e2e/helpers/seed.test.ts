import { afterEach, describe, expect, mock, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import type { ApprovedE2eTarget } from "../../config/e2e/target-identity";
import { cleanupE2eRun } from "./seed";

const approvedTarget: ApprovedE2eTarget = {
  convexSiteOrigin: "https://preview-convex.example",
  convexSourceHash: "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99",
  frontendOrigin: "https://preview-frontend.example",
  id: "preview-preview-convex-fixture",
  revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
  target: "preview",
};
const originalSeedSecret = process.env.E2E_SEED_SECRET;
const originalConvexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

afterEach(() => {
  if (originalSeedSecret === undefined) {
    delete process.env.E2E_SEED_SECRET;
  } else {
    process.env.E2E_SEED_SECRET = originalSeedSecret;
  }
  if (originalConvexSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = originalConvexSiteUrl;
  }
});

describe("E2E cleanup client", () => {
  test("Retries a bounded transient cleanup failure", async () => {
    process.env.E2E_SEED_SECRET = "fixture-secret";
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = approvedTarget.convexSiteOrigin;
    let calls = 0;
    const fetchCleanup = mock((_input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      expect(init?.headers).toEqual({ "x-e2e-seed-secret": "fixture-secret" });
      if (calls === 1) {
        return Promise.resolve(
          Response.json({ error: "temporarily unavailable" }, { status: 503 })
        );
      }
      return Promise.resolve(
        Response.json({
          complete: true,
          deleted: 12,
          residualCount: 0,
          runId: "run-fixture",
        })
      );
    });

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      cleanupE2eRun("run-fixture", approvedTarget, fromPartial<typeof fetch>(fetchCleanup))
    ).resolves.toEqual({
      complete: true,
      deleted: 12,
      residualCount: 0,
      runId: "run-fixture",
    });
    expect(fetchCleanup).toHaveBeenCalledTimes(2);
  });

  test("Does not retry an authorization denial", async () => {
    process.env.E2E_SEED_SECRET = "fixture-secret";
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL = approvedTarget.convexSiteOrigin;
    const fetchCleanup = mock(() =>
      Promise.resolve(Response.json({ error: "not authorized" }, { status: 401 }))
    );

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      cleanupE2eRun("run-fixture", approvedTarget, fromPartial<typeof fetch>(fetchCleanup))
    ).rejects.toThrow("Convex E2E cleanup returned HTTP 401.");
    expect(fetchCleanup).toHaveBeenCalledTimes(1);
  });
});
