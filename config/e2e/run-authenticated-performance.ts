import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computePerformanceSourceHash,
  parseStaffWorkspacePerformanceBaseline,
} from "../release/check-performance-budgets";
import { staffWorkspacePerformanceInputs } from "../release/performance-inputs";
import {
  evaluateStaffWorkspaceRelativeRegression,
  parseStaffWorkspacePerformanceBudgetManifest,
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
  type StaffWorkspacePerformanceSample,
  type StaffWorkspacePerformanceTarget,
} from "../release/staff-workspace-performance-budget";
import { resolveWorkspaceRevision } from "../release/verify-local";
import { validateE2ePreflight } from "./preflight";
import {
  type ApprovedE2eTarget,
  readApprovedE2eTarget,
  validateApprovedE2eTargetManifest,
} from "./target-identity";

interface RawPerformanceEvidence {
  cold: Record<string, unknown>;
  revision: string;
  target: StaffWorkspacePerformanceTarget;
  warm: Record<string, unknown>;
}

const SAMPLE_METRICS = [
  "applicationPayloadBytes",
  "duplicateSubscriptions",
  "firstContentMs",
  "logicalSubscriptions",
  "routeReadyMs",
  "routeResourceTransferBytes",
] as const satisfies readonly (keyof StaffWorkspacePerformanceSample)[];

function evidenceSample(
  value: Record<string, unknown>,
  target: StaffWorkspacePerformanceTarget,
  warm: boolean
): StaffWorkspacePerformanceSample {
  if (value.target !== target || value.warm !== warm) {
    throw new Error(
      `Authenticated performance ${warm ? "warm" : "cold"} sample is malformed for ${target}`
    );
  }
  const metrics = Object.fromEntries(
    SAMPLE_METRICS.map((metric) => {
      const measured = value[metric];
      if (typeof measured !== "number" || !Number.isFinite(measured) || measured < 0) {
        throw new Error(`Authenticated performance ${target} ${String(metric)} is malformed`);
      }
      return [metric, measured];
    })
  );
  return { ...metrics, target, warm } as StaffWorkspacePerformanceSample;
}

export function consolidateAuthenticatedPerformanceEvidence(
  revision: string,
  values: RawPerformanceEvidence[],
  sourceFiles: string[],
  sourceHash: string,
  targetBinding: ApprovedE2eTarget,
  createdAt = new Date().toISOString()
) {
  const approvedTarget = validateApprovedE2eTargetManifest({
    schemaVersion: 3,
    targets: [targetBinding],
  }).targets[0]!;
  if (revision !== approvedTarget.revision) {
    throw new Error("Authenticated performance revision does not match the approved target");
  }
  if (values.length !== STAFF_WORKSPACE_PERFORMANCE_TARGETS.length) {
    throw new Error("Authenticated performance evidence has an unexpected target count");
  }
  const byTarget = new Map(values.map((value) => [value.target, value]));
  if (byTarget.size !== STAFF_WORKSPACE_PERFORMANCE_TARGETS.length) {
    throw new Error("Authenticated performance evidence is missing a required target");
  }
  const samples = STAFF_WORKSPACE_PERFORMANCE_TARGETS.flatMap((target) => {
    const value = byTarget.get(target);
    if (!value || value.revision !== revision) {
      throw new Error(`Authenticated performance evidence revision mismatch for ${target}`);
    }
    return [evidenceSample(value.cold, target, false), evidenceSample(value.warm, target, true)];
  });
  return {
    createdAt,
    environment: "authenticated explicit non-production browser target",
    pendingTargets: [],
    revision,
    samples,
    schemaVersion: 3,
    sourceFiles,
    sourceHash,
    targetBinding: approvedTarget,
  };
}

if (import.meta.main) {
  try {
    const root = resolve(import.meta.dir, "../..");
    const baseUrl = process.env.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";
    const preflight = validateE2ePreflight(process.env, baseUrl, true);
    if (!preflight.target) {
      throw new Error("Authenticated performance requires an explicit non-production target");
    }
    const approvedTarget = readApprovedE2eTarget({
      baseUrl,
      convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
      manifestPath: process.env.E2E_TARGET_MANIFEST,
      root,
      target: preflight.target,
      targetId: process.env.E2E_TARGET_ID,
    });
    const revision = resolveWorkspaceRevision(root);
    if (revision !== approvedTarget.revision) {
      throw new Error(
        "Authenticated performance requires a clean checkout matching the approved deployed revision"
      );
    }
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
      computePerformanceSourceHash(root, sourceFiles),
      approvedTarget
    );
    const accepted = parseStaffWorkspacePerformanceBaseline(
      JSON.parse(
        readFileSync(
          resolve(root, "config/release/staff-workspace-performance-baseline.json"),
          "utf8"
        )
      )
    );
    const budget = parseStaffWorkspacePerformanceBudgetManifest(
      JSON.parse(
        readFileSync(
          resolve(root, "config/release/staff-workspace-performance-budgets.json"),
          "utf8"
        )
      )
    );
    const acceptedByScenario = new Map(
      accepted.samples.map((sample) => [`${sample.target}:${sample.warm}`, sample])
    );
    const relativeFindings = evidence.samples.flatMap((sample) => {
      const acceptedSample = acceptedByScenario.get(`${sample.target}:${sample.warm}`);
      if (!acceptedSample) {
        throw new Error(
          `Accepted Staff Workspace baseline is missing ${sample.target} ${sample.warm ? "warm" : "cold"}`
        );
      }
      return evaluateStaffWorkspaceRelativeRegression(budget, sample, acceptedSample);
    });
    if (relativeFindings.length > 0) {
      throw new Error(
        `Authenticated performance candidate failed ${relativeFindings.length} relative budgets: ${JSON.stringify(relativeFindings)}`
      );
    }
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
