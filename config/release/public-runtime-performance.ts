export const PUBLIC_RUNTIME_SCENARIOS = [
  {
    id: "home-desktop",
    path: "/",
    variant: "default",
    viewport: { height: 1000, width: 1440 },
  },
  {
    id: "home-mobile",
    path: "/",
    variant: "default",
    viewport: { height: 844, width: 390 },
  },
  {
    id: "pilgrimage-desktop",
    path: "/pilgrimage",
    variant: "default",
    viewport: { height: 1000, width: 1440 },
  },
  {
    id: "sacred-bharat-mobile",
    path: "/sacred-bharat",
    variant: "default",
    viewport: { height: 844, width: 390 },
  },
  {
    id: "home-reduced-motion",
    path: "/",
    variant: "reduced-motion",
    viewport: { height: 1000, width: 1440 },
  },
  {
    id: "home-data-saver",
    path: "/",
    variant: "data-saver",
    viewport: { height: 1000, width: 1440 },
  },
] as const;

export type PublicRuntimeScenarioId = (typeof PUBLIC_RUNTIME_SCENARIOS)[number]["id"];
export type PublicRuntimeVariant = (typeof PUBLIC_RUNTIME_SCENARIOS)[number]["variant"];

export const PUBLIC_RUNTIME_METRICS = [
  "criticalTransferBytes",
  "cssTransferBytes",
  "domCompleteMs",
  "domInteractiveMs",
  "fcpMs",
  "jsTransferBytes",
  "lcpMs",
  "loadMs",
  "requests",
  "ttfbMs",
] as const;

export type PublicRuntimeMetric = (typeof PUBLIC_RUNTIME_METRICS)[number];

export interface PublicRuntimeMetricPolicy {
  fail: number;
  warn: number;
}

export interface PublicRuntimeBudgetManifest {
  scenarios: Record<
    PublicRuntimeScenarioId,
    Record<PublicRuntimeMetric, PublicRuntimeMetricPolicy>
  >;
  schemaVersion: 1;
}

export interface PublicRuntimeSlowResource {
  durationMs: number;
  path: string;
  transferBytes: number;
  type: string;
}

export interface PublicRuntimeSample extends Record<PublicRuntimeMetric, number> {
  cache: "cold";
  firstPartyTransferBytes: number;
  gatedMediaTransferBytes: number;
  heroVideoRequests: number;
  id: PublicRuntimeScenarioId;
  network: "loopback-unthrottled";
  path: string;
  slowestFirstPartyResources: PublicRuntimeSlowResource[];
  thirdPartyTransferBytes: number;
  trials: number;
  variant: PublicRuntimeVariant;
  viewport: { height: number; width: number };
}

export interface PublicRuntimeBaseline {
  browser: string;
  buildMode: string;
  measuredAt: string;
  revision: string;
  samples: PublicRuntimeSample[];
  schemaVersion: 1;
  sourceFiles: string[];
  sourceHash: string;
}

export interface PublicRuntimeFinding {
  actual: number;
  limit: number;
  metric: PublicRuntimeMetric | "heroVideoRequests";
  scenario: PublicRuntimeScenarioId;
  severity: "failure" | "warning";
}

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
}

function assertSchemaVersion(value: Record<string, unknown>, path: string) {
  if (value.schemaVersion !== 1) {
    throw new Error(
      `${path}.schemaVersion must be 1; migrate unsupported version ${String(value.schemaVersion)}`
    );
  }
}

function readString(record: Record<string, unknown>, field: string, path: string) {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path}.${field} must be a non-empty string`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, field: string, path: string) {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path}.${field} must be a finite nonnegative number`);
  }
  return value;
}

function readPositiveInteger(record: Record<string, unknown>, field: string, path: string) {
  const value = readNumber(record, field, path);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${path}.${field} must be a positive integer`);
  }
  return value;
}

export function parsePublicRuntimeBudgetManifest(value: unknown): PublicRuntimeBudgetManifest {
  assertRecord(value, "manifest");
  assertSchemaVersion(value, "manifest");
  assertRecord(value.scenarios, "manifest.scenarios");
  const known = new Set<string>(PUBLIC_RUNTIME_SCENARIOS.map((scenario) => scenario.id));
  for (const id of Object.keys(value.scenarios)) {
    if (!known.has(id)) {
      throw new Error(`manifest.scenarios.${id} is unknown`);
    }
  }
  const scenarios = Object.fromEntries(
    PUBLIC_RUNTIME_SCENARIOS.map((scenario) => {
      const scenarioPath = `manifest.scenarios.${scenario.id}`;
      const rawScenario = value.scenarios[scenario.id];
      assertRecord(rawScenario, scenarioPath);
      const policies = Object.fromEntries(
        PUBLIC_RUNTIME_METRICS.map((metric) => {
          const metricPath = `${scenarioPath}.${metric}`;
          const rawPolicy = rawScenario[metric];
          assertRecord(rawPolicy, metricPath);
          const warn = readNumber(rawPolicy, "warn", metricPath);
          const fail = readNumber(rawPolicy, "fail", metricPath);
          if (fail < warn) {
            throw new Error(
              `${metricPath}.fail must be greater than or equal to ${metricPath}.warn`
            );
          }
          return [metric, { fail, warn }];
        })
      ) as Record<PublicRuntimeMetric, PublicRuntimeMetricPolicy>;
      return [scenario.id, policies];
    })
  ) as PublicRuntimeBudgetManifest["scenarios"];
  return { scenarios, schemaVersion: 1 };
}

function parseSlowResources(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  return value.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    assertRecord(entry, entryPath);
    return {
      durationMs: readNumber(entry, "durationMs", entryPath),
      path: readString(entry, "path", entryPath),
      transferBytes: readNumber(entry, "transferBytes", entryPath),
      type: readString(entry, "type", entryPath),
    };
  });
}

function parseSample(value: unknown, index: number): PublicRuntimeSample {
  const path = `baseline.samples[${index}]`;
  assertRecord(value, path);
  const id = readString(value, "id", path) as PublicRuntimeScenarioId;
  const scenario = PUBLIC_RUNTIME_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) {
    throw new Error(`${path}.id is unknown: ${id}`);
  }
  if (value.path !== scenario.path) {
    throw new Error(`${path}.path must be ${scenario.path}`);
  }
  if (value.variant !== scenario.variant) {
    throw new Error(`${path}.variant must be ${scenario.variant}`);
  }
  assertRecord(value.viewport, `${path}.viewport`);
  if (
    value.viewport.width !== scenario.viewport.width ||
    value.viewport.height !== scenario.viewport.height
  ) {
    throw new Error(`${path}.viewport does not match the declared scenario`);
  }
  if (value.cache !== "cold") {
    throw new Error(`${path}.cache must be cold`);
  }
  if (value.network !== "loopback-unthrottled") {
    throw new Error(`${path}.network must be loopback-unthrottled`);
  }
  const metrics = Object.fromEntries(
    PUBLIC_RUNTIME_METRICS.map((metric) => [metric, readNumber(value, metric, path)])
  ) as Record<PublicRuntimeMetric, number>;
  return {
    ...metrics,
    cache: "cold",
    firstPartyTransferBytes: readNumber(value, "firstPartyTransferBytes", path),
    gatedMediaTransferBytes: readNumber(value, "gatedMediaTransferBytes", path),
    heroVideoRequests: readNumber(value, "heroVideoRequests", path),
    id,
    network: "loopback-unthrottled",
    path: scenario.path,
    slowestFirstPartyResources: parseSlowResources(
      value.slowestFirstPartyResources,
      `${path}.slowestFirstPartyResources`
    ),
    thirdPartyTransferBytes: readNumber(value, "thirdPartyTransferBytes", path),
    trials: readPositiveInteger(value, "trials", path),
    variant: scenario.variant,
    viewport: { ...scenario.viewport },
  };
}

export function parsePublicRuntimeBaseline(value: unknown): PublicRuntimeBaseline {
  assertRecord(value, "baseline");
  assertSchemaVersion(value, "baseline");
  if (!Array.isArray(value.samples) || value.samples.length === 0) {
    throw new Error("baseline.samples must contain every public runtime scenario");
  }
  const seen = new Set<string>();
  const samples = value.samples.map((sample, index) => {
    const parsed = parseSample(sample, index);
    if (seen.has(parsed.id)) {
      throw new Error(`baseline.samples contains duplicate ${parsed.id}`);
    }
    seen.add(parsed.id);
    return parsed;
  });
  for (const scenario of PUBLIC_RUNTIME_SCENARIOS) {
    if (!seen.has(scenario.id)) {
      throw new Error(`baseline.samples is missing ${scenario.id}`);
    }
  }
  if (!Array.isArray(value.sourceFiles) || value.sourceFiles.length === 0) {
    throw new Error("baseline.sourceFiles must contain monitored public runtime paths");
  }
  const sourceFiles = value.sourceFiles.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`baseline.sourceFiles[${index}] must be a non-empty string`);
    }
    return entry;
  });
  return {
    browser: readString(value, "browser", "baseline"),
    buildMode: readString(value, "buildMode", "baseline"),
    measuredAt: readString(value, "measuredAt", "baseline"),
    revision: readString(value, "revision", "baseline"),
    samples,
    schemaVersion: 1,
    sourceFiles,
    sourceHash: readString(value, "sourceHash", "baseline"),
  };
}

export function evaluatePublicRuntimePerformance(
  manifest: PublicRuntimeBudgetManifest,
  sample: PublicRuntimeSample
): PublicRuntimeFinding[] {
  const findings: PublicRuntimeFinding[] = [];
  const policies = manifest.scenarios[sample.id];
  for (const metric of PUBLIC_RUNTIME_METRICS) {
    const actual = sample[metric];
    const policy = policies[metric];
    if (actual > policy.fail) {
      findings.push({
        actual,
        limit: policy.fail,
        metric,
        scenario: sample.id,
        severity: "failure",
      });
    } else if (actual > policy.warn) {
      findings.push({
        actual,
        limit: policy.warn,
        metric,
        scenario: sample.id,
        severity: "warning",
      });
    }
  }
  if (
    (sample.variant === "data-saver" || sample.variant === "reduced-motion") &&
    sample.heroVideoRequests > 0
  ) {
    findings.push({
      actual: sample.heroVideoRequests,
      limit: 0,
      metric: "heroVideoRequests",
      scenario: sample.id,
      severity: "failure",
    });
  }
  return findings;
}

export function isPublicRuntimeBaselineFresh(
  baseline: PublicRuntimeBaseline,
  currentSourceHash: string,
  currentSourceFiles: readonly string[] = baseline.sourceFiles
) {
  return (
    baseline.sourceFiles.length === currentSourceFiles.length &&
    baseline.sourceFiles.every((path, index) => path === currentSourceFiles[index]) &&
    baseline.sourceHash === currentSourceHash
  );
}
