import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { formatCliHelp, parseCliArguments } from "../config/commands/cli";
import { computePerformanceSourceHash } from "../config/release/check-performance-budgets";
import { publicRuntimePerformanceInputs } from "../config/release/performance-inputs";
import {
  evaluatePublicRuntimePerformance,
  evaluatePublicRuntimeRelativeRegression,
  PUBLIC_RUNTIME_METRICS,
  PUBLIC_RUNTIME_SCENARIOS,
  type PublicRuntimeBaseline,
  type PublicRuntimeMetric,
  type PublicRuntimeSample,
  type PublicRuntimeSlowResource,
  parsePublicRuntimeBaseline,
  parsePublicRuntimeBudgetManifest,
} from "../config/release/public-runtime-performance";

export interface BrowserPerformanceEntry {
  duration: number;
  initiatorType: string;
  name: string;
  transferSize: number;
}

type PublicRuntimeTrial = Pick<PublicRuntimeSample, PublicRuntimeMetric> &
  Pick<
    PublicRuntimeSample,
    | "firstPartyTransferBytes"
    | "gatedMediaTransferBytes"
    | "heroVideoRequests"
    | "slowestFirstPartyResources"
    | "thirdPartyTransferBytes"
  >;

const PUBLIC_RUNTIME_CLI = {
  command: "bun run performance:public:collect --",
  description:
    "Collect credential-free public runtime evidence from an explicit loopback Next server.",
  options: [
    { name: "base-url", type: "string" },
    { choices: ["development", "production"], name: "build-mode", type: "string" },
    { name: "output", type: "string" },
    { name: "trials", type: "string" },
  ],
} as const;
const CRITICAL_MEDIA_TYPE_PATTERN = /^(audio|video)$/i;
const HERO_MEDIA_PATH_PATTERN = /\/hero(?:-sm)?\.mp4$/i;
const HERO_MEDIA_REQUEST_PATTERN = /\/hero(?:-sm)?\.mp4(?:\?|$)/i;
const HTTP_PROTOCOL_PATTERN = /^https?:$/;
const SCRIPT_PATH_PATTERN = /\.m?js$/i;
const STYLESHEET_PATH_PATTERN = /\.css$/i;

function finiteNonnegative(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function resourcePath(url: URL) {
  return `${url.pathname}${url.search ? "?[query]" : ""}`;
}

export function summarizePublicRuntimeEntries(target: string, entries: BrowserPerformanceEntry[]) {
  const { origin } = new URL(target);
  let criticalTransferBytes = 0;
  let cssTransferBytes = 0;
  let firstPartyTransferBytes = 0;
  let gatedMediaTransferBytes = 0;
  let jsTransferBytes = 0;
  let thirdPartyTransferBytes = 0;
  const firstPartyResources: PublicRuntimeSlowResource[] = [];

  for (const entry of entries) {
    let url: URL;
    try {
      url = new URL(entry.name, target);
    } catch {
      continue;
    }
    const transferBytes = finiteNonnegative(entry.transferSize);
    if (url.origin !== origin) {
      thirdPartyTransferBytes += transferBytes;
      continue;
    }
    firstPartyTransferBytes += transferBytes;
    const path = resourcePath(url);
    const gatedMedia = HERO_MEDIA_PATH_PATTERN.test(url.pathname);
    const script = entry.initiatorType === "script" || SCRIPT_PATH_PATTERN.test(url.pathname);
    const stylesheet = entry.initiatorType === "css" || STYLESHEET_PATH_PATTERN.test(url.pathname);
    if (gatedMedia) {
      gatedMediaTransferBytes += transferBytes;
    } else if (!CRITICAL_MEDIA_TYPE_PATTERN.test(entry.initiatorType)) {
      criticalTransferBytes += transferBytes;
    }
    if (script) {
      jsTransferBytes += transferBytes;
    }
    if (stylesheet) {
      cssTransferBytes += transferBytes;
    }
    firstPartyResources.push({
      durationMs: finiteNonnegative(entry.duration),
      path,
      transferBytes,
      type: entry.initiatorType || "unknown",
    });
  }
  return {
    criticalTransferBytes,
    cssTransferBytes,
    firstPartyTransferBytes,
    gatedMediaTransferBytes,
    jsTransferBytes,
    slowestFirstPartyResources: firstPartyResources
      .sort(
        (left, right) => right.durationMs - left.durationMs || left.path.localeCompare(right.path)
      )
      .slice(0, 5),
    thirdPartyTransferBytes,
  };
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  const value =
    ordered.length % 2 === 0
      ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
      : (ordered[middle] ?? 0);
  return Number(value.toFixed(2));
}

export function aggregatePublicRuntimeTrials(trials: PublicRuntimeTrial[]) {
  if (trials.length === 0) {
    throw new Error("At least one public runtime trial is required");
  }
  const numericFields = [
    ...PUBLIC_RUNTIME_METRICS,
    "firstPartyTransferBytes",
    "gatedMediaTransferBytes",
    "heroVideoRequests",
    "thirdPartyTransferBytes",
  ] as const;
  const aggregate = Object.fromEntries(
    numericFields.map((field) => [field, median(trials.map((trial) => trial[field]))])
  ) as Pick<PublicRuntimeSample, (typeof numericFields)[number]>;
  const resources = trials
    .flatMap((trial) => trial.slowestFirstPartyResources)
    .sort(
      (left, right) => right.durationMs - left.durationMs || left.path.localeCompare(right.path)
    );
  const seen = new Set<string>();
  return {
    ...aggregate,
    slowestFirstPartyResources: resources
      .filter((resource) => {
        const key = `${resource.type}:${resource.path}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 5),
    trials: trials.length,
  };
}

export function assertLocalPerformanceTarget(value: string) {
  const target = new URL(value);
  if (!(["localhost", "127.0.0.1", "[::1]"] as string[]).includes(target.hostname)) {
    throw new Error("Public runtime collection is restricted to an explicit loopback target");
  }
  if (!HTTP_PROTOCOL_PATTERN.test(target.protocol)) {
    throw new Error("Public runtime collection requires an HTTP(S) loopback target");
  }
  return target;
}

async function collectTrial(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  scenario: (typeof PUBLIC_RUNTIME_SCENARIOS)[number],
  baseUrl: URL
): Promise<PublicRuntimeTrial> {
  const context = await browser.newContext({
    reducedMotion: scenario.variant === "reduced-motion" ? "reduce" : "no-preference",
    serviceWorkers: "block",
    viewport: scenario.viewport,
  });
  if (scenario.variant === "data-saver") {
    await context.addInitScript(() => {
      const connection = {
        addEventListener: () => undefined,
        effectiveType: "4g",
        removeEventListener: () => undefined,
        saveData: true,
      };
      Object.defineProperty(navigator, "connection", { configurable: true, get: () => connection });
      Object.defineProperty(navigator, "mozConnection", {
        configurable: true,
        get: () => connection,
      });
      Object.defineProperty(navigator, "webkitConnection", {
        configurable: true,
        get: () => connection,
      });
    });
  }
  await context.addInitScript(() => {
    (window as typeof window & { __citiusLcp?: number }).__citiusLcp = 0;
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const latest = entries.at(-1);
      if (latest) {
        (window as typeof window & { __citiusLcp?: number }).__citiusLcp = latest.startTime;
      }
    }).observe({ buffered: true, type: "largest-contentful-paint" });
  });
  const page = await context.newPage();
  let requests = 0;
  let heroVideoRequests = 0;
  page.on("request", (request) => {
    requests += 1;
    if (HERO_MEDIA_REQUEST_PATTERN.test(request.url())) {
      heroVideoRequests += 1;
    }
  });
  const target = new URL(scenario.path, baseUrl).toString();
  await page.goto(target, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const timing = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const [fcp] = performance.getEntriesByName("first-contentful-paint");
    const entries = [navigation, ...performance.getEntriesByType("resource")].map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        duration: entry.duration,
        initiatorType: resource.initiatorType || "navigation",
        name: entry.name,
        transferSize: resource.transferSize ?? 0,
      };
    });
    return {
      domCompleteMs: navigation.domComplete,
      domInteractiveMs: navigation.domInteractive,
      entries,
      fcpMs: fcp?.startTime ?? 0,
      lcpMs: (window as typeof window & { __citiusLcp?: number }).__citiusLcp ?? 0,
      loadMs: navigation.loadEventEnd,
      ttfbMs: navigation.responseStart,
    };
  });
  const transfers = summarizePublicRuntimeEntries(target, timing.entries);
  await context.close();
  return {
    ...transfers,
    domCompleteMs: finiteNonnegative(timing.domCompleteMs),
    domInteractiveMs: finiteNonnegative(timing.domInteractiveMs),
    fcpMs: finiteNonnegative(timing.fcpMs),
    heroVideoRequests,
    lcpMs: finiteNonnegative(timing.lcpMs),
    loadMs: finiteNonnegative(timing.loadMs),
    requests,
    ttfbMs: finiteNonnegative(timing.ttfbMs),
  };
}

function resolveRevision(root: string) {
  const git = (args: string[]) =>
    spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false }).stdout.trim();
  const head = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (!status) {
    return head;
  }
  const fingerprint = createHash("sha256").update(status).digest("hex").slice(0, 12);
  throw new Error(
    `Public runtime collection requires a clean checkout; current dirty fingerprint is ${fingerprint}`
  );
}

function resolveOutput(root: string, value: string) {
  const output = resolve(root, value);
  const scratchRoot = resolve(root, ".scratch/public-runtime-performance");
  const relativeOutput = relative(scratchRoot, output);
  if (!relativeOutput || relativeOutput.startsWith("..")) {
    throw new Error("--output must name a file under .scratch/public-runtime-performance");
  }
  return output;
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), PUBLIC_RUNTIME_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(PUBLIC_RUNTIME_CLI));
    } else {
      if (typeof parsed.values["base-url"] !== "string") {
        throw new Error("--base-url is required");
      }
      if (typeof parsed.values["build-mode"] !== "string") {
        throw new Error("--build-mode is required");
      }
      if (parsed.values["build-mode"] !== "production") {
        throw new Error("Public runtime baseline collection requires --build-mode=production");
      }
      const root = resolve(import.meta.dir, "..");
      const baseUrl = assertLocalPerformanceTarget(parsed.values["base-url"]);
      const output = resolveOutput(
        root,
        typeof parsed.values.output === "string"
          ? parsed.values.output
          : ".scratch/public-runtime-performance/latest.json"
      );
      const trialValue = parsed.values.trials;
      const trials = Number(typeof trialValue === "string" ? trialValue : "3");
      if (!Number.isInteger(trials) || trials < 3 || trials > 10) {
        throw new Error("--trials must be an integer from 3 to 10");
      }
      const browser = await chromium.launch({ headless: true });
      const browserVersion = browser.version();
      const samples: PublicRuntimeSample[] = [];
      for (const scenario of PUBLIC_RUNTIME_SCENARIOS) {
        const trialResults: PublicRuntimeTrial[] = [];
        for (let index = 0; index < trials; index += 1) {
          // biome-ignore lint/performance/noAwaitInLoops: repeated cold browser contexts are deliberate
          trialResults.push(await collectTrial(browser, scenario, baseUrl));
        }
        const aggregate = aggregatePublicRuntimeTrials(trialResults);
        samples.push({
          ...aggregate,
          cache: "cold",
          id: scenario.id,
          network: "loopback-unthrottled",
          path: scenario.path,
          variant: scenario.variant,
          viewport: { ...scenario.viewport },
        });
        console.log(`Measured ${scenario.id}: median LCP ${aggregate.lcpMs} ms`);
      }
      await browser.close();
      const sourceFiles = publicRuntimePerformanceInputs(root);
      const baseline: PublicRuntimeBaseline = {
        browser: `Chromium ${browserVersion}`,
        buildMode: `local Next ${parsed.values["build-mode"]} server`,
        measuredAt: new Date().toISOString(),
        revision: resolveRevision(root),
        samples,
        schemaVersion: 1,
        sourceFiles,
        sourceHash: computePerformanceSourceHash(root, sourceFiles),
      };
      const accepted = parsePublicRuntimeBaseline(
        JSON.parse(
          readFileSync(
            resolve(root, "config/release/public-runtime-performance-baseline.json"),
            "utf8"
          )
        )
      );
      const budget = parsePublicRuntimeBudgetManifest(
        JSON.parse(
          readFileSync(
            resolve(root, "config/release/public-runtime-performance-budgets.json"),
            "utf8"
          )
        )
      );
      const acceptedByScenario = new Map(accepted.samples.map((sample) => [sample.id, sample]));
      const fixedFindings = baseline.samples.flatMap((sample) =>
        evaluatePublicRuntimePerformance(budget, sample)
      );
      const failures = fixedFindings.filter((finding) => finding.severity === "failure");
      const relativeFindings = baseline.samples.flatMap((sample) => {
        const acceptedSample = acceptedByScenario.get(sample.id);
        if (!acceptedSample) {
          throw new Error(`Accepted public runtime baseline is missing ${sample.id}`);
        }
        return evaluatePublicRuntimeRelativeRegression(budget, sample, acceptedSample);
      });
      if (failures.length > 0 || relativeFindings.length > 0) {
        throw new Error(
          `Public runtime candidate failed ${failures.length} fixed and ${relativeFindings.length} relative budgets: ${JSON.stringify({ failures, relativeFindings })}`
        );
      }
      for (const warning of fixedFindings.filter((finding) => finding.severity === "warning")) {
        console.warn(
          `Public runtime warning: ${warning.scenario} ${warning.metric} is ${warning.actual}; warning threshold is ${warning.limit}`
        );
      }
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`);
      console.log(`Wrote ${samples.length} public runtime aggregates to ${relative(root, output)}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Public runtime collection failed");
    process.exitCode = 1;
  }
}
