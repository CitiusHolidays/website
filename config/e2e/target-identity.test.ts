import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  readApprovedE2eTarget,
  validateApprovedE2eTargetManifest,
  verifyConvexE2eIdentity,
  verifyFrontendE2eIdentity,
} from "./target-identity";

const preview = {
  convexSiteOrigin: "https://fixture-preview.convex.site",
  frontendOrigin: "https://branch.example.test",
  id: "preview-fixture-preview-branch-123",
  revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
  target: "preview" as const,
};

describe("approved E2E target identity", () => {
  test("requires exact non-production origin pairs and target-scoped IDs", () => {
    expect(validateApprovedE2eTargetManifest({ schemaVersion: 2, targets: [preview] })).toEqual({
      schemaVersion: 2,
      targets: [preview],
    });
    expect(() =>
      validateApprovedE2eTargetManifest({
        schemaVersion: 2,
        targets: [
          { ...preview, frontendOrigin: "https://www.citiusholidays.com", id: "production-live" },
        ],
      })
    ).toThrow("must begin with preview-");
    expect(() =>
      validateApprovedE2eTargetManifest({
        schemaVersion: 2,
        targets: [{ ...preview, convexSiteOrigin: "http://localhost:3210" }],
      })
    ).toThrow("origins do not match");
    expect(() =>
      validateApprovedE2eTargetManifest({
        schemaVersion: 2,
        targets: [{ ...preview, revision: "not-a-revision" }],
      })
    ).toThrow("revision");
  });

  test("independently matches the frontend runtime identity to the approved pair", async () => {
    const fetchIdentity = (async () => Response.json(preview)) as typeof fetch;
    await expect(verifyFrontendE2eIdentity(preview, fetchIdentity)).resolves.toEqual(preview);
    await expect(
      verifyFrontendE2eIdentity(preview, (async () =>
        Response.json({ ...preview, id: "preview-other" })) as typeof fetch)
    ).rejects.toThrow("does not match");
  });

  test("proves the Convex site identity before any provisioning write", async () => {
    const fetchIdentity = ((url, init) => {
      expect(url).toBe(`${preview.convexSiteOrigin}/e2e/identity`);
      expect(new Headers(init?.headers).get("x-e2e-target-id")).toBe(preview.id);
      expect(new Headers(init?.headers).get("x-e2e-seed-secret")).toBe("fixture-secret");
      return Promise.resolve(Response.json(preview));
    }) as typeof fetch;
    await expect(
      verifyConvexE2eIdentity(preview, "fixture-secret", fetchIdentity)
    ).resolves.toEqual(preview);
    await expect(
      verifyConvexE2eIdentity(preview, "fixture-secret", (() =>
        Promise.resolve(Response.json({ ...preview, id: "preview-other" }))) as typeof fetch)
    ).rejects.toThrow("does not match");
  });

  test("reads only an ignored-boundary manifest and binds both configured origins", () => {
    const root = mkdtempSync(resolve(tmpdir(), "citius-e2e-target-"));
    try {
      mkdirSync(resolve(root, ".scratch/e2e"), { recursive: true });
      writeFileSync(
        resolve(root, ".scratch/e2e/approved-targets.json"),
        JSON.stringify({ schemaVersion: 2, targets: [preview] })
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
          schemaVersion: 2,
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
