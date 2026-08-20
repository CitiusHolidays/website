import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fromPartial } from "@total-typescript/shoehorn";
import { CONVEX_E2E_DEPLOYMENT_SOURCE_HASH } from "../../convex/e2eDeploymentIdentity";
import { computeConvexDeploymentSourceHash } from "./convex-source-fingerprint";
import {
  readApprovedE2eTarget,
  validateApprovedE2eTargetManifest,
  verifyConvexE2eIdentity,
  verifyFrontendE2eIdentity,
} from "./target-identity";

const preview = {
  convexSiteOrigin: "https://fixture-preview.convex.site",
  convexSourceHash: "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99",
  frontendOrigin: "https://branch.example.test",
  id: "preview-fixture-preview-branch-123",
  revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
  target: "preview" as const,
};

describe("Approved E2E target identity", () => {
  test("Requires exact non-production origin pairs and target-scoped IDs", () => {
    expect(validateApprovedE2eTargetManifest({ schemaVersion: 3, targets: [preview] })).toEqual({
      schemaVersion: 3,
      targets: [preview],
    });
    expect(() =>
      validateApprovedE2eTargetManifest({
        schemaVersion: 3,
        targets: [
          { ...preview, frontendOrigin: "https://www.citiusholidays.com", id: "production-live" },
        ],
      })
    ).toThrow("must begin with preview-");
    expect(() =>
      validateApprovedE2eTargetManifest({
        schemaVersion: 3,
        targets: [{ ...preview, convexSiteOrigin: "http://localhost:3210" }],
      })
    ).toThrow("origins do not match");
    expect(() =>
      validateApprovedE2eTargetManifest({
        schemaVersion: 3,
        targets: [{ ...preview, revision: "not-a-revision" }],
      })
    ).toThrow("revision");
    expect(() =>
      validateApprovedE2eTargetManifest({
        schemaVersion: 3,
        targets: [{ ...preview, convexSourceHash: "not-a-source-hash" }],
      })
    ).toThrow("convexSourceHash");
  });

  test("Independently matches the frontend runtime identity to the approved pair", async () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const fetchIdentity = fromPartial<typeof fetch>(async () => Response.json(preview));
    await expect(verifyFrontendE2eIdentity(preview, fetchIdentity)).resolves.toEqual(preview);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      verifyFrontendE2eIdentity(
        preview,
        fromPartial<typeof fetch>(async () => Response.json({ ...preview, id: "preview-other" }))
      )
    ).rejects.toThrow("does not match");
  });

  test("Proves the Convex site identity before any provisioning write", async () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const fetchIdentity = fromPartial<typeof fetch>((url, init) => {
      expect(url).toBe(`${preview.convexSiteOrigin}/e2e/identity`);
      expect(new Headers(init?.headers).get("x-e2e-target-id")).toBe(preview.id);
      expect(new Headers(init?.headers).get("x-e2e-seed-secret")).toBe("fixture-secret");
      return Promise.resolve(
        Response.json({
          convexSiteOrigin: preview.convexSiteOrigin,
          convexSourceHash: preview.convexSourceHash,
          id: preview.id,
          target: preview.target,
        })
      );
    });
    await expect(
      verifyConvexE2eIdentity(
        preview,
        "fixture-secret",
        fetchIdentity,
        () => preview.convexSourceHash
      )
    ).resolves.toEqual(preview);
    await expect(
      verifyConvexE2eIdentity(
        preview,
        "fixture-secret",
        // SAFETY: This test controls the asserted value at the framework boundary below.
        fromPartial<typeof fetch>(() =>
          Promise.resolve(
            Response.json({
              convexSiteOrigin: preview.convexSiteOrigin,
              convexSourceHash: preview.convexSourceHash,
              id: "preview-other",
              target: preview.target,
            })
          )
        ),
        () => preview.convexSourceHash
      )
    ).rejects.toThrow("does not match");
  });

  test("Binds the deployed marker to the current Convex source closure", () => {
    expect(computeConvexDeploymentSourceHash(resolve(import.meta.dir, "../.."))).toBe(
      CONVEX_E2E_DEPLOYMENT_SOURCE_HASH
    );
  });

  test("Reads only an ignored-boundary manifest and binds both configured origins", () => {
    const root = mkdtempSync(resolve(tmpdir(), "citius-e2e-target-"));
    try {
      mkdirSync(resolve(root, ".scratch/e2e"), { recursive: true });
      writeFileSync(
        resolve(root, ".scratch/e2e/approved-targets.json"),
        JSON.stringify({ schemaVersion: 3, targets: [preview] })
      );
      expect(
        readApprovedE2eTarget({
          baseUrl: preview.frontendOrigin,
          convexSiteUrl: preview.convexSiteOrigin,
          root,
          target: "preview",
          targetId: preview.id,
        })
      ).toEqual(preview);
      expect(() =>
        readApprovedE2eTarget({
          baseUrl: preview.frontendOrigin,
          convexSiteUrl: "https://wrong.convex.site",
          root,
          target: "preview",
          targetId: preview.id,
        })
      ).toThrow("approved Convex site origin");
      expect(() =>
        validateApprovedE2eTargetManifest({
          schemaVersion: 3,
          targets: [{ ...preview, id: "preview-unrelated-deployment" }],
        })
      ).toThrow("bind the fixture-preview Convex deployment identity");
      expect(() =>
        readApprovedE2eTarget({
          baseUrl: preview.frontendOrigin,
          manifestPath: "outside.json",
          root,
          target: "preview",
          targetId: preview.id,
        })
      ).toThrow("below .scratch/e2e");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
