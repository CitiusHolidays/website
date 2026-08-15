import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { type ApprovedE2eTarget, validateApprovedE2eTargetManifest } from "../e2e/target-identity";
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

const STAFF_BASELINE_KEYS = [
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
  createdAt: string;
  environment: string;
  pendingTargets: StaffWorkspacePerformanceSample["target"][];
  revision: string;
  samples: StaffWorkspacePerformanceSample[];
  schemaVersion: number;
  sourceFiles: string[];
  sourceHash: string;
  targetBinding: ApprovedE2eTarget;
}

const EXACT_REVISION_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

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

function parseStaffWorkspaceSample(value: unknown, index: number): StaffWorkspacePerformanceSample {
  const path = `baseline.samples[${index}]`;
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

export function parseStaffWorkspacePerformanceBaseline(
  value: unknown
): StaffWorkspacePerformanceBaseline {
  assertRecord(value, "baseline");
  assertExactKeys(value, STAFF_BASELINE_KEYS, "baseline");
  if (value.schemaVersion !== 3) {
    throw new Error(
      `baseline.schemaVersion must be 3; migrate unsupported version ${String(value.schemaVersion)}`
    );
  }
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
    const parsed = parseStaffWorkspaceSample(sample, index);
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
  return {
    createdAt,
    environment,
    pendingTargets,
    revision,
    samples,
    schemaVersion: 3,
    sourceFiles,
    sourceHash,
    targetBinding,
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
    baseline.pendingTargets.length === 0 &&
      baseline.revision === baseline.targetBinding.revision &&
      baseline.sourceFiles.length > 0 &&
      hasExactPerformanceInputs(baseline.sourceFiles, currentSourceFiles) &&
      baseline.sourceHash &&
      baseline.sourceHash === currentSourceHash
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
  const publicRuntimeFindings = publicRuntimeBaseline.samples.flatMap((sample) =>
    evaluatePublicRuntimePerformance(publicRuntimeManifest, sample)
  );
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
  const staffFindings = staffBaseline.samples.flatMap((sample) =>
    evaluateStaffWorkspacePerformanceBudget(staffManifest, sample)
  );
  const staffBackendCostFindings = staffBackendCostBaseline.samples.flatMap((sample) =>
    evaluateStaffWorkspaceBackendCost(staffBackendCostManifest, sample)
  );
  const staffBackendCostFresh = Boolean(
    staffBackendCostBaseline.status === "measured" &&
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
