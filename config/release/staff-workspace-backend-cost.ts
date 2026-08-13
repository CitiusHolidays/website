import {
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
  type StaffWorkspacePerformanceTarget,
} from "./staff-workspace-performance-budget";

const COST_METRICS = [
  "bytesRead",
  "databaseRangesRead",
  "documentsRead",
  "executionMs",
  "occRetries",
] as const;

type BackendCostMetric = (typeof COST_METRICS)[number];

export interface StaffWorkspaceBackendCostSample {
  bytesRead: number;
  databaseRangesRead: number;
  documentsRead: number;
  executionMs: number;
  occRetries: number;
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

interface StaffWorkspaceBackendCostBudget {
  maxBytesRead: number;
  maxDatabaseRangesRead: number;
  maxDocumentsRead: number;
  maxExecutionMs: number;
  maxOccRetries: number;
}

export interface StaffWorkspaceBackendCostBudgetManifest {
  budgets: Record<
    StaffWorkspacePerformanceTarget,
    { cold: StaffWorkspaceBackendCostBudget; warm: StaffWorkspaceBackendCostBudget }
  >;
  schemaVersion: 1;
}

export interface StaffWorkspaceBackendCostFinding {
  actual: number;
  maximum: number;
  metric: keyof StaffWorkspaceBackendCostBudget;
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

export interface StaffWorkspaceBackendCostBaseline {
  environment: string;
  revision: null | string;
  samples: StaffWorkspaceBackendCostSample[];
  schemaVersion: 1;
  sourceFiles: string[];
  sourceHash: null | string;
  status: "measured" | "pending_target_measurement";
  target: null | { id: string; kind: "development" | "preview" };
}

export interface StaffWorkspaceBackendCostMetricsExport {
  revision: string;
  samples: StaffWorkspaceBackendCostSample[];
  schemaVersion: 1;
  target: { id: string; kind: "development" | "preview" };
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
  if (typeof value !== "string" || !/^[a-f0-9]{7,64}$/i.test(value.trim())) {
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
    /production|(^|[-_.])prod($|[-_.])/i.test(value.id)
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
      "maxBytesRead",
      "maxDatabaseRangesRead",
      "maxDocumentsRead",
      "maxExecutionMs",
      "maxOccRetries",
    ],
    path
  );
  return {
    maxBytesRead: finiteNonnegative(value, "maxBytesRead", path),
    maxDatabaseRangesRead: finiteNonnegative(value, "maxDatabaseRangesRead", path),
    maxDocumentsRead: finiteNonnegative(value, "maxDocumentsRead", path),
    maxExecutionMs: finiteNonnegative(value, "maxExecutionMs", path),
    maxOccRetries: finiteNonnegative(value, "maxOccRetries", path),
  };
}

export function parseStaffWorkspaceBackendCostBudgetManifest(
  value: unknown
): StaffWorkspaceBackendCostBudgetManifest {
  assertRecord(value, "manifest");
  assertExactKeys(value, ["budgets", "defaultBudget", "schemaVersion"], "manifest");
  if (value.schemaVersion !== 1) {
    throw new Error("manifest.schemaVersion must be 1");
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
  return { budgets, schemaVersion: 1 };
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
    bytesRead: finiteNonnegative(value, "bytesRead", path),
    databaseRangesRead: finiteNonnegative(value, "databaseRangesRead", path),
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

export function parseStaffWorkspaceBackendCostMetricsExport(
  value: unknown
): StaffWorkspaceBackendCostMetricsExport {
  assertRecord(value, "metrics export");
  assertExactKeys(value, ["revision", "samples", "schemaVersion", "target"], "metrics export");
  if (value.schemaVersion !== 1) {
    throw new Error("metrics export.schemaVersion must be 1");
  }
  return {
    revision: parseRevision(value.revision, "metrics export.revision"),
    samples: parseCompleteSamples(value.samples, "metrics export.samples"),
    schemaVersion: 1,
    target: parseNonProductionTarget(value.target, "metrics export.target"),
  };
}

export function parseStaffWorkspaceBackendCostBaseline(
  value: unknown
): StaffWorkspaceBackendCostBaseline {
  assertRecord(value, "baseline");
  assertExactKeys(
    value,
    [
      "environment",
      "revision",
      "samples",
      "schemaVersion",
      "sourceFiles",
      "sourceHash",
      "status",
      "target",
    ],
    "baseline"
  );
  if (value.schemaVersion !== 1) {
    throw new Error("baseline.schemaVersion must be 1");
  }
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
      schemaVersion: 1,
      sourceFiles: [],
      sourceHash: null,
      status: "pending_target_measurement",
      target: null,
    };
  }

  const revision = parseRevision(value.revision, "baseline.revision");
  if (typeof value.sourceHash !== "string" || !/^[a-f0-9]{64}$/i.test(value.sourceHash.trim())) {
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
  return {
    environment: value.environment,
    revision,
    samples,
    schemaVersion: 1,
    sourceFiles: [...value.sourceFiles],
    sourceHash: value.sourceHash,
    status: "measured",
    target,
  };
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
