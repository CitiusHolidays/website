export type StaffWorkspacePerformanceTarget = "job-cards" | "proposals" | "queries";

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
