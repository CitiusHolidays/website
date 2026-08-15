import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  type ApprovedE2eTarget,
  readApprovedE2eTarget,
  verifyConvexE2eIdentity,
  verifyFrontendE2eIdentity,
} from "../e2e/target-identity";
import {
  parseStaffWorkspaceBackendCostMetricsExport,
  type StaffWorkspaceBackendCostMetricsExport,
  type StaffWorkspaceBackendCostSample,
} from "./staff-workspace-backend-cost";
import {
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
  type StaffWorkspacePerformanceTarget,
} from "./staff-workspace-performance-budget";

const SCRATCH_ROOT = ".scratch";
const OUTPUT_PATH = `${SCRATCH_ROOT}/performance/staff-workspace-backend-cost-metrics-export.json`;
const SAFE_SUBSCRIPTION_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const EVIDENCE_TRIAL_COUNT = 5;
const PROVIDER_HISTORY = 10_000;

interface BrowserWindowSample {
  finishedAtUnixMs: number;
  startedAtUnixMs: number;
  subscriptions: string[];
  target: StaffWorkspacePerformanceTarget;
  warm: boolean;
}

interface BrowserTrialEvidence {
  cold: BrowserWindowSample;
  revision: string;
  target: StaffWorkspacePerformanceTarget;
  warm: BrowserWindowSample;
}

interface ProviderCompletionEvent {
  executionTime: number;
  identifier: string;
  kind: "Completion";
  timestamp: number;
  usageStats: {
    databaseIoReadBytes: number;
    databaseReadBytes: number;
    databaseReadDocuments: number;
  };
  willRetry: boolean;
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function finiteNonnegative(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a finite nonnegative number`);
  }
  return value;
}

function parseBrowserWindow(
  value: unknown,
  target: StaffWorkspacePerformanceTarget,
  warm: boolean,
  path: string
): BrowserWindowSample {
  assertRecord(value, path);
  if (value.target !== target || value.warm !== warm) {
    throw new Error(`${path} target/warm identity is malformed`);
  }
  const startedAtUnixMs = finiteNonnegative(value.startedAtUnixMs, `${path}.startedAtUnixMs`);
  const finishedAtUnixMs = finiteNonnegative(value.finishedAtUnixMs, `${path}.finishedAtUnixMs`);
  if (finishedAtUnixMs <= startedAtUnixMs) {
    throw new Error(`${path} must have a positive observation window`);
  }
  if (
    !Array.isArray(value.subscriptions) ||
    value.subscriptions.length === 0 ||
    value.subscriptions.some(
      (name) => typeof name !== "string" || !SAFE_SUBSCRIPTION_NAME_PATTERN.test(name)
    )
  ) {
    throw new Error(`${path}.subscriptions must contain only privacy-safe function names`);
  }
  return {
    finishedAtUnixMs,
    startedAtUnixMs,
    subscriptions: [...new Set(value.subscriptions as string[])],
    target,
    warm,
  };
}

function parseBrowserTrialEvidence(value: unknown, path: string): BrowserTrialEvidence {
  assertRecord(value, path);
  if (
    typeof value.target !== "string" ||
    !STAFF_WORKSPACE_PERFORMANCE_TARGETS.includes(value.target as StaffWorkspacePerformanceTarget)
  ) {
    throw new Error(`${path}.target must be a known target`);
  }
  if (typeof value.revision !== "string") {
    throw new Error(`${path}.revision must be a string`);
  }
  const target = value.target as StaffWorkspacePerformanceTarget;
  return {
    cold: parseBrowserWindow(value.cold, target, false, `${path}.cold`),
    revision: value.revision,
    target,
    warm: parseBrowserWindow(value.warm, target, true, `${path}.warm`),
  };
}

function parseProviderCompletionEvent(
  value: unknown,
  path: string
): ProviderCompletionEvent | null {
  assertRecord(value, path);
  if (value.kind !== "Completion") {
    return null;
  }
  if (typeof value.identifier !== "string" || value.identifier.length === 0) {
    throw new Error(`${path}.identifier must be a non-empty string`);
  }
  assertRecord(value.usageStats, `${path}.usageStats`);
  if (typeof value.willRetry !== "boolean") {
    throw new Error(`${path}.willRetry must be a boolean`);
  }
  return {
    executionTime: finiteNonnegative(value.executionTime, `${path}.executionTime`),
    identifier: value.identifier,
    kind: "Completion",
    timestamp: finiteNonnegative(value.timestamp, `${path}.timestamp`),
    usageStats: {
      databaseIoReadBytes: finiteNonnegative(
        value.usageStats.databaseIoReadBytes,
        `${path}.usageStats.databaseIoReadBytes`
      ),
      databaseReadBytes: finiteNonnegative(
        value.usageStats.databaseReadBytes,
        `${path}.usageStats.databaseReadBytes`
      ),
      databaseReadDocuments: finiteNonnegative(
        value.usageStats.databaseReadDocuments,
        `${path}.usageStats.databaseReadDocuments`
      ),
    },
    willRetry: value.willRetry,
  };
}

function subscriptionNameToProviderIdentifier(name: string) {
  const parts = name.split(".");
  if (parts.length < 2) {
    throw new Error(`Subscription ${name} is not a qualified privacy-safe function name`);
  }
  const functionName = parts.pop();
  return `${parts.join("/")}:${functionName}`;
}

function aggregateWindow(
  sample: BrowserWindowSample,
  completionEvents: ProviderCompletionEvent[]
): StaffWorkspaceBackendCostSample {
  const expectedIdentifiers = new Set(
    sample.subscriptions.map((name) => subscriptionNameToProviderIdentifier(name))
  );
  const matched = completionEvents.filter(
    (event) =>
      expectedIdentifiers.has(event.identifier) &&
      event.timestamp * 1000 >= sample.startedAtUnixMs &&
      event.timestamp * 1000 <= sample.finishedAtUnixMs
  );
  for (const identifier of expectedIdentifiers) {
    if (!matched.some((event) => event.identifier === identifier)) {
      throw new Error(
        `Backend-cost ${sample.target} ${sample.warm ? "warm" : "cold"} window is missing completion evidence`
      );
    }
  }
  const totals = matched.reduce(
    (total, event) => ({
      databaseIoReadBytes: total.databaseIoReadBytes + event.usageStats.databaseIoReadBytes,
      databaseReadBytes: total.databaseReadBytes + event.usageStats.databaseReadBytes,
      documentsRead: total.documentsRead + event.usageStats.databaseReadDocuments,
      executionMs: total.executionMs + event.executionTime * 1000,
      occRetries: total.occRetries + (event.willRetry ? 1 : 0),
    }),
    {
      databaseIoReadBytes: 0,
      databaseReadBytes: 0,
      documentsRead: 0,
      executionMs: 0,
      occRetries: 0,
    }
  );
  return {
    ...totals,
    executionMs: Number(totals.executionMs.toFixed(3)),
    target: sample.target,
    warm: sample.warm,
  };
}

function percentile(values: number[], quantile: 0.5 | 0.95) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * quantile) - 1)]!;
}

function aggregateBackendCostTrials(
  trials: StaffWorkspaceBackendCostSample[],
  quantile: 0.5 | 0.95
) {
  const [first] = trials;
  if (!first) {
    throw new Error("Backend-cost aggregation requires repeated samples");
  }
  return {
    databaseIoReadBytes: percentile(
      trials.map((sample) => sample.databaseIoReadBytes),
      quantile
    ),
    databaseReadBytes: percentile(
      trials.map((sample) => sample.databaseReadBytes),
      quantile
    ),
    documentsRead: percentile(
      trials.map((sample) => sample.documentsRead),
      quantile
    ),
    executionMs: percentile(
      trials.map((sample) => sample.executionMs),
      quantile
    ),
    occRetries: percentile(
      trials.map((sample) => sample.occRetries),
      quantile
    ),
    target: first.target,
    warm: first.warm,
  };
}

export function buildStaffWorkspaceBackendCostMetricsExport(args: {
  browserEvidence: unknown[];
  capturedAt: string;
  completionEvents: unknown[];
  provider: {
    command: string;
    deployment: string;
    history: number;
    identityVerifiedAt: string;
  };
  revision: string;
  targetBinding: ApprovedE2eTarget;
}): StaffWorkspaceBackendCostMetricsExport {
  const browserEvidence = args.browserEvidence.map((value, index) =>
    parseBrowserTrialEvidence(value, `browser evidence[${index}]`)
  );
  const expectedEvidence = STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * EVIDENCE_TRIAL_COUNT;
  if (browserEvidence.length !== expectedEvidence) {
    throw new Error(
      `Backend-cost collection requires exactly ${EVIDENCE_TRIAL_COUNT} browser trials for every target`
    );
  }
  if (browserEvidence.some((value) => value.revision !== args.revision)) {
    throw new Error("Backend-cost browser evidence revision does not match the requested revision");
  }
  const completionEvents = args.completionEvents.flatMap((value, index) => {
    const parsed = parseProviderCompletionEvent(value, `completion event[${index}]`);
    return parsed ? [parsed] : [];
  });
  const groupedSamples = STAFF_WORKSPACE_PERFORMANCE_TARGETS.flatMap((target) => {
    const targetTrials = browserEvidence.filter((value) => value.target === target);
    if (targetTrials.length !== EVIDENCE_TRIAL_COUNT) {
      throw new Error(
        `Backend-cost browser evidence requires ${EVIDENCE_TRIAL_COUNT} ${target} trials`
      );
    }
    return [false, true].map((warm) =>
      targetTrials.map((trial) => aggregateWindow(warm ? trial.warm : trial.cold, completionEvents))
    );
  });
  return parseStaffWorkspaceBackendCostMetricsExport({
    capturedAt: args.capturedAt,
    p95Samples: groupedSamples.map((trials) => aggregateBackendCostTrials(trials, 0.95)),
    provider: args.provider,
    revision: args.revision,
    samples: groupedSamples.map((trials) => aggregateBackendCostTrials(trials, 0.5)),
    schemaVersion: 3,
    targetBinding: args.targetBinding,
    trialCount: EVIDENCE_TRIAL_COUNT,
  });
}

function pathInsideScratch(root: string, requestedPath: string, label: string) {
  const boundary = resolve(root, SCRATCH_ROOT);
  const resolved = resolve(root, requestedPath);
  const within = relative(boundary, resolved);
  if (!within || within.startsWith("..")) {
    throw new Error(`${label} must name a path below ${SCRATCH_ROOT}`);
  }
  return resolved;
}

function deploymentName(approvedTarget: ApprovedE2eTarget) {
  if (approvedTarget.target !== "preview") {
    throw new Error("Provider-native backend logs currently require an explicit Convex Preview");
  }
  const [deployment] = new URL(approvedTarget.convexSiteOrigin).hostname.split(".");
  if (!(deployment && approvedTarget.id.startsWith(`preview-${deployment}`))) {
    throw new Error("Approved target ID does not bind the Convex Preview deployment");
  }
  return deployment;
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  const [, , requestedRunDir] = process.argv;
  if (!requestedRunDir) {
    throw new Error(
      "Usage: bun run performance:backend:collect -- .scratch/staff-workspace-performance/<revision>"
    );
  }
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (dirty) {
    throw new Error("Backend-cost collection requires a clean tracked working tree");
  }
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const targetKind = process.env.E2E_PROVISIONING_TARGET?.trim();
  if (!(targetKind === "development" || targetKind === "preview")) {
    throw new Error(
      "E2E_PROVISIONING_TARGET must be development or preview; Production is forbidden"
    );
  }
  const baseUrl = process.env.BROWSER_SMOKE_BASE_URL;
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!(baseUrl && convexSiteUrl)) {
    throw new Error("BROWSER_SMOKE_BASE_URL and NEXT_PUBLIC_CONVEX_SITE_URL are required");
  }
  const approvedTarget = readApprovedE2eTarget({
    baseUrl,
    convexSiteUrl,
    manifestPath: process.env.E2E_TARGET_MANIFEST,
    root,
    target: targetKind,
    targetId: process.env.E2E_TARGET_ID,
  });
  if (approvedTarget.revision !== revision) {
    throw new Error("Backend-cost collection revision does not match the approved deployed target");
  }
  await verifyFrontendE2eIdentity(approvedTarget);
  await verifyConvexE2eIdentity(approvedTarget);
  const deployment = deploymentName(approvedTarget);
  const identityVerifiedAt = new Date().toISOString();
  const providerArgs = [
    "convex",
    "logs",
    "--deployment",
    deployment,
    "--success",
    "--jsonl",
    "--history",
    String(PROVIDER_HISTORY),
  ];
  const providerOutput = execFileSync("bunx", providerArgs, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 50 * 1024 * 1024,
  });
  const completionEvents = providerOutput
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("{"))
    .map((line) => JSON.parse(line) as unknown);
  const runDir = pathInsideScratch(root, requestedRunDir, "Browser run directory");
  const browserEvidence = Array.from(
    { length: EVIDENCE_TRIAL_COUNT },
    (_, index) => index + 1
  ).flatMap((trial) =>
    STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) =>
      JSON.parse(readFileSync(resolve(runDir, `trial-${trial}`, `${target}.json`), "utf8"))
    )
  );
  const capturedAt = new Date().toISOString();
  const metricsExport = buildStaffWorkspaceBackendCostMetricsExport({
    browserEvidence,
    capturedAt,
    completionEvents,
    provider: {
      command: `convex logs --deployment ${deployment} --success --jsonl --history ${PROVIDER_HISTORY}`,
      deployment,
      history: PROVIDER_HISTORY,
      identityVerifiedAt,
    },
    revision,
    targetBinding: approvedTarget,
  });
  const output = resolve(root, OUTPUT_PATH);
  mkdirSync(resolve(root, `${SCRATCH_ROOT}/performance`), { recursive: true });
  writeFileSync(output, `${JSON.stringify(metricsExport, null, 2)}\n`, { flag: "w" });
  console.log(`Wrote privacy-safe provider aggregates to ${OUTPUT_PATH}`);
  console.log(
    "The output contains no arguments, identities, URLs, tokens, or raw completion events."
  );
}
