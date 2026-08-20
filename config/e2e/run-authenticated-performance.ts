import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { E2E_ROLE_PROFILE_KEYS } from "../../e2e/fixtures/staffProfiles";
import { isRuntimeNumber } from "../../src/lib/runtimeValues";
import type { JsonObject } from "../lib/jsonValue";
import {
  computePerformanceSourceHash,
  type PerformanceComparisonProvenance,
  parseStaffWorkspacePerformanceBaseline,
} from "../release/check-performance-budgets";
import { planPerformanceComparisons } from "../release/performance-comparison";
import { staffWorkspacePerformanceInputs } from "../release/performance-inputs";
import {
  evaluateStaffWorkspacePerformanceBudget,
  evaluateStaffWorkspaceRelativeRegression,
  isStaffWorkspaceRelativeMetricComparable,
  parseStaffWorkspacePerformanceBudgetManifest,
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
  type StaffWorkspacePerformanceSample,
  type StaffWorkspacePerformanceTarget,
} from "../release/staff-workspace-performance-budget";
import { resolveWorkspaceRevision } from "../release/verify-local";
import { collectZeroE2eTargetCleanupAudit, type E2eTargetCleanupAudit } from "./cleanup-audit";
import { validateE2ePreflight } from "./preflight";
import {
  type ApprovedE2eTarget,
  readApprovedE2eTarget,
  validateApprovedE2eTargetManifest,
} from "./target-identity";

interface RawPerformanceEvidence {
  cold: JsonObject;
  revision: string;
  target: StaffWorkspacePerformanceTarget;
  warm: JsonObject;
}

const SAMPLE_METRICS: readonly (keyof StaffWorkspacePerformanceSample)[] = [
  "applicationPayloadBytes",
  "duplicateSubscriptions",
  "firstContentMs",
  "logicalSubscriptions",
  "routeReadyMs",
  "routeResourceTransferBytes",
] as const;
const EVIDENCE_TRIAL_COUNT = 5;
const CURRENT_MEASUREMENT_VERSION = 2;
const STAFF_CACHE_MODEL = "cold-new-context/warm-prefetched-same-context" as const;

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const value = ordered[Math.floor(ordered.length / 2)];
  if (value === undefined) {
    throw new Error("Cannot calculate a median without samples");
  }
  return value;
}

function p95(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const value = ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)];
  if (value === undefined) {
    throw new Error("Cannot calculate p95 without samples");
  }
  return value;
}

function evidenceSample(
  value: JsonObject,
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
      if (!(isRuntimeNumber(measured) && Number.isFinite(measured)) || measured < 0) {
        throw new Error(`Authenticated performance ${target} ${String(metric)} is malformed`);
      }
      return [metric, measured];
    })
  );
  // SAFETY: metrics is validated against every numeric sample field before target and warm are attached.
  return { ...metrics, target, warm } as StaffWorkspacePerformanceSample;
}

export function consolidateAuthenticatedPerformanceEvidence(
  revision: string,
  values: RawPerformanceEvidence[],
  sourceFiles: string[],
  sourceHash: string,
  targetBinding: ApprovedE2eTarget,
  context: {
    browser: string;
    cleanupAudit: E2eTargetCleanupAudit;
    comparison: PerformanceComparisonProvenance;
  },
  createdAt = new Date().toISOString()
) {
  const [approvedTarget] = validateApprovedE2eTargetManifest({
    schemaVersion: 3,
    targets: [targetBinding],
  }).targets;
  if (!approvedTarget) {
    throw new Error("Authenticated performance requires an approved target");
  }
  if (revision !== approvedTarget.revision) {
    throw new Error("Authenticated performance revision does not match the approved target");
  }
  if (values.length !== STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * EVIDENCE_TRIAL_COUNT) {
    throw new Error(
      `Authenticated performance evidence requires exactly ${EVIDENCE_TRIAL_COUNT} trials per target`
    );
  }
  const groupedSamples = STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) => {
    const targetTrials = values.filter((value) => value.target === target);
    if (targetTrials.length !== EVIDENCE_TRIAL_COUNT) {
      throw new Error(
        `Authenticated performance evidence requires ${EVIDENCE_TRIAL_COUNT} trials for ${target}`
      );
    }
    if (targetTrials.some((value) => value.revision !== revision)) {
      throw new Error(`Authenticated performance evidence revision mismatch for ${target}`);
    }
    return [false, true].map((warm) => {
      const trialSamples = targetTrials.map((value) =>
        evidenceSample(warm ? value.warm : value.cold, target, warm)
      );
      const aggregate = (percentile: (values: number[]) => number) =>
        // SAFETY: each collected row is produced by collectPerformanceSample and therefore has the sample contract.
        ({
          ...Object.fromEntries(
            SAMPLE_METRICS.map((metric) => [
              metric,
              percentile(trialSamples.map((sample) => sample[metric])),
            ])
          ),
          target,
          warm,
        }) as StaffWorkspacePerformanceSample;
      return { median: aggregate(median), p95: aggregate(p95) };
    });
  });
  const samples = groupedSamples.flatMap((target) => target.map((sample) => sample.median));
  const p95Samples = groupedSamples.flatMap((target) => target.map((sample) => sample.p95));
  return {
    browser: context.browser,
    cacheModel: STAFF_CACHE_MODEL,
    cleanupAudit: context.cleanupAudit,
    comparison: context.comparison,
    createdAt,
    environment: "authenticated explicit non-production browser target",
    fixtureCardinality: {
      customerProfiles: 1,
      routeTargets: STAFF_WORKSPACE_PERFORMANCE_TARGETS.length,
      staffProfiles: E2E_ROLE_PROFILE_KEYS.length,
    },
    measurementVersion: CURRENT_MEASUREMENT_VERSION,
    p95Samples,
    pendingTargets: [],
    revision,
    samples,
    schemaVersion: 5,
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
            E2E_PERFORMANCE_DEFER_BUDGETS: "1",
            E2E_PERFORMANCE_RUN_DIR: trialDir,
            E2E_PERFORMANCE_TRIAL_INDEX: String(trial),
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
    const acceptedPath = resolve(root, "config/release/staff-workspace-performance-baseline.json");
    const acceptedRaw = readFileSync(acceptedPath, "utf8");
    const accepted = parseStaffWorkspacePerformanceBaseline(JSON.parse(acceptedRaw));
    const browser = await chromium.launch({ headless: true });
    const browserVersion = browser.version();
    await browser.close();
    const cleanupAudit = await collectZeroE2eTargetCleanupAudit(approvedTarget, root);
    const comparison: PerformanceComparisonProvenance = {
      acceptedBaselineDigest: createHash("sha256").update(acceptedRaw).digest("hex"),
      acceptedRevision: accepted.revision,
      acceptedSourceHash: accepted.sourceHash,
      fixedFindingCount: 0,
      p95RelativeComparison: "fixed_only",
      relativeFindingCount: 0,
    };
    const evidence = consolidateAuthenticatedPerformanceEvidence(
      revision,
      values,
      sourceFiles,
      computePerformanceSourceHash(root, sourceFiles),
      approvedTarget,
      { browser: `Chromium ${browserVersion}`, cleanupAudit, comparison }
    );
    const budget = parseStaffWorkspacePerformanceBudgetManifest(
      JSON.parse(
        readFileSync(
          resolve(root, "config/release/staff-workspace-performance-budgets.json"),
          "utf8"
        )
      )
    );
    const rawFixedFindings = values.flatMap((value) =>
      [false, true].flatMap((warm) =>
        evaluateStaffWorkspacePerformanceBudget(
          budget,
          evidenceSample(warm ? value.warm : value.cold, value.target, warm)
        )
      )
    );
    if (rawFixedFindings.length > 0) {
      console.warn(
        `Authenticated performance observed ${rawFixedFindings.length} raw-trial fixed-budget warnings; the five-trial aggregates remain authoritative`
      );
    }
    const fixedFindings = [...evidence.samples, ...evidence.p95Samples].flatMap((sample) =>
      evaluateStaffWorkspacePerformanceBudget(budget, sample)
    );
    if (fixedFindings.length > 0) {
      throw new Error(
        `Authenticated performance candidate failed ${fixedFindings.length} fixed budgets: ${JSON.stringify(fixedFindings)}`
      );
    }
    const comparisonPlan = planPerformanceComparisons({
      acceptedMedian: accepted.samples,
      candidateMedian: evidence.samples,
      candidateP95: evidence.p95Samples,
      key: (sample) => `${sample.target}:${sample.warm}`,
    });
    if (comparisonPlan.p95RelativeComparison !== comparison.p95RelativeComparison) {
      throw new Error("Authenticated performance comparison provenance is inconsistent");
    }
    const relativeFindings = comparisonPlan.pairs.flatMap(
      ({ accepted: acceptedSample, candidate }) =>
        evaluateStaffWorkspaceRelativeRegression(budget, candidate, acceptedSample).filter(
          (finding) =>
            isStaffWorkspaceRelativeMetricComparable(
              accepted.measurementVersion,
              evidence.measurementVersion,
              finding.metric
            )
        )
    );
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
