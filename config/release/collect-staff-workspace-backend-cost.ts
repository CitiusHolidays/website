import { execFile, execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  isRuntimeBoolean,
  isRuntimeNumber,
  isRuntimeObject,
  isRuntimeString,
} from "../../src/lib/runtimeValues";
import {
  type ApprovedE2eTarget,
  readApprovedE2eTarget,
  verifyConvexE2eIdentity,
  verifyFrontendE2eIdentity,
} from "../e2e/target-identity";
import type { JsonObject, JsonValue } from "../lib/jsonValue";
import {
  type BackendCostProviderProvenance,
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
const LINE_PATTERN = /\r?\n/;
const EVIDENCE_TRIAL_COUNT = 5;
const PROVIDER_HISTORY = 1000;
const PROVIDER_CAPTURE_TIMEOUT_MS = 5 * 60_000;
const PROVIDER_MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const PROVIDER_READY_TIMEOUT_MS = 15_000;

interface ProviderHistoryCaptureError {
  killed?: boolean;
  signal?: NodeJS.Signals | null;
}

interface ProviderHistoryCapture {
  output: string;
  termination: "completed" | "stopped_after_trial";
}

export function acceptProviderTrialCapture(args: {
  error: ProviderHistoryCaptureError | null;
  stoppedByOwner: boolean;
  stdout: string;
}): ProviderHistoryCapture {
  const output = args.stdout.trim();
  if (!output.split(LINE_PATTERN).some((line) => line.trim().startsWith("{"))) {
    throw new Error("Bounded provider history capture returned no JSON events");
  }
  if (!args.error) {
    return {
      output,
      termination: args.stoppedByOwner ? "stopped_after_trial" : "completed",
    };
  }
  if (args.stoppedByOwner && args.error.killed && args.error.signal === "SIGTERM") {
    return { output, termination: "stopped_after_trial" };
  }
  throw new Error("Provider trial capture failed or exceeded its owned timeout");
}

function startProviderTrialCapture(providerArgs: string[], root: string, env: NodeJS.ProcessEnv) {
  let stoppedByOwner = false;
  let readySettled = false;
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolvePromise, rejectPromise) => {
    resolveReady = resolvePromise;
    rejectReady = rejectPromise;
  });
  const readyTimer = setTimeout(() => {
    if (!readySettled) {
      readySettled = true;
      rejectReady(new Error("Provider trial capture did not produce JSON history in time"));
    }
  }, PROVIDER_READY_TIMEOUT_MS);
  let child: ReturnType<typeof execFile>;
  const result = new Promise<ProviderHistoryCapture>((resolveCapture, rejectCapture) => {
    child = execFile(
      "bunx",
      providerArgs,
      {
        cwd: root,
        encoding: "utf8",
        env,
        killSignal: "SIGTERM",
        maxBuffer: PROVIDER_MAX_BUFFER_BYTES,
        timeout: PROVIDER_CAPTURE_TIMEOUT_MS,
      },
      (error, stdout) => {
        try {
          resolveCapture(
            acceptProviderTrialCapture({ error, stdout: String(stdout), stoppedByOwner })
          );
        } catch (captureError) {
          rejectCapture(captureError);
        }
      }
    );
    child.stdout?.on("data", (chunk) => {
      const hasJsonEvent = String(chunk)
        .split(LINE_PATTERN)
        .some((line) => line.trim().startsWith("{"));
      if (!readySettled && hasJsonEvent) {
        readySettled = true;
        clearTimeout(readyTimer);
        resolveReady();
      }
    });
    child.once("exit", () => {
      if (!readySettled) {
        readySettled = true;
        clearTimeout(readyTimer);
        rejectReady(new Error("Provider trial capture exited before producing JSON history"));
      }
    });
  });
  result.catch(() => undefined);
  return {
    ready,
    async stop() {
      stoppedByOwner = true;
      clearTimeout(readyTimer);
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGTERM");
      }
      return await result;
    },
  };
}

function runPlaywrightTrial(root: string, trialDir: string, revision: string, trial: number) {
  return new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(
      "bunx",
      ["playwright", "test", "e2e/specs/staff-workspace-performance.spec.ts"],
      {
        cwd: root,
        env: {
          ...process.env,
          E2E_EVIDENCE_REVISION: revision,
          E2E_PERFORMANCE_DEFER_BUDGETS: "1",
          E2E_PERFORMANCE_RUN_DIR: trialDir,
          E2E_PERFORMANCE_TRIAL_INDEX: String(trial),
          E2E_STRICT: "1",
        },
        stdio: "inherit",
      }
    );
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(
        new Error(`Strict backend-cost browser trial ${trial} failed (${String(code ?? signal)})`)
      );
    });
  });
}

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

function assertRecord(value: JsonValue, path: string): asserts value is JsonObject {
  if (!(value && isRuntimeObject(value)) || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function finiteNonnegative(value: JsonValue, path: string) {
  if (!(isRuntimeNumber(value) && Number.isFinite(value)) || value < 0) {
    throw new Error(`${path} must be a finite nonnegative number`);
  }
  return value;
}

function parseBrowserWindow(
  value: JsonValue,
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
      (name) => !(isRuntimeString(name) && SAFE_SUBSCRIPTION_NAME_PATTERN.test(name))
    )
  ) {
    throw new Error(`${path}.subscriptions must contain only privacy-safe function names`);
  }
  return {
    finishedAtUnixMs,
    startedAtUnixMs,
    subscriptions: [...new Set(value.subscriptions)],
    target,
    warm,
  };
}

function parseBrowserTrialEvidence(value: JsonValue, path: string): BrowserTrialEvidence {
  assertRecord(value, path);
  if (
    !(
      isRuntimeString(value.target) &&
      STAFF_WORKSPACE_PERFORMANCE_TARGETS.some((target) => target === value.target)
    )
  ) {
    throw new Error(`${path}.target must be a known target`);
  }
  if (!isRuntimeString(value.revision)) {
    throw new Error(`${path}.revision must be a string`);
  }
  const target = STAFF_WORKSPACE_PERFORMANCE_TARGETS.find(
    (candidate) => candidate === value.target
  );
  if (!target) {
    throw new Error("Performance evidence target is invalid");
  }
  return {
    cold: parseBrowserWindow(value.cold, target, false, `${path}.cold`),
    revision: value.revision,
    target,
    warm: parseBrowserWindow(value.warm, target, true, `${path}.warm`),
  };
}

function parseProviderCompletionEvent(
  value: JsonValue,
  path: string
): ProviderCompletionEvent | null {
  assertRecord(value, path);
  if (value.kind !== "Completion") {
    return null;
  }
  if (!isRuntimeString(value.identifier) || value.identifier.length === 0) {
    throw new Error(`${path}.identifier must be a non-empty string`);
  }
  assertRecord(value.usageStats, `${path}.usageStats`);
  if (!isRuntimeBoolean(value.willRetry)) {
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
  capturedAt: string;
  provider: BackendCostProviderProvenance;
  revision: string;
  targetBinding: ApprovedE2eTarget;
  trialCaptures: { browserEvidence: unknown[]; completionEvents: unknown[] }[];
}): StaffWorkspaceBackendCostMetricsExport {
  if (args.trialCaptures.length !== EVIDENCE_TRIAL_COUNT) {
    throw new Error(
      `Backend-cost collection requires exactly ${EVIDENCE_TRIAL_COUNT} provider-bound browser trials`
    );
  }
  const trialCaptures = args.trialCaptures.map((capture, trialIndex) => {
    const browserEvidence = capture.browserEvidence.map((value, evidenceIndex) =>
      parseBrowserTrialEvidence(
        value,
        `trial capture[${trialIndex}].browser evidence[${evidenceIndex}]`
      )
    );
    if (browserEvidence.length !== STAFF_WORKSPACE_PERFORMANCE_TARGETS.length) {
      throw new Error("Every backend-cost trial must contain the complete route matrix");
    }
    for (const target of STAFF_WORKSPACE_PERFORMANCE_TARGETS) {
      if (browserEvidence.filter((value) => value.target === target).length !== 1) {
        throw new Error(`Every backend-cost trial must contain exactly one ${target} sample`);
      }
    }
    if (browserEvidence.some((value) => value.revision !== args.revision)) {
      throw new Error(
        "Backend-cost browser evidence revision does not match the requested revision"
      );
    }
    const completionEvents = capture.completionEvents.flatMap((value, eventIndex) => {
      const parsed = parseProviderCompletionEvent(
        value,
        `trial capture[${trialIndex}].completion event[${eventIndex}]`
      );
      return parsed ? [parsed] : [];
    });
    return { browserEvidence, completionEvents };
  });
  const groupedSamples = STAFF_WORKSPACE_PERFORMANCE_TARGETS.flatMap((target) =>
    [false, true].map((warm) =>
      trialCaptures.map((capture) => {
        const trial = capture.browserEvidence.find((value) => value.target === target)!;
        return aggregateWindow(warm ? trial.warm : trial.cold, capture.completionEvents);
      })
    )
  );
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
  const runDir = pathInsideScratch(
    root,
    `${SCRATCH_ROOT}/staff-workspace-backend-cost/${revision}`,
    "Backend-cost run directory"
  );
  mkdirSync(runDir, { recursive: true });
  const trialCaptures: { browserEvidence: unknown[]; completionEvents: unknown[] }[] = [];
  const terminations: BackendCostProviderProvenance["terminations"] = [];
  for (let trial = 1; trial <= EVIDENCE_TRIAL_COUNT; trial += 1) {
    const trialDir = resolve(runDir, `trial-${trial}`);
    mkdirSync(trialDir, { recursive: true });
    console.log(`Running provider-bound backend-cost trial ${trial}/${EVIDENCE_TRIAL_COUNT}`);
    const providerCapture = startProviderTrialCapture(providerArgs, root, process.env);
    try {
      // biome-ignore lint/performance/noAwaitInLoops: provider-bound trials must stay sequential to isolate their log windows.
      await providerCapture.ready;
    } catch (error) {
      await providerCapture.stop().catch(() => undefined);
      throw error;
    }
    let browserError: unknown;
    try {
      await runPlaywrightTrial(root, trialDir, revision, trial);
    } catch (error) {
      browserError = error;
    }
    const captured = await providerCapture.stop();
    if (browserError) {
      throw browserError;
    }
    const completionEvents = captured.output
      .split(LINE_PATTERN)
      .filter((line) => line.trim().startsWith("{"))
      .map((line) => JSON.parse(line));
    const browserEvidence = STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) =>
      JSON.parse(readFileSync(resolve(trialDir, `${target}.json`), "utf8"))
    );
    trialCaptures.push({ browserEvidence, completionEvents });
    terminations.push(captured.termination);
  }
  const capturedAt = new Date().toISOString();
  const metricsExport = buildStaffWorkspaceBackendCostMetricsExport({
    capturedAt,
    provider: {
      captureCount: EVIDENCE_TRIAL_COUNT,
      captureTimeoutMs: PROVIDER_CAPTURE_TIMEOUT_MS,
      command: `convex logs --deployment ${deployment} --success --jsonl --history ${PROVIDER_HISTORY}`,
      deployment,
      history: PROVIDER_HISTORY,
      identityVerifiedAt,
      terminations,
    },
    revision,
    targetBinding: approvedTarget,
    trialCaptures,
  });
  const output = resolve(root, OUTPUT_PATH);
  mkdirSync(resolve(root, `${SCRATCH_ROOT}/performance`), { recursive: true });
  writeFileSync(output, `${JSON.stringify(metricsExport, null, 2)}\n`, { flag: "w" });
  console.log(`Wrote privacy-safe provider aggregates to ${OUTPUT_PATH}`);
  console.log(
    "The output contains no arguments, identities, URLs, tokens, or raw completion events."
  );
}
