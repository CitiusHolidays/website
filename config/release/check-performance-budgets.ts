import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { type E2eTargetCleanupAudit, parseZeroE2eTargetCleanupAudit } from "../e2e/cleanup-audit";
import { type ApprovedE2eTarget, validateApprovedE2eTargetManifest } from "../e2e/target-identity";
import type { P95RelativeComparison } from "./performance-comparison";
import {
  hasExactPerformanceInputs,
  publicRuntimePerformanceInputs,
  staffWorkspacePerformanceInputs,
} from "./performance-inputs";
import {
  evaluatePublicRuntimePerformance,
  isPublicRuntimeBaselineFresh,
  parsePublicRuntimeBaseline,
  parsePublicRuntimeBudgetManifest,
} from "./public-runtime-performance";
import {
  evaluateStaffWorkspaceBackendCost,
  parseStaffWorkspaceBackendCostBaseline,
  parseStaffWorkspaceBackendCostBudgetManifest,
} from "./staff-workspace-backend-cost";
import {
  evaluateStaffWorkspacePerformanceBudget,
  parseStaffWorkspacePerformanceBudgetManifest,
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
  type StaffWorkspacePerformanceSample,
} from "./staff-workspace-performance-budget";

const PUBLIC_PERFORMANCE_BUDGET_TARGETS = [
  "public/gallery/hero-poster.webp",
  "public/hero-sm.mp4",
  "public/hero.mp4",
] as const;

const STAFF_SAMPLE_METRICS = [
  "applicationPayloadBytes",
  "duplicateSubscriptions",
  "firstContentMs",
  "logicalSubscriptions",
  "routeReadyMs",
  "routeResourceTransferBytes",
] as const satisfies readonly (keyof StaffWorkspacePerformanceSample)[];

const LEGACY_STAFF_BASELINE_KEYS = [
  "createdAt",
  "environment",
  "pendingTargets",
  "revision",
  "samples",
  "schemaVersion",
  "sourceFiles",
  "sourceHash",
  "targetBinding",
] as const;
const STAFF_BASELINE_KEYS = [
  ...LEGACY_STAFF_BASELINE_KEYS,
  "measurementVersion",
  "trialCount",
] as const;
const STAFF_BASELINE_V5_KEYS = [
  ...STAFF_BASELINE_KEYS,
  "browser",
  "cacheModel",
  "cleanupAudit",
  "comparison",
  "fixtureCardinality",
  "p95Samples",
] as const;
const STAFF_SAMPLE_KEYS = [...STAFF_SAMPLE_METRICS, "target", "warm"] as const;
const STAFF_BASELINE_ENVIRONMENT = "authenticated explicit non-production browser target";

export interface PerformanceBudget {
  maxBytes: number;
  path: string;
  purpose: string;
}

export interface PerformanceBudgetManifest {
  budgets: PerformanceBudget[];
  schemaVersion: number;
}

export interface PerformanceBudgetFinding {
  actualBytes: number | undefined;
  maxBytes: number;
  path: string;
  purpose: string;
}

export interface StaffWorkspacePerformanceBaseline {
  browser?: string;
  cacheModel?: "cold-new-context/warm-prefetched-same-context";
  cleanupAudit?: E2eTargetCleanupAudit;
  comparison?: PerformanceComparisonProvenance;
  createdAt: string;
  environment: string;
  fixtureCardinality?: { customerProfiles: number; routeTargets: number; staffProfiles: number };
  measurementVersion: 1 | 2;
  p95Samples?: StaffWorkspacePerformanceSample[];
  pendingTargets: StaffWorkspacePerformanceSample["target"][];
  revision: string;
  samples: StaffWorkspacePerformanceSample[];
  schemaVersion: 3 | 4 | 5;
  sourceFiles: string[];
  sourceHash: string;
  targetBinding: ApprovedE2eTarget;
  trialCount: number;
}

export interface PerformanceComparisonProvenance {
  acceptedBaselineDigest: string;
  acceptedRevision: string;
  acceptedSourceHash: string;
  fixedFindingCount: 0;
  p95RelativeComparison: P95RelativeComparison;
  relativeFindingCount: 0;
}

const EXACT_REVISION_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CHROMIUM_VERSION_PATTERN = /^Chromium \d+(?:\.\d+){3}$/;
const STAFF_CACHE_MODEL = "cold-new-context/warm-prefetched-same-context" as const;

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], path: string) {
  const expected = new Set(keys);
  if (Object.keys(value).some((key) => !expected.has(key))) {
    throw new Error(`${path} contains an undeclared field`);
  }
}

function readNonemptyString(record: Record<string, unknown>, field: string, path: string) {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}.${field} must be a non-empty string`);
  }
  return value;
}

function readIsoTimestamp(record: Record<string, unknown>, field: string, path: string) {
  const value = readNonemptyString(record, field, path);
  try {
    if (new Date(value).toISOString() !== value) {
      throw new Error("timestamp is not canonical");
    }
  } catch (error) {
    throw new Error(`${path}.${field} must be a canonical ISO timestamp`, { cause: error });
  }
  return value;
}

function parseTargetBinding(value: unknown): ApprovedE2eTarget {
  try {
    return validateApprovedE2eTargetManifest({ schemaVersion: 3, targets: [value] }).targets[0]!;
  } catch (error) {
    throw new Error("baseline.targetBinding must be an approved exact non-production target pair", {
      cause: error,
    });
  }
}

function parseStaffBaselineSchema(value: Record<string, unknown>) {
  const { schemaVersion } = value;
  if (!(schemaVersion === 3 || schemaVersion === 4 || schemaVersion === 5)) {
    throw new Error(
      `baseline.schemaVersion must be 3, 4, or 5; migrate unsupported version ${String(schemaVersion)}`
    );
  }
  let keys = STAFF_BASELINE_V5_KEYS;
  if (schemaVersion === 3) {
    keys = LEGACY_STAFF_BASELINE_KEYS;
  } else if (schemaVersion === 4) {
    keys = STAFF_BASELINE_KEYS;
  }
  assertExactKeys(value, keys, "baseline");
  if (schemaVersion === 3) {
    return { measurementVersion: 1 as const, schemaVersion, trialCount: 1 };
  }
  const { measurementVersion, trialCount } = value;
  if (measurementVersion !== 2) {
    throw new Error("baseline.measurementVersion must be 2 for schemaVersion 4 or 5");
  }
  if (
    typeof trialCount !== "number" ||
    !Number.isInteger(trialCount) ||
    trialCount < 3 ||
    trialCount % 2 === 0
  ) {
    throw new Error("baseline.trialCount must be an odd integer of at least 3");
  }
  return { measurementVersion, schemaVersion, trialCount };
}

function parseComparisonProvenance(value: unknown, path: string): PerformanceComparisonProvenance {
  assertRecord(value, path);
  assertExactKeys(
    value,
    [
      "acceptedBaselineDigest",
      "acceptedRevision",
      "acceptedSourceHash",
      "fixedFindingCount",
      "p95RelativeComparison",
      "relativeFindingCount",
    ],
    path
  );
  for (const field of ["acceptedBaselineDigest", "acceptedSourceHash"] as const) {
    if (typeof value[field] !== "string" || !SHA256_PATTERN.test(value[field])) {
      throw new Error(`${path}.${field} must be a SHA-256 digest`);
    }
  }
  if (
    typeof value.acceptedRevision !== "string" ||
    !EXACT_REVISION_PATTERN.test(value.acceptedRevision)
  ) {
    throw new Error(`${path}.acceptedRevision must be an exact Git revision`);
  }
  if (value.fixedFindingCount !== 0 || value.relativeFindingCount !== 0) {
    throw new Error(`${path} must record zero accepted fixed and relative findings`);
  }
  if (
    !(
      value.p95RelativeComparison === "fixed_only" ||
      value.p95RelativeComparison === "included" ||
      value.p95RelativeComparison === "not_available"
    )
  ) {
    throw new Error(`${path}.p95RelativeComparison is invalid`);
  }
  return {
    acceptedBaselineDigest: value.acceptedBaselineDigest,
    acceptedRevision: value.acceptedRevision,
    acceptedSourceHash: value.acceptedSourceHash,
    fixedFindingCount: 0,
    p95RelativeComparison: value.p95RelativeComparison,
    relativeFindingCount: 0,
  };
}

function parseFixtureCardinality(value: unknown) {
  assertRecord(value, "baseline.fixtureCardinality");
  assertExactKeys(
    value,
    ["customerProfiles", "routeTargets", "staffProfiles"],
    "baseline.fixtureCardinality"
  );
  const result = Object.fromEntries(
    ["customerProfiles", "routeTargets", "staffProfiles"].map((field) => {
      const count = readFiniteNonnegativeNumber(value, field, "baseline.fixtureCardinality");
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`baseline.fixtureCardinality.${field} must be a positive integer`);
      }
      return [field, count];
    })
  ) as { customerProfiles: number; routeTargets: number; staffProfiles: number };
  if (result.routeTargets !== STAFF_WORKSPACE_PERFORMANCE_TARGETS.length) {
    throw new Error("baseline.fixtureCardinality.routeTargets must match the route matrix");
  }
  return result;
}

function readFiniteNonnegativeNumber(record: Record<string, unknown>, field: string, path: string) {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path}.${field} must be a finite nonnegative number`);
  }
  return value;
}

function assertSchemaVersion(value: Record<string, unknown>, path: string) {
  if (value.schemaVersion !== 1) {
    throw new Error(
      `${path}.schemaVersion must be 1; migrate unsupported version ${String(value.schemaVersion)}`
    );
  }
}

export function parsePerformanceBudgetManifest(value: unknown): PerformanceBudgetManifest {
  assertRecord(value, "manifest");
  assertSchemaVersion(value, "manifest");
  if (!Array.isArray(value.budgets) || value.budgets.length === 0) {
    throw new Error("manifest.budgets must contain every required public performance target");
  }

  const knownTargets = new Set<string>(PUBLIC_PERFORMANCE_BUDGET_TARGETS);
  const seen = new Set<string>();
  const budgets = value.budgets.map((entry, index) => {
    const path = `manifest.budgets[${index}]`;
    assertRecord(entry, path);
    const target = readNonemptyString(entry, "path", path);
    if (!knownTargets.has(target)) {
      throw new Error(`${path}.path is not a known public performance target: ${target}`);
    }
    if (seen.has(target)) {
      throw new Error(`${path}.path is a duplicate public performance target: ${target}`);
    }
    seen.add(target);
    return {
      maxBytes: readFiniteNonnegativeNumber(entry, "maxBytes", path),
      path: target,
      purpose: readNonemptyString(entry, "purpose", path),
    };
  });
  for (const target of PUBLIC_PERFORMANCE_BUDGET_TARGETS) {
    if (!seen.has(target)) {
      throw new Error(`manifest.budgets is missing required target ${target}`);
    }
  }
  return { budgets, schemaVersion: 1 };
}

function parseStaffWorkspaceSample(value: unknown, path: string): StaffWorkspacePerformanceSample {
  assertRecord(value, path);
  assertExactKeys(value, STAFF_SAMPLE_KEYS, path);
  if (
    typeof value.target !== "string" ||
    !STAFF_WORKSPACE_PERFORMANCE_TARGETS.includes(
      value.target as (typeof STAFF_WORKSPACE_PERFORMANCE_TARGETS)[number]
    )
  ) {
    throw new Error(`${path}.target must be a known Staff Workspace target`);
  }
  if (typeof value.warm !== "boolean") {
    throw new Error(`${path}.warm must be a boolean`);
  }
  const metrics = Object.fromEntries(
    STAFF_SAMPLE_METRICS.map((metric) => [metric, readFiniteNonnegativeNumber(value, metric, path)])
  );
  return {
    ...metrics,
    target: value.target,
    warm: value.warm,
  } as StaffWorkspacePerformanceSample;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: fail-closed versioned evidence validation is intentionally explicit
export function parseStaffWorkspacePerformanceBaseline(
  value: unknown
): StaffWorkspacePerformanceBaseline {
  assertRecord(value, "baseline");
  const { measurementVersion, schemaVersion, trialCount } = parseStaffBaselineSchema(value);
  const createdAt = readIsoTimestamp(value, "createdAt", "baseline");
  const environment = readNonemptyString(value, "environment", "baseline");
  if (environment !== STAFF_BASELINE_ENVIRONMENT) {
    throw new Error(`baseline.environment must be ${STAFF_BASELINE_ENVIRONMENT}`);
  }
  const revision = readNonemptyString(value, "revision", "baseline");
  if (!EXACT_REVISION_PATTERN.test(revision)) {
    throw new Error("baseline.revision must be an exact 40-character Git revision");
  }
  const targetBinding = parseTargetBinding(value.targetBinding);
  if (targetBinding.revision !== revision) {
    throw new Error("baseline.targetBinding revision must match baseline.revision");
  }
  const sourceHash = readNonemptyString(value, "sourceHash", "baseline");
  if (!SHA256_PATTERN.test(sourceHash)) {
    throw new Error("baseline.sourceHash must be a SHA-256 digest");
  }
  if (!Array.isArray(value.pendingTargets)) {
    throw new Error("baseline.pendingTargets must be an array");
  }
  const knownTargets = new Set<string>(STAFF_WORKSPACE_PERFORMANCE_TARGETS);
  const pendingTargets = value.pendingTargets.map((target, index) => {
    if (typeof target !== "string" || !knownTargets.has(target)) {
      throw new Error(`baseline.pendingTargets[${index}] must be a known target`);
    }
    return target as StaffWorkspacePerformanceSample["target"];
  });
  if (new Set(pendingTargets).size !== pendingTargets.length) {
    throw new Error("baseline.pendingTargets must not contain duplicates");
  }
  const pendingTargetSet = new Set(pendingTargets);
  if (!Array.isArray(value.sourceFiles) || value.sourceFiles.length === 0) {
    throw new Error("baseline.sourceFiles must contain at least one source path");
  }
  const sourceFiles = value.sourceFiles.map((sourceFile, index) => {
    if (
      typeof sourceFile !== "string" ||
      sourceFile.trim().length === 0 ||
      sourceFile.startsWith("/") ||
      sourceFile.includes("\\") ||
      sourceFile.split("/").includes("..")
    ) {
      throw new Error(`baseline.sourceFiles[${index}] must be a safe repository-relative path`);
    }
    return sourceFile;
  });
  if (new Set(sourceFiles).size !== sourceFiles.length) {
    throw new Error("baseline.sourceFiles must not contain duplicates");
  }
  if (!Array.isArray(value.samples)) {
    throw new Error("baseline.samples must be an array");
  }
  const seen = new Set<string>();
  const samples = value.samples.map((sample, index) => {
    const parsed = parseStaffWorkspaceSample(sample, `baseline.samples[${index}]`);
    if (pendingTargetSet.has(parsed.target)) {
      throw new Error(`baseline.samples contains pending target ${parsed.target}`);
    }
    const key = `${parsed.target}:${parsed.warm ? "warm" : "cold"}`;
    if (seen.has(key)) {
      throw new Error(`baseline.samples contains duplicate ${parsed.target} ${key.split(":")[1]}`);
    }
    seen.add(key);
    return parsed;
  });
  for (const target of STAFF_WORKSPACE_PERFORMANCE_TARGETS) {
    if (pendingTargetSet.has(target)) {
      continue;
    }
    for (const mode of ["cold", "warm"] as const) {
      if (!seen.has(`${target}:${mode}`)) {
        throw new Error(`baseline.samples is missing ${target} ${mode}`);
      }
    }
  }
  let browser: string | undefined;
  let cacheModel: typeof STAFF_CACHE_MODEL | undefined;
  let cleanupAudit: E2eTargetCleanupAudit | undefined;
  let comparison: PerformanceComparisonProvenance | undefined;
  let fixtureCardinality: StaffWorkspacePerformanceBaseline["fixtureCardinality"];
  let p95Samples: StaffWorkspacePerformanceSample[] | undefined;
  if (schemaVersion === 5) {
    browser = readNonemptyString(value, "browser", "baseline");
    if (!CHROMIUM_VERSION_PATTERN.test(browser)) {
      throw new Error("baseline.browser must identify the measured Chromium version");
    }
    if (value.cacheModel !== STAFF_CACHE_MODEL) {
      throw new Error(`baseline.cacheModel must be ${STAFF_CACHE_MODEL}`);
    }
    cacheModel = STAFF_CACHE_MODEL;
    cleanupAudit = parseZeroE2eTargetCleanupAudit(value.cleanupAudit, targetBinding.id);
    comparison = parseComparisonProvenance(value.comparison, "baseline.comparison");
    fixtureCardinality = parseFixtureCardinality(value.fixtureCardinality);
    if (!Array.isArray(value.p95Samples)) {
      throw new Error("baseline.p95Samples must be an array");
    }
    const p95Seen = new Set<string>();
    p95Samples = value.p95Samples.map((sample, index) => {
      const parsed = parseStaffWorkspaceSample(sample, `baseline.p95Samples[${index}]`);
      const key = `${parsed.target}:${parsed.warm ? "warm" : "cold"}`;
      if (p95Seen.has(key)) {
        throw new Error(`baseline.p95Samples contains duplicate ${key}`);
      }
      p95Seen.add(key);
      return parsed;
    });
    if (
      p95Samples.length !== STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * 2 ||
      [...seen].some((key) => !p95Seen.has(key))
    ) {
      throw new Error("baseline.p95Samples must contain every measured cold/warm scenario");
    }
  }
  return {
    ...(browser ? { browser } : {}),
    ...(cacheModel ? { cacheModel } : {}),
    ...(cleanupAudit ? { cleanupAudit } : {}),
    ...(comparison ? { comparison } : {}),
    createdAt,
    environment,
    ...(fixtureCardinality ? { fixtureCardinality } : {}),
    measurementVersion,
    pendingTargets,
    ...(p95Samples ? { p95Samples } : {}),
    revision,
    samples,
    schemaVersion,
    sourceFiles,
    sourceHash,
    targetBinding,
    trialCount,
  };
}

export function computePerformanceSourceHash(root: string, sourceFiles: string[]) {
  const hash = createHash("sha256");
  for (const sourceFile of [...sourceFiles].sort()) {
    hash.update(sourceFile);
    hash.update("\0");
    hash.update(readFileSync(resolve(root, sourceFile)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export const computeStaffWorkspacePerformanceSourceHash = computePerformanceSourceHash;

export function isStaffWorkspacePerformanceBaselineFresh(
  baseline: StaffWorkspacePerformanceBaseline,
  currentSourceHash: string,
  currentSourceFiles: readonly string[] = baseline.sourceFiles
) {
  return Boolean(
    baseline.measurementVersion === 2 &&
      baseline.schemaVersion === 5 &&
      baseline.trialCount === 5 &&
      baseline.pendingTargets.length === 0 &&
      baseline.revision === baseline.targetBinding.revision &&
      baseline.sourceFiles.length > 0 &&
      hasExactPerformanceInputs(baseline.sourceFiles, currentSourceFiles) &&
      baseline.sourceHash &&
      baseline.sourceHash === currentSourceHash &&
      baseline.p95Samples?.length === STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * 2 &&
      baseline.comparison?.fixedFindingCount === 0 &&
      baseline.comparison.relativeFindingCount === 0 &&
      baseline.cleanupAudit?.targetId === baseline.targetBinding.id
  );
}

export function evaluatePerformanceBudgets(
  manifest: PerformanceBudgetManifest,
  sizes: Record<string, number | undefined>
): PerformanceBudgetFinding[] {
  const findings: PerformanceBudgetFinding[] = [];
  for (const budget of manifest.budgets) {
    const actualBytes = sizes[budget.path];
    if (actualBytes === undefined || actualBytes > budget.maxBytes) {
      findings.push({
        actualBytes,
        maxBytes: budget.maxBytes,
        path: budget.path,
        purpose: budget.purpose,
      });
    }
  }
  return findings;
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  const manifest = parsePerformanceBudgetManifest(
    JSON.parse(readFileSync(resolve(import.meta.dir, "performance-budgets.json"), "utf8"))
  );
  const sizes = Object.fromEntries(
    manifest.budgets.map((budget) => {
      try {
        return [budget.path, statSync(resolve(root, budget.path)).size];
      } catch {
        return [budget.path, undefined];
      }
    })
  );
  const findings = evaluatePerformanceBudgets(manifest, sizes);
  const staffManifest = parseStaffWorkspacePerformanceBudgetManifest(
    JSON.parse(
      readFileSync(resolve(import.meta.dir, "staff-workspace-performance-budgets.json"), "utf8")
    )
  );
  const staffBaseline = parseStaffWorkspacePerformanceBaseline(
    JSON.parse(
      readFileSync(resolve(import.meta.dir, "staff-workspace-performance-baseline.json"), "utf8")
    )
  );
  const staffBackendCostManifest = parseStaffWorkspaceBackendCostBudgetManifest(
    JSON.parse(
      readFileSync(resolve(import.meta.dir, "staff-workspace-backend-cost-budgets.json"), "utf8")
    )
  );
  const staffBackendCostBaseline = parseStaffWorkspaceBackendCostBaseline(
    JSON.parse(
      readFileSync(resolve(import.meta.dir, "staff-workspace-backend-cost-baseline.json"), "utf8")
    )
  );
  const publicRuntimeManifest = parsePublicRuntimeBudgetManifest(
    JSON.parse(
      readFileSync(resolve(import.meta.dir, "public-runtime-performance-budgets.json"), "utf8")
    )
  );
  const publicRuntimeBaseline = parsePublicRuntimeBaseline(
    JSON.parse(
      readFileSync(resolve(import.meta.dir, "public-runtime-performance-baseline.json"), "utf8")
    )
  );
  const currentPublicRuntimeSourceFiles = publicRuntimePerformanceInputs(root);
  const currentPublicRuntimeSourceHash = computePerformanceSourceHash(
    root,
    currentPublicRuntimeSourceFiles
  );
  const publicRuntimeBaselineFresh = isPublicRuntimeBaselineFresh(
    publicRuntimeBaseline,
    currentPublicRuntimeSourceHash,
    currentPublicRuntimeSourceFiles
  );
  const publicRuntimeFindings = [
    ...publicRuntimeBaseline.samples,
    ...(publicRuntimeBaseline.p95Samples ?? []),
  ].flatMap((sample) => evaluatePublicRuntimePerformance(publicRuntimeManifest, sample));
  const publicRuntimeFailures = publicRuntimeFindings.filter(
    (finding) => finding.severity === "failure"
  );
  const publicRuntimeWarnings = publicRuntimeFindings.filter(
    (finding) => finding.severity === "warning"
  );
  const currentStaffSourceFiles = staffWorkspacePerformanceInputs(root);
  const currentStaffSourceHash = computeStaffWorkspacePerformanceSourceHash(
    root,
    currentStaffSourceFiles
  );
  const staffBaselineFresh = isStaffWorkspacePerformanceBaselineFresh(
    staffBaseline,
    currentStaffSourceHash,
    currentStaffSourceFiles
  );
  const staffFindings = [...staffBaseline.samples, ...(staffBaseline.p95Samples ?? [])].flatMap(
    (sample) => evaluateStaffWorkspacePerformanceBudget(staffManifest, sample)
  );
  const staffBackendCostFindings = [
    ...staffBackendCostBaseline.samples,
    ...(staffBackendCostBaseline.p95Samples ?? []),
  ].flatMap((sample) => evaluateStaffWorkspaceBackendCost(staffBackendCostManifest, sample));
  const staffBackendCostFresh = Boolean(
    staffBackendCostBaseline.status === "measured" &&
      staffBackendCostBaseline.schemaVersion === 3 &&
      staffBackendCostBaseline.revision === staffBaseline.revision &&
      JSON.stringify(staffBackendCostBaseline.targetBinding) ===
        JSON.stringify(staffBaseline.targetBinding) &&
      staffBackendCostBaseline.p95Samples?.length ===
        STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * 2 &&
      staffBackendCostBaseline.trialCount === 5 &&
      staffBackendCostBaseline.comparison?.fixedFindingCount === 0 &&
      staffBackendCostBaseline.comparison.relativeFindingCount === 0 &&
      staffBackendCostBaseline.sourceHash === currentStaffSourceHash &&
      hasExactPerformanceInputs(staffBackendCostBaseline.sourceFiles, currentStaffSourceFiles)
  );
  if (
    findings.length > 0 ||
    staffFindings.length > 0 ||
    staffBackendCostFindings.length > 0 ||
    !staffBackendCostFresh ||
    staffBaseline.pendingTargets.length > 0 ||
    !staffBaselineFresh ||
    publicRuntimeFailures.length > 0 ||
    !publicRuntimeBaselineFresh
  ) {
    console.error("Performance budget check failed:");
    for (const finding of findings) {
      const actual = finding.actualBytes === undefined ? "missing" : `${finding.actualBytes} bytes`;
      console.error(
        `- ${finding.path} (${finding.purpose}) is ${actual}; budget is ${finding.maxBytes} bytes`
      );
    }
    for (const finding of staffFindings) {
      console.error(
        `- ${finding.target} ${finding.warm ? "warm" : "cold"} ${finding.metric} is ${finding.actual}; budget is ${finding.maximum}`
      );
    }
    for (const finding of staffBackendCostFindings) {
      console.error(
        `- backend ${finding.target} ${finding.warm ? "warm" : "cold"} ${finding.metric} is ${finding.actual}; budget is ${finding.maximum}`
      );
    }
    if (!staffBackendCostFresh) {
      console.error(
        staffBackendCostBaseline.status === "pending_target_measurement"
          ? "- authenticated Staff Workspace backend-cost evidence is pending an exact non-production target measurement"
          : `- authenticated Staff Workspace backend-cost baseline is stale for source hash ${currentStaffSourceHash}`
      );
    }
    if (staffBaseline.pendingTargets.length > 0) {
      console.error(
        `- authenticated Staff Workspace baseline is pending targets: ${staffBaseline.pendingTargets.join(", ")}`
      );
    }
    if (!staffBaselineFresh) {
      console.error(
        `- authenticated Staff Workspace baseline is stale; expected source hash ${staffBaseline.sourceHash || "missing"}, current hash is ${currentStaffSourceHash}`
      );
    }
    for (const finding of publicRuntimeFailures) {
      console.error(
        `- public ${finding.scenario} ${finding.metric} is ${finding.actual}; failure limit is ${finding.limit}`
      );
    }
    if (!publicRuntimeBaselineFresh) {
      console.error(
        `- public runtime baseline is stale; expected source hash ${publicRuntimeBaseline.sourceHash}, current hash is ${currentPublicRuntimeSourceHash}`
      );
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Performance budget check passed: ${manifest.budgets.length} assets, ${staffBaseline.samples.length} authenticated Staff Workspace samples, and ${publicRuntimeBaseline.samples.length} public runtime aggregates are within failure limits.`
    );
  }
  for (const finding of publicRuntimeWarnings) {
    console.warn(
      `Performance warning: public ${finding.scenario} ${finding.metric} is ${finding.actual}; warning limit is ${finding.limit}`
    );
  }
}
