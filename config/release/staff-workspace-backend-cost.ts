import { type ApprovedE2eTarget, validateApprovedE2eTargetManifest } from "../e2e/target-identity";
import type { P95RelativeComparison } from "./performance-comparison";
import {
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
  type StaffWorkspacePerformanceTarget,
} from "./staff-workspace-performance-budget";

const COST_METRICS = [
  "databaseIoReadBytes",
  "databaseReadBytes",
  "documentsRead",
  "executionMs",
  "occRetries",
] as const;
const GIT_REVISION_PATTERN = /^[a-f0-9]{7,64}$/i;
const PRODUCTION_LIKE_TARGET_PATTERN = /production|(^|[-_.])prod($|[-_.])/i;
const SOURCE_HASH_PATTERN = /^[a-f0-9]{64}$/i;

export interface StaffWorkspaceBackendCostSample {
  databaseIoReadBytes: number;
  databaseReadBytes: number;
  documentsRead: number;
  executionMs: number;
  occRetries: number;
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

interface StaffWorkspaceBackendCostBudget {
  maxDatabaseIoReadBytes: number;
  maxDatabaseReadBytes: number;
  maxDocumentsRead: number;
  maxExecutionMs: number;
  maxOccRetries: number;
}

interface StaffWorkspaceBackendCostRelativePolicy {
  maxIncreaseFraction: number;
  minAbsoluteIncrease: number;
}

export interface StaffWorkspaceBackendCostBudgetManifest {
  budgets: Record<
    StaffWorkspacePerformanceTarget,
    { cold: StaffWorkspaceBackendCostBudget; warm: StaffWorkspaceBackendCostBudget }
  >;
  relativeRegression: Record<
    (typeof COST_METRICS)[number],
    StaffWorkspaceBackendCostRelativePolicy
  >;
  schemaVersion: 3;
}

export interface StaffWorkspaceBackendCostFinding {
  actual: number;
  maximum: number;
  metric: keyof StaffWorkspaceBackendCostBudget;
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

export interface StaffWorkspaceBackendCostBaseline {
  capturedAt?: string;
  comparison?: {
    acceptedBaselineDigest: string;
    acceptedRevision: string;
    acceptedSourceHash: string;
    fixedFindingCount: 0;
    p95RelativeComparison: P95RelativeComparison;
    relativeFindingCount: 0;
  };
  environment: string;
  p95Samples?: StaffWorkspaceBackendCostSample[];
  provider?: BackendCostProviderProvenance;
  revision: null | string;
  samples: StaffWorkspaceBackendCostSample[];
  schemaVersion: 2 | 3;
  sourceFiles: string[];
  sourceHash: null | string;
  status: "measured" | "pending_target_measurement";
  target: null | { id: string; kind: "development" | "preview" };
  targetBinding?: ApprovedE2eTarget;
  trialCount?: number;
}

export interface StaffWorkspaceBackendCostMetricsExport {
  capturedAt?: string;
  p95Samples?: StaffWorkspaceBackendCostSample[];
  provider?: BackendCostProviderProvenance;
  revision: string;
  samples: StaffWorkspaceBackendCostSample[];
  schemaVersion: 2 | 3;
  target?: { id: string; kind: "development" | "preview" };
  targetBinding?: ApprovedE2eTarget;
  trialCount?: number;
}

export interface BackendCostProviderProvenance {
  captureCount: number;
  captureTimeoutMs: number;
  command: string;
  deployment: string;
  history: number;
  identityVerifiedAt: string;
  terminations: "stopped_after_trial"[];
}

export interface StaffWorkspaceBackendCostRelativeFinding {
  actual: number;
  baseline: number;
  limit: number;
  metric: (typeof COST_METRICS)[number];
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], path: string) {
  const expected = new Set(keys);
  const unexpected = Object.keys(value).find((key) => !expected.has(key));
  if (unexpected) {
    throw new Error(`${path}.${unexpected} is not an allowed field`);
  }
}

function finiteNonnegative(record: Record<string, unknown>, field: string, path: string) {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path}.${field} must be a finite nonnegative number`);
  }
  return value;
}

function parseRevision(value: unknown, path: string) {
  if (typeof value !== "string" || !GIT_REVISION_PATTERN.test(value.trim())) {
    throw new Error(`${path} must be a Git revision`);
  }
  return value;
}

function parseNonProductionTarget(value: unknown, path: string) {
  assertRecord(value, path);
  assertExactKeys(value, ["id", "kind"], path);
  if (!(value.kind === "development" || value.kind === "preview")) {
    throw new Error(`${path}.kind must be development or preview`);
  }
  if (
    typeof value.id !== "string" ||
    !value.id.startsWith(`${value.kind}-`) ||
    PRODUCTION_LIKE_TARGET_PATTERN.test(value.id)
  ) {
    throw new Error(`${path}.id must match its non-production kind`);
  }
  return { id: value.id, kind: value.kind };
}

function parseBudget(value: unknown, path: string): StaffWorkspaceBackendCostBudget {
  assertRecord(value, path);
  assertExactKeys(
    value,
    [
      "maxDatabaseIoReadBytes",
      "maxDatabaseReadBytes",
      "maxDocumentsRead",
      "maxExecutionMs",
      "maxOccRetries",
    ],
    path
  );
  return {
    maxDatabaseIoReadBytes: finiteNonnegative(value, "maxDatabaseIoReadBytes", path),
    maxDatabaseReadBytes: finiteNonnegative(value, "maxDatabaseReadBytes", path),
    maxDocumentsRead: finiteNonnegative(value, "maxDocumentsRead", path),
    maxExecutionMs: finiteNonnegative(value, "maxExecutionMs", path),
    maxOccRetries: finiteNonnegative(value, "maxOccRetries", path),
  };
}

export function parseStaffWorkspaceBackendCostBudgetManifest(
  value: unknown
): StaffWorkspaceBackendCostBudgetManifest {
  assertRecord(value, "manifest");
  assertExactKeys(
    value,
    ["budgets", "defaultBudget", "relativeRegression", "schemaVersion"],
    "manifest"
  );
  if (value.schemaVersion !== 3) {
    throw new Error("manifest.schemaVersion must be 3");
  }
  assertRecord(value.defaultBudget, "manifest.defaultBudget");
  assertExactKeys(value.defaultBudget, ["cold", "warm"], "manifest.defaultBudget");
  const defaultBudget = {
    cold: parseBudget(value.defaultBudget.cold, "manifest.defaultBudget.cold"),
    warm: parseBudget(value.defaultBudget.warm, "manifest.defaultBudget.warm"),
  };
  assertRecord(value.budgets, "manifest.budgets");
  const knownTargets = new Set<string>(STAFF_WORKSPACE_PERFORMANCE_TARGETS);
  for (const target of Object.keys(value.budgets)) {
    if (!knownTargets.has(target)) {
      throw new Error(`manifest.budgets.${target} is not a known target`);
    }
  }
  const budgets = Object.fromEntries(
    STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) => {
      const route = value.budgets[target];
      assertRecord(route, `manifest.budgets.${target}`);
      const hasOverride = Object.keys(route).length > 0;
      return [
        target,
        hasOverride
          ? {
              cold: parseBudget(route.cold, `manifest.budgets.${target}.cold`),
              warm: parseBudget(route.warm, `manifest.budgets.${target}.warm`),
            }
          : defaultBudget,
      ];
    })
  ) as StaffWorkspaceBackendCostBudgetManifest["budgets"];
  assertRecord(value.relativeRegression, "manifest.relativeRegression");
  assertExactKeys(value.relativeRegression, COST_METRICS, "manifest.relativeRegression");
  const relativeRegression = Object.fromEntries(
    COST_METRICS.map((metric) => {
      const path = `manifest.relativeRegression.${metric}`;
      const policy = value.relativeRegression[metric];
      assertRecord(policy, path);
      assertExactKeys(policy, ["maxIncreaseFraction", "minAbsoluteIncrease"], path);
      return [
        metric,
        {
          maxIncreaseFraction: finiteNonnegative(policy, "maxIncreaseFraction", path),
          minAbsoluteIncrease: finiteNonnegative(policy, "minAbsoluteIncrease", path),
        },
      ];
    })
  ) as StaffWorkspaceBackendCostBudgetManifest["relativeRegression"];
  return { budgets, relativeRegression, schemaVersion: 3 };
}

function parseSample(value: unknown, path: string): StaffWorkspaceBackendCostSample {
  assertRecord(value, path);
  assertExactKeys(value, [...COST_METRICS, "target", "warm"], path);
  if (
    typeof value.target !== "string" ||
    !STAFF_WORKSPACE_PERFORMANCE_TARGETS.includes(value.target as StaffWorkspacePerformanceTarget)
  ) {
    throw new Error(`${path}.target must be a known target`);
  }
  if (typeof value.warm !== "boolean") {
    throw new Error(`${path}.warm must be a boolean`);
  }
  return {
    databaseIoReadBytes: finiteNonnegative(value, "databaseIoReadBytes", path),
    databaseReadBytes: finiteNonnegative(value, "databaseReadBytes", path),
    documentsRead: finiteNonnegative(value, "documentsRead", path),
    executionMs: finiteNonnegative(value, "executionMs", path),
    occRetries: finiteNonnegative(value, "occRetries", path),
    target: value.target as StaffWorkspacePerformanceTarget,
    warm: value.warm,
  };
}

function parseCompleteSamples(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  const seen = new Set<string>();
  const samples = value.map((sample, index) => {
    const parsed = parseSample(sample, `${path}[${index}]`);
    const key = `${parsed.target}:${parsed.warm ? "warm" : "cold"}`;
    if (seen.has(key)) {
      throw new Error(`${path} contains duplicate ${key}`);
    }
    seen.add(key);
    return parsed;
  });
  for (const target of STAFF_WORKSPACE_PERFORMANCE_TARGETS) {
    for (const mode of ["cold", "warm"] as const) {
      if (!seen.has(`${target}:${mode}`)) {
        throw new Error(`${path} is missing ${target} ${mode}`);
      }
    }
  }
  return samples;
}

function parseCanonicalTimestamp(value: unknown, path: string) {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a canonical ISO timestamp`);
  }
  try {
    if (new Date(value).toISOString() !== value) {
      throw new Error("timestamp is not canonical");
    }
  } catch (error) {
    throw new Error(`${path} must be a canonical ISO timestamp`, { cause: error });
  }
  return value;
}

function parseTargetBinding(value: unknown) {
  return validateApprovedE2eTargetManifest({ schemaVersion: 3, targets: [value] }).targets[0]!;
}

function parseProviderProvenance(value: unknown, targetBinding: ApprovedE2eTarget) {
  assertRecord(value, "provider");
  assertExactKeys(
    value,
    [
      "captureCount",
      "captureTimeoutMs",
      "command",
      "deployment",
      "history",
      "identityVerifiedAt",
      "terminations",
    ],
    "provider"
  );
  const [expectedDeployment] = new URL(targetBinding.convexSiteOrigin).hostname.split(".");
  if (
    value.captureCount !== 5 ||
    value.captureTimeoutMs !== 5 * 60_000 ||
    typeof value.deployment !== "string" ||
    value.deployment !== expectedDeployment ||
    typeof value.command !== "string" ||
    value.command !==
      `convex logs --deployment ${expectedDeployment} --success --jsonl --history ${String(value.history)}` ||
    value.history !== 1000 ||
    !Array.isArray(value.terminations) ||
    value.terminations.length !== value.captureCount ||
    value.terminations.some((termination) => termination !== "stopped_after_trial")
  ) {
    throw new Error(
      "provider provenance must bind five owned trial captures to the approved deployment"
    );
  }
  return {
    captureCount: value.captureCount,
    captureTimeoutMs: value.captureTimeoutMs,
    command: value.command,
    deployment: value.deployment,
    history: value.history,
    identityVerifiedAt: parseCanonicalTimestamp(
      value.identityVerifiedAt,
      "provider.identityVerifiedAt"
    ),
    terminations: [...value.terminations],
  };
}

function parseComparison(value: unknown) {
  assertRecord(value, "comparison");
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
    "comparison"
  );
  if (
    typeof value.acceptedBaselineDigest !== "string" ||
    !SOURCE_HASH_PATTERN.test(value.acceptedBaselineDigest) ||
    typeof value.acceptedSourceHash !== "string" ||
    !SOURCE_HASH_PATTERN.test(value.acceptedSourceHash) ||
    typeof value.acceptedRevision !== "string" ||
    !GIT_REVISION_PATTERN.test(value.acceptedRevision) ||
    value.fixedFindingCount !== 0 ||
    !(
      value.p95RelativeComparison === "included" || value.p95RelativeComparison === "not_available"
    ) ||
    value.relativeFindingCount !== 0
  ) {
    throw new Error("comparison must bind an accepted zero-finding baseline");
  }
  return {
    acceptedBaselineDigest: value.acceptedBaselineDigest,
    acceptedRevision: value.acceptedRevision,
    acceptedSourceHash: value.acceptedSourceHash,
    fixedFindingCount: 0 as const,
    p95RelativeComparison: value.p95RelativeComparison,
    relativeFindingCount: 0 as const,
  };
}

export function parseStaffWorkspaceBackendCostMetricsExport(
  value: unknown
): StaffWorkspaceBackendCostMetricsExport {
  assertRecord(value, "metrics export");
  if (!(value.schemaVersion === 2 || value.schemaVersion === 3)) {
    throw new Error("metrics export.schemaVersion must be 2 or 3");
  }
  assertExactKeys(
    value,
    value.schemaVersion === 2
      ? ["revision", "samples", "schemaVersion", "target"]
      : [
          "capturedAt",
          "p95Samples",
          "provider",
          "revision",
          "samples",
          "schemaVersion",
          "targetBinding",
          "trialCount",
        ],
    "metrics export"
  );
  if (value.schemaVersion === 3) {
    const targetBinding = parseTargetBinding(value.targetBinding);
    const revision = parseRevision(value.revision, "metrics export.revision");
    if (targetBinding.revision !== revision) {
      throw new Error("metrics export target binding revision must match");
    }
    if (
      typeof value.trialCount !== "number" ||
      !Number.isInteger(value.trialCount) ||
      value.trialCount !== 5
    ) {
      throw new Error("metrics export.trialCount must be exactly 5");
    }
    return {
      capturedAt: parseCanonicalTimestamp(value.capturedAt, "metrics export.capturedAt"),
      p95Samples: parseCompleteSamples(value.p95Samples, "metrics export.p95Samples"),
      provider: parseProviderProvenance(value.provider, targetBinding),
      revision,
      samples: parseCompleteSamples(value.samples, "metrics export.samples"),
      schemaVersion: 3,
      targetBinding,
      trialCount: value.trialCount,
    };
  }
  return {
    revision: parseRevision(value.revision, "metrics export.revision"),
    samples: parseCompleteSamples(value.samples, "metrics export.samples"),
    schemaVersion: 2,
    target: parseNonProductionTarget(value.target, "metrics export.target"),
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: fail-closed versioned evidence validation is intentionally explicit
export function parseStaffWorkspaceBackendCostBaseline(
  value: unknown
): StaffWorkspaceBackendCostBaseline {
  assertRecord(value, "baseline");
  if (!(value.schemaVersion === 2 || value.schemaVersion === 3)) {
    throw new Error("baseline.schemaVersion must be 2 or 3");
  }
  assertExactKeys(
    value,
    value.schemaVersion === 2
      ? [
          "environment",
          "revision",
          "samples",
          "schemaVersion",
          "sourceFiles",
          "sourceHash",
          "status",
          "target",
        ]
      : [
          "capturedAt",
          "comparison",
          "environment",
          "p95Samples",
          "provider",
          "revision",
          "samples",
          "schemaVersion",
          "sourceFiles",
          "sourceHash",
          "status",
          "target",
          "targetBinding",
          "trialCount",
        ],
    "baseline"
  );
  if (!(value.status === "measured" || value.status === "pending_target_measurement")) {
    throw new Error("baseline.status must be measured or pending_target_measurement");
  }
  if (!(Array.isArray(value.samples) && Array.isArray(value.sourceFiles))) {
    throw new Error("baseline samples and sourceFiles must be arrays");
  }
  if (typeof value.environment !== "string" || value.environment.trim().length === 0) {
    throw new Error("baseline.environment must be a non-empty string");
  }
  if (value.status === "pending_target_measurement") {
    if (
      value.samples.length > 0 ||
      value.sourceFiles.length > 0 ||
      value.sourceHash !== null ||
      value.revision !== null ||
      value.target !== null
    ) {
      throw new Error("pending backend-cost evidence cannot contain measured target data");
    }
    return {
      environment: value.environment,
      revision: null,
      samples: [],
      schemaVersion: value.schemaVersion,
      sourceFiles: [],
      sourceHash: null,
      status: "pending_target_measurement",
      target: null,
    };
  }

  const revision = parseRevision(value.revision, "baseline.revision");
  if (typeof value.sourceHash !== "string" || !SOURCE_HASH_PATTERN.test(value.sourceHash.trim())) {
    throw new Error("measured backend-cost evidence requires a sourceHash");
  }
  if (
    value.sourceFiles.length === 0 ||
    value.sourceFiles.some(
      (path) =>
        typeof path !== "string" ||
        path.trim().length === 0 ||
        path.startsWith("/") ||
        path.includes("..")
    )
  ) {
    throw new Error("measured backend-cost sourceFiles must be non-empty strings");
  }
  const target = parseNonProductionTarget(value.target, "baseline.target");
  const samples = parseCompleteSamples(value.samples, "baseline.samples");
  if (value.schemaVersion === 3) {
    const targetBinding = parseTargetBinding(value.targetBinding);
    if (
      targetBinding.revision !== revision ||
      targetBinding.id !== target.id ||
      targetBinding.target !== target.kind
    ) {
      throw new Error("baseline target and revision must match the complete target binding");
    }
    if (
      typeof value.trialCount !== "number" ||
      !Number.isInteger(value.trialCount) ||
      value.trialCount !== 5
    ) {
      throw new Error("baseline.trialCount must be exactly 5");
    }
    return {
      capturedAt: parseCanonicalTimestamp(value.capturedAt, "baseline.capturedAt"),
      comparison: parseComparison(value.comparison),
      environment: value.environment,
      p95Samples: parseCompleteSamples(value.p95Samples, "baseline.p95Samples"),
      provider: parseProviderProvenance(value.provider, targetBinding),
      revision,
      samples,
      schemaVersion: 3,
      sourceFiles: [...value.sourceFiles],
      sourceHash: value.sourceHash,
      status: "measured",
      target,
      targetBinding,
      trialCount: value.trialCount,
    };
  }
  return {
    environment: value.environment,
    revision,
    samples,
    schemaVersion: 2,
    sourceFiles: [...value.sourceFiles],
    sourceHash: value.sourceHash,
    status: "measured",
    target,
  };
}

export function evaluateStaffWorkspaceBackendCostRelativeRegression(
  manifest: StaffWorkspaceBackendCostBudgetManifest,
  candidate: StaffWorkspaceBackendCostSample,
  accepted: StaffWorkspaceBackendCostSample
): StaffWorkspaceBackendCostRelativeFinding[] {
  if (candidate.target !== accepted.target || candidate.warm !== accepted.warm) {
    throw new Error("Backend-cost relative comparison requires matching scenarios");
  }
  return COST_METRICS.flatMap((metric) => {
    const baseline = accepted[metric];
    const policy = manifest.relativeRegression[metric];
    const limit =
      baseline + Math.max(baseline * policy.maxIncreaseFraction, policy.minAbsoluteIncrease);
    return candidate[metric] > limit
      ? [
          {
            actual: candidate[metric],
            baseline,
            limit,
            metric,
            target: candidate.target,
            warm: candidate.warm,
          },
        ]
      : [];
  });
}

export function evaluateStaffWorkspaceBackendCost(
  manifest: StaffWorkspaceBackendCostBudgetManifest,
  sample: StaffWorkspaceBackendCostSample
): StaffWorkspaceBackendCostFinding[] {
  const budget = manifest.budgets[sample.target][sample.warm ? "warm" : "cold"];
  return COST_METRICS.flatMap((metric) => {
    const budgetMetric = `max${metric[0].toUpperCase()}${metric.slice(
      1
    )}` as keyof StaffWorkspaceBackendCostBudget;
    return sample[metric] > budget[budgetMetric]
      ? [
          {
            actual: sample[metric],
            maximum: budget[budgetMetric],
            metric: budgetMetric,
            target: sample.target,
            warm: sample.warm,
          },
        ]
      : [];
  });
}
