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
const EVIDENCE_TRIAL_COUNT = 3;
const CURRENT_MEASUREMENT_VERSION = 2;

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)]!;
}

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
  if (values.length !== STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * EVIDENCE_TRIAL_COUNT) {
    throw new Error("Authenticated performance evidence requires exactly three trials per target");
  }
  const samples = STAFF_WORKSPACE_PERFORMANCE_TARGETS.flatMap((target) => {
    const targetTrials = values.filter((value) => value.target === target);
    if (targetTrials.length !== EVIDENCE_TRIAL_COUNT) {
      throw new Error(`Authenticated performance evidence requires three trials for ${target}`);
    }
    if (targetTrials.some((value) => value.revision !== revision)) {
      throw new Error(`Authenticated performance evidence revision mismatch for ${target}`);
    }
    return [false, true].map((warm) => {
      const trialSamples = targetTrials.map((value) =>
        evidenceSample(warm ? value.warm : value.cold, target, warm)
      );
      return {
        ...Object.fromEntries(
          SAMPLE_METRICS.map((metric) => [
            metric,
            median(trialSamples.map((sample) => sample[metric])),
          ])
        ),
        target,
        warm,
      } as StaffWorkspacePerformanceSample;
    });
  });
  return {
    createdAt,
    environment: "authenticated explicit non-production browser target",
    measurementVersion: CURRENT_MEASUREMENT_VERSION,
    pendingTargets: [],
    revision,
    samples,
    schemaVersion: 4,
    sourceFiles,
    sourceHash,
    targetBinding: approvedTarget,
    trialCount: EVIDENCE_TRIAL_COUNT,
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
    const values: RawPerformanceEvidence[] = [];
    for (let trial = 1; trial <= EVIDENCE_TRIAL_COUNT; trial += 1) {
      const trialDir = resolve(runDir, `trial-${trial}`);
      mkdirSync(trialDir, { recursive: true });
      console.log(`Running authenticated performance trial ${trial}/${EVIDENCE_TRIAL_COUNT}`);
      const result = spawnSync(
        "bunx",
        ["playwright", "test", "e2e/specs/staff-workspace-performance.spec.ts"],
        {
          cwd: root,
          env: {
            ...process.env,
            E2E_EVIDENCE_REVISION: revision,
            E2E_PERFORMANCE_RUN_DIR: trialDir,
            E2E_STRICT: "1",
          },
          stdio: "inherit",
        }
      );
      if (result.status !== 0) {
        throw new Error(`Strict authenticated performance browser trial ${trial} failed`);
      }
      values.push(
        ...STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) =>
          JSON.parse(readFileSync(resolve(trialDir, `${target}.json`), "utf8"))
        )
      );
    }
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
      const findings = evaluateStaffWorkspaceRelativeRegression(budget, sample, acceptedSample);
      if (
        accepted.measurementVersion === 1 &&
        evidence.measurementVersion === CURRENT_MEASUREMENT_VERSION
      ) {
        return findings.filter((finding) => finding.metric !== "routeResourceTransferBytes");
      }
      if (accepted.measurementVersion !== evidence.measurementVersion) {
        throw new Error(
          `Unsupported Staff Workspace measurement transition ${accepted.measurementVersion} -> ${evidence.measurementVersion}`
        );
      }
      return findings;
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
