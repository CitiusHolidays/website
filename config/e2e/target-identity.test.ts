import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  readApprovedE2eTarget,
  validateApprovedE2eTargetManifest,
  verifyFrontendE2eIdentity,
} from "./target-identity";

const preview = {
  convexSiteOrigin: "https://fixture-preview.convex.site",
  frontendOrigin: "https://branch.example.test",
  id: "preview-branch-123",
  target: "preview" as const,
};

describe("approved E2E target identity", () => {
  test("requires exact non-production origin pairs and target-scoped IDs", () => {
    expect(validateApprovedE2eTargetManifest({ schemaVersion: 1, targets: [preview] })).toEqual({
      schemaVersion: 1,
      targets: [preview],
    });
    expect(() =>
      validateApprovedE2eTargetManifest({
        schemaVersion: 1,
        targets: [
          { ...preview, frontendOrigin: "https://www.citiusholidays.com", id: "production-live" },
        ],
      })
    ).toThrow("must begin with preview-");
    expect(() =>
      validateApprovedE2eTargetManifest({
        schemaVersion: 1,
        targets: [{ ...preview, convexSiteOrigin: "http://localhost:3210" }],
      })
    ).toThrow("origins do not match");
  });

  test("independently matches the frontend runtime identity to the approved pair", async () => {
    const fetchIdentity = (async () => Response.json(preview)) as typeof fetch;
    await expect(verifyFrontendE2eIdentity(preview, fetchIdentity)).resolves.toEqual(preview);
    await expect(
      verifyFrontendE2eIdentity(preview, (async () =>
        Response.json({ ...preview, id: "preview-other" })) as typeof fetch)
    ).rejects.toThrow("does not match");
  });

  test("reads only an ignored-boundary manifest and binds both configured origins", () => {
    const root = mkdtempSync(resolve(tmpdir(), "citius-e2e-target-"));
    try {
      mkdirSync(resolve(root, ".scratch/e2e"), { recursive: true });
      writeFileSync(
        resolve(root, ".scratch/e2e/approved-targets.json"),
        JSON.stringify({ schemaVersion: 1, targets: [preview] })
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
