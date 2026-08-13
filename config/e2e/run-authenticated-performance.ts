import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { computePerformanceSourceHash } from "../release/check-performance-budgets";
import { staffWorkspacePerformanceInputs } from "../release/performance-inputs";
import {
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
  type StaffWorkspacePerformanceTarget,
} from "../release/staff-workspace-performance-budget";
import { resolveWorkspaceRevision } from "../release/verify-local";
import { validateE2ePreflight } from "./preflight";

interface RawPerformanceEvidence {
  cold: Record<string, unknown>;
  revision: string;
  target: StaffWorkspacePerformanceTarget;
  warm: Record<string, unknown>;
}

export function consolidateAuthenticatedPerformanceEvidence(
  revision: string,
  values: RawPerformanceEvidence[],
  sourceFiles: string[],
  sourceHash: string,
  createdAt = new Date().toISOString()
) {
  const byTarget = new Map(values.map((value) => [value.target, value]));
  if (byTarget.size !== STAFF_WORKSPACE_PERFORMANCE_TARGETS.length) {
    throw new Error("Authenticated performance evidence is missing a required target");
  }
  const samples = STAFF_WORKSPACE_PERFORMANCE_TARGETS.flatMap((target) => {
    const value = byTarget.get(target);
    if (!value || value.revision !== revision) {
      throw new Error(`Authenticated performance evidence revision mismatch for ${target}`);
    }
    if (value.cold.target !== target || value.cold.warm !== false) {
      throw new Error(`Authenticated performance cold sample is malformed for ${target}`);
    }
    if (value.warm.target !== target || value.warm.warm !== true) {
      throw new Error(`Authenticated performance warm sample is malformed for ${target}`);
    }
    return [value.cold, value.warm];
  });
  return {
    createdAt,
    environment: "authenticated explicit non-production browser target",
    pendingTargets: [],
    revision,
    samples,
    schemaVersion: 2,
    sourceFiles,
    sourceHash,
  };
}

if (import.meta.main) {
  try {
    const root = resolve(import.meta.dir, "../..");
    const baseUrl = process.env.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";
    validateE2ePreflight(process.env, baseUrl, true);
    const revision = resolveWorkspaceRevision(root);
    const runDir = resolve(root, ".scratch/staff-workspace-performance", revision);
    mkdirSync(runDir, { recursive: true });
    const result = spawnSync(
      "bunx",
      ["playwright", "test", "e2e/specs/staff-workspace-performance.spec.ts"],
      {
        cwd: root,
        env: {
          ...process.env,
          E2E_EVIDENCE_REVISION: revision,
          E2E_PERFORMANCE_RUN_DIR: runDir,
          E2E_STRICT: "1",
        },
        stdio: "inherit",
      }
    );
    if (result.status !== 0) {
      throw new Error("Strict authenticated performance browser run failed");
    }
    const values = STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) =>
      JSON.parse(readFileSync(resolve(runDir, `${target}.json`), "utf8"))
    ) as RawPerformanceEvidence[];
    const sourceFiles = staffWorkspacePerformanceInputs(root);
    const evidence = consolidateAuthenticatedPerformanceEvidence(
      revision,
      values,
      sourceFiles,
      computePerformanceSourceHash(root, sourceFiles)
    );
    const output = resolve(runDir, "evidence.json");
    writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`Wrote strict authenticated performance evidence to ${output}`);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Performance evidence collection failed"
    );
    process.exitCode = 1;
  }
}
