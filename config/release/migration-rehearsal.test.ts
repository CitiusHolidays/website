import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { isRuntimeObject } from "../../src/lib/runtimeValues";
import type { JsonObject, JsonValue } from "../lib/jsonValue";
import {
  buildMigrationRehearsalPlan,
  validateMigrationRehearsalEvidence,
  validateMigrationRehearsalManifest,
} from "./migration-rehearsal";

const root = resolve(import.meta.dir, "../..");
const ORDINARY_PREVIEW_PATTERN = /ordinary\s+Vercel Preview/;

const validManifest = {
  approval: {
    productionPromotion: "pending",
    rehearsalImport: "pending",
    rollbackDecisionOwner: "Director and release owner",
    snapshotExport: "pending",
    state: "draft",
  },
  eventualTarget: { deployment: "prod", deploymentClass: "production" },
  fileStorage: { decision: "include" },
  functions: {
    backfill: "migrations:migrateRoomTypes",
    status: "migrations:getRoomTypeMigrationStatus",
    verify: "migrations:verifyRoomTypes",
  },
  migrationName: "room-type-v2",
  ordinaryPreviewNames: ["main", "preview"],
  rehearsal: {
    deployment: "record-after-preview-create",
    deploymentClass: "dedicated-preview",
    previewName: "migration-rehearsal-room-type-v2-20260812",
  },
  revisions: {
    narrow: "pending-room-type-v2-narrow",
    preChange: "7fa38a0a8eb9c1e05b4946e111f23218b34bc925",
    widen: "a045fd1b87689b6283a379422be5808148eb90bb",
  },
  runId: "room-type-v2-20260812",
  schemaVersion: 1,
  snapshot: {
    path: ".scratch/migration-rehearsal/room-type-v2-20260812/snapshot.zip",
    retentionHours: 24,
    retentionOwner: "Release owner",
  },
  source: { deployment: "prod", deploymentClass: "production" },
};

describe("target-explicit migration rehearsal planner", () => {
  test("builds the ordered room-type plan without executing or inferring a target", () => {
    const manifest = validateMigrationRehearsalManifest(validManifest);
    const plan = buildMigrationRehearsalPlan(manifest);

    expect(plan.scope).toBe("planning-only");
    expect(plan.source).toEqual({ deployment: "prod", deploymentClass: "production" });
    expect(plan.rehearsal.previewName).toBe("migration-rehearsal-room-type-v2-20260812");
    expect(plan.eventualTarget).toEqual({ deployment: "prod", deploymentClass: "production" });
    expect(plan.steps.map((step) => step.id)).toEqual([
      "export-source-snapshot",
      "create-dedicated-preview",
      "import-snapshot",
      "deploy-widened-revision",
      "read-initial-status",
      "run-backfill",
      "run-independent-verifier",
      "read-final-status",
      "deploy-narrow-revision",
      "run-authenticated-smoke",
      "record-rehearsal-evidence",
      "request-fresh-production-approval",
      "securely-delete-snapshot",
    ]);
    const create = plan.steps.find((step) => step.id === "create-dedicated-preview");
    const redeploy = plan.steps.find((step) => step.id === "deploy-widened-revision");
    const importStep = plan.steps.find((step) => step.id === "import-snapshot");
    expect(create?.argv).toContain("--preview-create");
    expect(create?.argv).not.toContain("--preview-name");
    expect(redeploy?.argv).toContain("--preview-name");
    expect(redeploy?.argv).not.toContain("--preview-create");
    expect(importStep?.argv).toContain("--deployment");
    expect(importStep?.argv).not.toContain("--preview-name");
    expect(importStep?.argv).not.toContain("--prod");
    expect(JSON.stringify(plan)).not.toContain('secret":');
    expect(JSON.stringify(plan)).not.toContain("MIGRATION_SECRET=");
    expect(plan.steps.some((step) => step.executesProduction)).toBe(false);
  });

  test("fails closed for production rehearsal, unsafe names, paths, revisions, and file scope", () => {
    const cases: [string, unknown][] = [
      ["dedicated-preview", { rehearsal: { deploymentClass: "production" } }],
      ["protected prefix", { rehearsal: { previewName: "pull-request-143" } }],
      ["ordinary Preview", { rehearsal: { previewName: "main" } }],
      ["snapshot path", { snapshot: { path: "snapshot.zip" } }],
      ["snapshot path", { snapshot: { path: ".scratch/migration-rehearsal/other/snapshot.zip" } }],
      ["revision", { revisions: { narrow: "" } }],
      ["file-storage", { fileStorage: { decision: "unknown" } }],
      ["reviewedReason", { fileStorage: { decision: "exclude-reviewed" } }],
      ["secret", { migrationSecret: "do-not-accept" }],
    ];

    for (const [message, override] of cases) {
      expect(() => validateMigrationRehearsalManifest(deepMerge(validManifest, override))).toThrow(
        message
      );
    }
  });

  test("requires immutable revisions once rehearsal approval is granted", () => {
    const approved = deepMerge(validManifest, {
      approval: {
        rehearsalImport: "approved",
        snapshotExport: "approved",
        state: "rehearsal-approved",
      },
    });
    expect(() => validateMigrationRehearsalManifest(approved)).toThrow("immutable Git SHA");

    const immutable = deepMerge(approved, {
      revisions: { narrow: "1111111111111111111111111111111111111111" },
    });
    expect(validateMigrationRehearsalManifest(immutable).approval.state).toBe("rehearsal-approved");
  });

  test("validates content-free release evidence and rejects secret or row payloads", () => {
    const evidence = validateMigrationRehearsalEvidence({
      migrationName: "room-type-v2",
      outcomes: {
        backfill: "passed",
        narrowDeploy: "passed",
        smoke: "passed",
        verify: "passed",
        widenDeploy: "passed",
      },
      previewName: "migration-rehearsal-room-type-v2-20260812",
      revision: "1111111111111111111111111111111111111111",
      runId: "room-type-v2-20260812",
      schemaVersion: 1,
      snapshot: {
        createdAt: "2026-08-12T12:00:00.000Z",
        sha256: "a".repeat(64),
      },
      status: {
        key: "room-type-v2",
        legacyRemaining: 0,
        processed: 54,
        stage: "complete",
        status: "verified",
        verified: true,
      },
      targetClass: "dedicated-preview",
    });
    expect(evidence.status.legacyRemaining).toBe(0);
    expect(() =>
      validateMigrationRehearsalEvidence({ ...evidence, rows: [{ clientName: "Acme" }] })
    ).toThrow("row payload");
    expect(() =>
      validateMigrationRehearsalEvidence({ ...evidence, secret: "migration-secret" })
    ).toThrow("secret");
  });

  test("CLI help is inert and dry planning writes no snapshot or target state", () => {
    const fixtureRoot = mkdtempSync(resolve(tmpdir(), "citius-migration-plan-"));
    const manifestPath = resolve(fixtureRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(validManifest));
    const run = (args: string[]) =>
      spawnSync("bun", ["config/release/migration-rehearsal.ts", ...args], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });
    try {
      const help = run(["--help"]);
      expect(help.status).toBe(0);
      expect(help.stdout).toContain("planning-only");

      const planned = run(["--manifest", manifestPath, "--json"]);
      expect(planned.status).toBe(0);
      expect(JSON.parse(planned.stdout).scope).toBe("planning-only");
      expect(planned.stdout).not.toContain("migration-secret");

      const execute = run(["--manifest", manifestPath, "--execute"]);
      expect(execute.status).toBe(1);
      expect(execute.stderr).toContain("Unknown flag --execute");
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  test("the sensitive snapshot boundary is ignored by Git", () => {
    const ignored = spawnSync(
      "git",
      ["check-ignore", ".scratch/migration-rehearsal/example/snapshot.zip"],
      { cwd: root, encoding: "utf8" }
    );
    expect(ignored.status).toBe(0);
  });

  test("the canonical runbook preserves snapshot, flag, rollback, and evidence boundaries", () => {
    const runbook = readFileSync(resolve(root, "docs/migrations/rehearsal.md"), "utf8");
    const release = readFileSync(resolve(root, "RELEASE.md"), "utf8");
    const docsIndex = readFileSync(resolve(root, "docs/README.md"), "utf8");
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

    expect(packageJson.scripts["migration:rehearsal"]).toBe(
      "bun config/release/migration-rehearsal.ts"
    );
    expect(docsIndex).toContain("migrations/rehearsal.md");
    expect(release).toContain("bun run migration:rehearsal");
    for (const term of [
      "--preview-create",
      "--preview-name",
      "--deployment",
      "--replace-all",
      "umask 077",
      "fresh explicit Production approval",
      "every write after snapshot creation",
      "forward repair",
      "@convex-dev/migrations",
      "snapshot hash",
      "zero residual",
    ]) {
      expect(runbook).toContain(term);
    }
    expect(runbook).toMatch(ORDINARY_PREVIEW_PATTERN);
    expect(runbook).not.toContain("import --preview-name");
  });
});

function deepMerge(base: JsonValue, override: JsonValue): JsonValue {
  if (!(isRecord(base) && isRecord(override))) {
    return override;
  }
  return Object.fromEntries(
    new Set([...Object.keys(base), ...Object.keys(override)])
      .values()
      .map((key) => [
        key,
        key in override ? deepMerge(base[key], override[key]) : structuredClone(base[key]),
      ])
  );
}

function isRecord(value: JsonValue): value is JsonObject {
  return isRuntimeObject(value) && value !== null && !Array.isArray(value);
}
