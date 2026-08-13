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

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
}

function readFiniteNonnegativeNumber(record: Record<string, unknown>, field: string, path: string) {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path}.${field} must be a finite nonnegative number`);
  }
  return value;
}

function parseRouteBudget(value: unknown, path: string): StaffWorkspaceRouteBudget {
  assertRecord(value, path);
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
  schemaVersion: number;
}

export interface StaffWorkspacePerformanceFinding {
  actual: number;
  maximum: number;
  metric: keyof StaffWorkspaceRouteBudget;
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

export function parseStaffWorkspacePerformanceBudgetManifest(
  value: unknown
): StaffWorkspacePerformanceBudgetManifest {
  assertRecord(value, "manifest");
  if (value.schemaVersion !== 1) {
    throw new Error(
      `schemaVersion must be 1; migrate unsupported version ${String(value.schemaVersion)}`
    );
  }
  assertRecord(value.budgets, "budgets");
  const knownTargets = new Set<string>(STAFF_WORKSPACE_PERFORMANCE_TARGETS);
  for (const target of Object.keys(value.budgets)) {
    if (!knownTargets.has(target)) {
      throw new Error(`budgets.${target} is not a known Staff Workspace target`);
    }
  }
  const budgets = Object.fromEntries(
    STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) => {
      const targetValue = value.budgets[target];
      assertRecord(targetValue, `budgets.${target}`);
      return [
        target,
        {
          cold: parseRouteBudget(targetValue.cold, `budgets.${target}.cold`),
          warm: parseRouteBudget(targetValue.warm, `budgets.${target}.warm`),
        },
      ];
    })
  ) as StaffWorkspacePerformanceBudgetManifest["budgets"];
  return { budgets, schemaVersion: 1 };
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
    return typeof actual === "number" && actual > maximum
      ? [{ actual, maximum, metric, target: sample.target, warm: sample.warm }]
      : [];
  });
}
