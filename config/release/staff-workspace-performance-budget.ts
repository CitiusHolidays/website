import { isRuntimeNumber, isRuntimeObject } from "../../src/lib/runtimeValues";
import type { JsonObject, JsonValue } from "../lib/jsonValue";
export const STAFF_WORKSPACE_PERFORMANCE_TARGETS = [
  "queries",
  "proposals",
  "job-cards",
  "contracting",
  "finance",
  "tickets",
  "hotels",
  "visa",
] as const;

export type StaffWorkspacePerformanceTarget = (typeof STAFF_WORKSPACE_PERFORMANCE_TARGETS)[number];

export interface StaffWorkspacePerformanceSample {
  applicationPayloadBytes: number;
  duplicateSubscriptions: number;
  firstContentMs: number;
  logicalSubscriptions: number;
  routeReadyMs: number;
  routeResourceTransferBytes: number;
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

interface StaffWorkspaceRouteBudget {
  maxApplicationPayloadBytes: number;
  maxDuplicateSubscriptions: number;
  maxFirstContentMs: number;
  maxLogicalSubscriptions: number;
  maxRouteReadyMs: number;
  maxRouteResourceTransferBytes: number;
}

export type StaffWorkspacePerformanceMetric = Exclude<
  keyof StaffWorkspacePerformanceSample,
  "target" | "warm"
>;

export interface StaffWorkspaceRelativeRegressionPolicy {
  maxIncreaseFraction: number;
  minAbsoluteIncrease: number;
}

const LEGACY_V1_INCOMPARABLE_METRICS = new Set<StaffWorkspacePerformanceMetric>([
  "firstContentMs",
  "routeReadyMs",
  "routeResourceTransferBytes",
]);

export function isStaffWorkspaceRelativeMetricComparable(
  acceptedMeasurementVersion: number,
  candidateMeasurementVersion: number,
  metric: StaffWorkspacePerformanceMetric
) {
  if (acceptedMeasurementVersion === candidateMeasurementVersion) {
    return true;
  }
  if (acceptedMeasurementVersion === 1 && candidateMeasurementVersion === 2) {
    return !LEGACY_V1_INCOMPARABLE_METRICS.has(metric);
  }
  throw new Error(
    `Unsupported Staff Workspace measurement transition ${acceptedMeasurementVersion} -> ${candidateMeasurementVersion}`
  );
}

function assertRecord(value: JsonValue, field: string): asserts value is JsonObject {
  if (!(value && isRuntimeObject(value)) || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
}

function assertExactKeys(value: JsonObject, keys: readonly string[], path: string) {
  const expected = new Set(keys);
  if (Object.keys(value).some((key) => !expected.has(key))) {
    throw new Error(`${path} contains an undeclared field`);
  }
}

function readFiniteNonnegativeNumber(record: JsonObject, field: string, path: string) {
  const value = record[field];
  if (!(isRuntimeNumber(value) && Number.isFinite(value)) || value < 0) {
    throw new Error(`${path}.${field} must be a finite nonnegative number`);
  }
  return value;
}

function parseRouteBudget(value: JsonValue, path: string): StaffWorkspaceRouteBudget {
  assertRecord(value, path);
  assertExactKeys(
    value,
    [
      "maxApplicationPayloadBytes",
      "maxDuplicateSubscriptions",
      "maxFirstContentMs",
      "maxLogicalSubscriptions",
      "maxRouteReadyMs",
      "maxRouteResourceTransferBytes",
    ],
    path
  );
  return {
    maxApplicationPayloadBytes: readFiniteNonnegativeNumber(
      value,
      "maxApplicationPayloadBytes",
      path
    ),
    maxDuplicateSubscriptions: readFiniteNonnegativeNumber(
      value,
      "maxDuplicateSubscriptions",
      path
    ),
    maxFirstContentMs: readFiniteNonnegativeNumber(value, "maxFirstContentMs", path),
    maxLogicalSubscriptions: readFiniteNonnegativeNumber(value, "maxLogicalSubscriptions", path),
    maxRouteReadyMs: readFiniteNonnegativeNumber(value, "maxRouteReadyMs", path),
    maxRouteResourceTransferBytes: readFiniteNonnegativeNumber(
      value,
      "maxRouteResourceTransferBytes",
      path
    ),
  };
}

export interface StaffWorkspacePerformanceBudgetManifest {
  budgets: Record<
    StaffWorkspacePerformanceTarget,
    { cold: StaffWorkspaceRouteBudget; warm: StaffWorkspaceRouteBudget }
  >;
  relativeRegression: Record<
    StaffWorkspacePerformanceMetric,
    StaffWorkspaceRelativeRegressionPolicy
  >;
  schemaVersion: 2;
}

export interface StaffWorkspacePerformanceFinding {
  actual: number;
  maximum: number;
  metric: keyof StaffWorkspaceRouteBudget;
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

export interface StaffWorkspaceRelativeRegressionFinding {
  actual: number;
  baseline: number;
  limit: number;
  metric: StaffWorkspacePerformanceMetric;
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

const SAMPLE_METRICS: readonly StaffWorkspacePerformanceMetric[] = [
  "applicationPayloadBytes",
  "duplicateSubscriptions",
  "firstContentMs",
  "logicalSubscriptions",
  "routeReadyMs",
  "routeResourceTransferBytes",
] as const;

export function parseStaffWorkspacePerformanceBudgetManifest(
  value: JsonValue
): StaffWorkspacePerformanceBudgetManifest {
  assertRecord(value, "manifest");
  assertExactKeys(value, ["budgets", "relativeRegression", "schemaVersion"], "manifest");
  if (value.schemaVersion !== 2) {
    throw new Error(
      `schemaVersion must be 2; migrate unsupported version ${String(value.schemaVersion)}`
    );
  }
  assertRecord(value.budgets, "budgets");
  assertExactKeys(value.budgets, STAFF_WORKSPACE_PERFORMANCE_TARGETS, "budgets");
  const knownTargets = new Set<string>(STAFF_WORKSPACE_PERFORMANCE_TARGETS);
  for (const target of Object.keys(value.budgets)) {
    if (!knownTargets.has(target)) {
      throw new Error(`budgets.${target} is not a known Staff Workspace target`);
    }
  }
  // SAFETY: STAFF_WORKSPACE_PERFORMANCE_TARGETS is the complete key source for the budget record.
  const budgets = Object.fromEntries(
    STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) => {
      const targetValue = value.budgets[target];
      assertRecord(targetValue, `budgets.${target}`);
      assertExactKeys(targetValue, ["cold", "warm"], `budgets.${target}`);
      return [
        target,
        {
          cold: parseRouteBudget(targetValue.cold, `budgets.${target}.cold`),
          warm: parseRouteBudget(targetValue.warm, `budgets.${target}.warm`),
        },
      ];
    })
  ) as StaffWorkspacePerformanceBudgetManifest["budgets"];
  assertRecord(value.relativeRegression, "relativeRegression");
  assertExactKeys(value.relativeRegression, SAMPLE_METRICS, "relativeRegression");
  // SAFETY: STAFF_WORKSPACE_PERFORMANCE_TARGETS is the complete key source for the regression record.
  const relativeRegression = Object.fromEntries(
    SAMPLE_METRICS.map((metric) => {
      const path = `relativeRegression.${metric}`;
      const rawPolicy = value.relativeRegression[metric];
      assertRecord(rawPolicy, path);
      assertExactKeys(rawPolicy, ["maxIncreaseFraction", "minAbsoluteIncrease"], path);
      return [
        metric,
        {
          maxIncreaseFraction: readFiniteNonnegativeNumber(rawPolicy, "maxIncreaseFraction", path),
          minAbsoluteIncrease: readFiniteNonnegativeNumber(rawPolicy, "minAbsoluteIncrease", path),
        },
      ];
    })
  ) as StaffWorkspacePerformanceBudgetManifest["relativeRegression"];
  return { budgets, relativeRegression, schemaVersion: 2 };
}

export function evaluateStaffWorkspacePerformanceBudget(
  manifest: StaffWorkspacePerformanceBudgetManifest,
  sample: StaffWorkspacePerformanceSample
): StaffWorkspacePerformanceFinding[] {
  const budget = manifest.budgets[sample.target][sample.warm ? "warm" : "cold"];
  const comparisons: [keyof StaffWorkspaceRouteBudget, keyof StaffWorkspacePerformanceSample][] = [
    ["maxApplicationPayloadBytes", "applicationPayloadBytes"],
    ["maxDuplicateSubscriptions", "duplicateSubscriptions"],
    ["maxFirstContentMs", "firstContentMs"],
    ["maxLogicalSubscriptions", "logicalSubscriptions"],
    ["maxRouteReadyMs", "routeReadyMs"],
    ["maxRouteResourceTransferBytes", "routeResourceTransferBytes"],
  ];
  return comparisons.flatMap(([metric, sampleMetric]) => {
    const actual = sample[sampleMetric];
    const maximum = budget[metric];
    return isRuntimeNumber(actual) && actual > maximum
      ? [{ actual, maximum, metric, target: sample.target, warm: sample.warm }]
      : [];
  });
}

export function evaluateStaffWorkspaceRelativeRegression(
  manifest: StaffWorkspacePerformanceBudgetManifest,
  candidate: StaffWorkspacePerformanceSample,
  accepted: StaffWorkspacePerformanceSample
): StaffWorkspaceRelativeRegressionFinding[] {
  if (candidate.target !== accepted.target || candidate.warm !== accepted.warm) {
    throw new Error("Staff Workspace relative comparison requires matching target and mode");
  }
  return SAMPLE_METRICS.flatMap((metric) => {
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
