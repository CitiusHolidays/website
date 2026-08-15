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

export interface PublicRuntimeRelativeRegressionPolicy {
  maxIncreaseFraction: number;
  minAbsoluteIncrease: number;
}

export interface PublicRuntimeBudgetManifest {
  relativeRegression: Record<PublicRuntimeMetric, PublicRuntimeRelativeRegressionPolicy>;
  scenarios: Record<
    PublicRuntimeScenarioId,
    Record<PublicRuntimeMetric, PublicRuntimeMetricPolicy>
  >;
  schemaVersion: 2;
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
  comparison?: PublicRuntimeComparisonProvenance;
  measuredAt: string;
  p95Samples?: PublicRuntimeSample[];
  revision: string;
  samples: PublicRuntimeSample[];
  schemaVersion: 1 | 2;
  servedBuildId?: string;
  sourceFiles: string[];
  sourceHash: string;
}

export interface PublicRuntimeComparisonProvenance {
  acceptedBaselineDigest: string;
  acceptedRevision: string;
  acceptedSourceHash: string;
  fixedFindingCount: 0;
  relativeFindingCount: 0;
}

export interface PublicRuntimeFinding {
  actual: number;
  limit: number;
  metric: PublicRuntimeMetric | "heroVideoRequests";
  scenario: PublicRuntimeScenarioId;
  severity: "failure" | "warning";
}

export interface PublicRuntimeRelativeRegressionFinding {
  actual: number;
  baseline: number;
  limit: number;
  metric: PublicRuntimeMetric;
  scenario: PublicRuntimeScenarioId;
}

const BASELINE_KEYS = [
  "browser",
  "buildMode",
  "measuredAt",
  "revision",
  "samples",
  "schemaVersion",
  "sourceFiles",
  "sourceHash",
] as const;
const BASELINE_V2_KEYS = [...BASELINE_KEYS, "comparison", "p95Samples", "servedBuildId"] as const;
const SAMPLE_KEYS = [
  "cache",
  ...PUBLIC_RUNTIME_METRICS,
  "firstPartyTransferBytes",
  "gatedMediaTransferBytes",
  "heroVideoRequests",
  "id",
  "network",
  "path",
  "slowestFirstPartyResources",
  "thirdPartyTransferBytes",
  "trials",
  "variant",
  "viewport",
] as const;
const SLOW_RESOURCE_KEYS = ["durationMs", "path", "transferBytes", "type"] as const;
const VIEWPORT_KEYS = ["height", "width"] as const;
const EXACT_REVISION_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_RESOURCE_PATH_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=%/-]*(?:\?\[query\])?$/;
const APPROVED_BUILD_MODE = "local Next production server";
const CHROMIUM_VERSION_PATTERN = /^Chromium \d+(?:\.\d+){3}$/;

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

function assertSchemaVersion(value: Record<string, unknown>, path: string) {
  if (value.schemaVersion !== 2) {
    throw new Error(
      `${path}.schemaVersion must be 2; migrate unsupported version ${String(value.schemaVersion)}`
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
  assertExactKeys(value, ["relativeRegression", "scenarios", "schemaVersion"], "manifest");
  assertSchemaVersion(value, "manifest");
  assertRecord(value.relativeRegression, "manifest.relativeRegression");
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
      assertExactKeys(rawScenario, PUBLIC_RUNTIME_METRICS, scenarioPath);
      const policies = Object.fromEntries(
        PUBLIC_RUNTIME_METRICS.map((metric) => {
          const metricPath = `${scenarioPath}.${metric}`;
          const rawPolicy = rawScenario[metric];
          assertRecord(rawPolicy, metricPath);
          assertExactKeys(rawPolicy, ["fail", "warn"], metricPath);
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
  const relativeRegression = Object.fromEntries(
    PUBLIC_RUNTIME_METRICS.map((metric) => {
      const path = `manifest.relativeRegression.${metric}`;
      const rawPolicy = value.relativeRegression[metric];
      assertRecord(rawPolicy, path);
      assertExactKeys(rawPolicy, ["maxIncreaseFraction", "minAbsoluteIncrease"], path);
      return [
        metric,
        {
          maxIncreaseFraction: readNumber(rawPolicy, "maxIncreaseFraction", path),
          minAbsoluteIncrease: readNumber(rawPolicy, "minAbsoluteIncrease", path),
        },
      ];
    })
  ) as PublicRuntimeBudgetManifest["relativeRegression"];
  assertExactKeys(value.relativeRegression, PUBLIC_RUNTIME_METRICS, "manifest.relativeRegression");
  return { relativeRegression, scenarios, schemaVersion: 2 };
}

function parseSlowResources(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  return value.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    assertRecord(entry, entryPath);
    assertExactKeys(entry, SLOW_RESOURCE_KEYS, entryPath);
    const resourcePath = readString(entry, "path", entryPath);
    if (!SAFE_RESOURCE_PATH_PATTERN.test(resourcePath)) {
      throw new Error(`${entryPath}.path must be a sanitized same-origin path`);
    }
    return {
      durationMs: readNumber(entry, "durationMs", entryPath),
      path: resourcePath,
      transferBytes: readNumber(entry, "transferBytes", entryPath),
      type: readString(entry, "type", entryPath),
    };
  });
}

function parseSample(value: unknown, path: string): PublicRuntimeSample {
  assertRecord(value, path);
  assertExactKeys(value, SAMPLE_KEYS, path);
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
  assertExactKeys(value.viewport, VIEWPORT_KEYS, `${path}.viewport`);
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
    trials: (() => {
      const trials = readPositiveInteger(value, "trials", path);
      if (trials < 3) {
        throw new Error(`${path}.trials must be at least 3`);
      }
      return trials;
    })(),
    variant: scenario.variant,
    viewport: { ...scenario.viewport },
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: fail-closed versioned evidence validation is intentionally explicit
export function parsePublicRuntimeBaseline(value: unknown): PublicRuntimeBaseline {
  assertRecord(value, "baseline");
  if (!(value.schemaVersion === 1 || value.schemaVersion === 2)) {
    throw new Error(
      `baseline.schemaVersion must be 1 or 2; migrate unsupported version ${String(value.schemaVersion)}`
    );
  }
  assertExactKeys(value, value.schemaVersion === 1 ? BASELINE_KEYS : BASELINE_V2_KEYS, "baseline");
  if (!Array.isArray(value.samples) || value.samples.length === 0) {
    throw new Error("baseline.samples must contain every public runtime scenario");
  }
  const seen = new Set<string>();
  const samples = value.samples.map((sample, index) => {
    const parsed = parseSample(sample, `baseline.samples[${index}]`);
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
    if (
      typeof entry !== "string" ||
      entry.trim().length === 0 ||
      entry.startsWith("/") ||
      entry.includes("\\") ||
      entry.split("/").includes("..")
    ) {
      throw new Error(`baseline.sourceFiles[${index}] must be a safe repository-relative path`);
    }
    return entry;
  });
  if (new Set(sourceFiles).size !== sourceFiles.length) {
    throw new Error("baseline.sourceFiles must not contain duplicates");
  }
  const browser = readString(value, "browser", "baseline");
  if (!CHROMIUM_VERSION_PATTERN.test(browser)) {
    throw new Error("baseline.browser must identify the measured Chromium version");
  }
  const buildMode = readString(value, "buildMode", "baseline");
  if (buildMode !== APPROVED_BUILD_MODE) {
    throw new Error(`baseline.buildMode must be ${APPROVED_BUILD_MODE}`);
  }
  const measuredAt = readString(value, "measuredAt", "baseline");
  try {
    if (new Date(measuredAt).toISOString() !== measuredAt) {
      throw new Error("timestamp is not canonical");
    }
  } catch (error) {
    throw new Error("baseline.measuredAt must be a canonical ISO timestamp", { cause: error });
  }
  const revision = readString(value, "revision", "baseline");
  if (!EXACT_REVISION_PATTERN.test(revision)) {
    throw new Error("baseline.revision must be an exact 40-character Git revision");
  }
  const sourceHash = readString(value, "sourceHash", "baseline");
  if (!SHA256_PATTERN.test(sourceHash)) {
    throw new Error("baseline.sourceHash must be a SHA-256 digest");
  }
  let comparison: PublicRuntimeComparisonProvenance | undefined;
  let p95Samples: PublicRuntimeSample[] | undefined;
  let servedBuildId: string | undefined;
  if (value.schemaVersion === 2) {
    assertRecord(value.comparison, "baseline.comparison");
    assertExactKeys(
      value.comparison,
      [
        "acceptedBaselineDigest",
        "acceptedRevision",
        "acceptedSourceHash",
        "fixedFindingCount",
        "relativeFindingCount",
      ],
      "baseline.comparison"
    );
    for (const field of ["acceptedBaselineDigest", "acceptedSourceHash"] as const) {
      if (
        typeof value.comparison[field] !== "string" ||
        !SHA256_PATTERN.test(value.comparison[field])
      ) {
        throw new Error(`baseline.comparison.${field} must be a SHA-256 digest`);
      }
    }
    if (
      typeof value.comparison.acceptedRevision !== "string" ||
      !EXACT_REVISION_PATTERN.test(value.comparison.acceptedRevision) ||
      value.comparison.fixedFindingCount !== 0 ||
      value.comparison.relativeFindingCount !== 0
    ) {
      throw new Error("baseline.comparison must record an exact accepted zero-finding baseline");
    }
    comparison = {
      acceptedBaselineDigest: value.comparison.acceptedBaselineDigest,
      acceptedRevision: value.comparison.acceptedRevision,
      acceptedSourceHash: value.comparison.acceptedSourceHash,
      fixedFindingCount: 0,
      relativeFindingCount: 0,
    };
    if (!Array.isArray(value.p95Samples)) {
      throw new Error("baseline.p95Samples must be an array");
    }
    const p95Seen = new Set<string>();
    p95Samples = value.p95Samples.map((sample, index) => {
      const parsed = parseSample(sample, `baseline.p95Samples[${index}]`);
      if (p95Seen.has(parsed.id)) {
        throw new Error(`baseline.p95Samples contains duplicate ${parsed.id}`);
      }
      p95Seen.add(parsed.id);
      return parsed;
    });
    if (
      p95Samples.length !== PUBLIC_RUNTIME_SCENARIOS.length ||
      PUBLIC_RUNTIME_SCENARIOS.some((scenario) => !p95Seen.has(scenario.id))
    ) {
      throw new Error("baseline.p95Samples must contain every public runtime scenario");
    }
    servedBuildId = readString(value, "servedBuildId", "baseline");
    if (servedBuildId !== revision) {
      throw new Error("baseline.servedBuildId must match baseline.revision");
    }
  }
  return {
    browser,
    buildMode,
    ...(comparison ? { comparison } : {}),
    measuredAt,
    ...(p95Samples ? { p95Samples } : {}),
    revision,
    samples,
    schemaVersion: value.schemaVersion,
    ...(servedBuildId ? { servedBuildId } : {}),
    sourceFiles,
    sourceHash,
  };
}

export function evaluatePublicRuntimeRelativeRegression(
  manifest: PublicRuntimeBudgetManifest,
  candidate: PublicRuntimeSample,
  accepted: PublicRuntimeSample
): PublicRuntimeRelativeRegressionFinding[] {
  if (candidate.id !== accepted.id) {
    throw new Error("Public runtime relative comparison requires matching scenarios");
  }
  return PUBLIC_RUNTIME_METRICS.flatMap((metric) => {
    const baseline = accepted[metric];
    const policy = manifest.relativeRegression[metric];
    const limit =
      baseline + Math.max(baseline * policy.maxIncreaseFraction, policy.minAbsoluteIncrease);
    return candidate[metric] > limit
      ? [{ actual: candidate[metric], baseline, limit, metric, scenario: candidate.id }]
      : [];
  });
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
    baseline.schemaVersion === 2 &&
    baseline.servedBuildId === baseline.revision &&
    baseline.samples.every((sample) => sample.trials === 5) &&
    baseline.p95Samples?.length === PUBLIC_RUNTIME_SCENARIOS.length &&
    baseline.p95Samples.every((sample) => sample.trials === 5) &&
    baseline.comparison?.fixedFindingCount === 0 &&
    baseline.comparison.relativeFindingCount === 0 &&
    baseline.sourceFiles.length === currentSourceFiles.length &&
    baseline.sourceFiles.every((path, index) => path === currentSourceFiles[index]) &&
    baseline.sourceHash === currentSourceHash
  );
}
