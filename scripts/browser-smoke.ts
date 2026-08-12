import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { spawn } from "bun";
import { formatCliHelp, parseCliArguments } from "../config/commands/cli";

export interface BrowserSmokeManifest {
  cases: BrowserSmokeCase[];
  profiles: Record<string, { sessionEnv?: string }>;
  viewports: Record<string, { height: number; width: number }>;
}

export interface BrowserSmokeCase {
  consoleAllowlist?: string[];
  expectAnyText?: string[];
  expectPath?: string;
  expectText?: string;
  id: string;
  networkAllowlist?: string[];
  path?: string;
  pathEnv?: string;
  profile: string;
  viewport: string;
}

export interface SmokeResult {
  id: string;
  reason?: string;
  status: "passed" | "failed" | "skipped";
}

export interface BrowserSmokeCommandResult {
  exitCode: number;
  output: string;
}
export type BrowserSmokeCommandRunner = (
  session: string,
  args: string[]
) => Promise<BrowserSmokeCommandResult>;
export type BrowserSmokeArtifactWriter = (path: string, content: string) => Promise<unknown>;

interface BrowserSmokeOptions {
  artifacts?: string;
  baseUrl?: string;
  cases?: string;
  manifest?: string;
  profiles?: string;
  strict?: boolean;
}

const BROWSER_SMOKE_CLI = {
  command: "bun run smoke:browser --",
  description:
    "Run the configured browser smoke cases. This may open local browser sessions and writes redacted artifacts.",
  options: [
    { name: "manifest", type: "string" },
    { name: "artifacts", type: "string" },
    { name: "base-url", type: "string" },
    { name: "cases", type: "string" },
    { name: "profiles", type: "string" },
    { name: "strict", type: "boolean" },
  ],
} as const;

const SECRET_PATTERNS = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]"],
  [/([?&](?:token|secret|key|code)=)[^&\s]+/gi, "$1[redacted]"],
  [/(authorization|cookie|set-cookie):\s*[^\r\n]+/gi, "$1: [redacted]"],
] as const;
const CONSOLE_ERROR_PATTERN = /\b(error|uncaught|unhandled|exception)\b/i;
const DOCUMENT_OR_DATA_PATTERN = /\b(document|xhr|fetch|data)\b/i;
const EMPTY_PAGE_ERRORS_PATTERN = /^(\[\]|no (page )?errors?( found)?)$/i;
const FAILED_NETWORK_PATTERN = /\b[45]\d\d\b|\b(failed|aborted)\b|net::ERR/i;
const SAME_ORIGIN_PATH_PATTERN = /(^|\s)\/[A-Za-z0-9]/;

function validateAllowlist(
  smokeCase: BrowserSmokeCase,
  field: "consoleAllowlist" | "networkAllowlist"
) {
  for (const [index, entry] of (smokeCase[field] ?? []).entries()) {
    if (entry.trim().length < 4 || entry === "*" || entry === ".*") {
      throw new Error(
        `Browser smoke case ${smokeCase.id} ${field}[${index}] must be a narrow reviewed substring`
      );
    }
  }
}

export function redactBrowserEvidence(value: string) {
  return SECRET_PATTERNS.reduce(
    (sanitized, [pattern, replacement]) => sanitized.replace(pattern, replacement),
    value
  );
}

export function validateBrowserSmokeManifest(manifest: BrowserSmokeManifest) {
  const ids = new Set<string>();
  for (const smokeCase of manifest.cases) {
    if (ids.has(smokeCase.id)) {
      throw new Error(`Duplicate browser smoke case: ${smokeCase.id}`);
    }
    ids.add(smokeCase.id);
    if (!manifest.profiles[smokeCase.profile]) {
      throw new Error(`Unknown browser smoke profile: ${smokeCase.profile}`);
    }
    if (!manifest.viewports[smokeCase.viewport]) {
      throw new Error(`Unknown browser smoke viewport: ${smokeCase.viewport}`);
    }
    if (!(smokeCase.path || smokeCase.pathEnv)) {
      throw new Error(`Browser smoke case ${smokeCase.id} has no path or pathEnv`);
    }
    if (!(smokeCase.expectText || smokeCase.expectAnyText?.length || smokeCase.expectPath)) {
      throw new Error(`Browser smoke case ${smokeCase.id} has no assertion`);
    }
    validateAllowlist(smokeCase, "consoleAllowlist");
    validateAllowlist(smokeCase, "networkAllowlist");
  }
  return manifest;
}

export function resolveBrowserSmokeCases(
  manifest: BrowserSmokeManifest,
  env: Record<string, string | undefined>,
  selectedProfiles?: Set<string>,
  selectedCases?: Set<string>
) {
  return manifest.cases.map((smokeCase) => {
    if (selectedCases && !selectedCases.has(smokeCase.id)) {
      return { reason: "case not selected", smokeCase, status: "excluded" as const };
    }
    if (selectedProfiles && !selectedProfiles.has(smokeCase.profile)) {
      return { reason: "profile not selected", smokeCase, status: "skipped" as const };
    }
    const profile = manifest.profiles[smokeCase.profile];
    const path = smokeCase.path ?? env[smokeCase.pathEnv ?? ""];
    if (!path) {
      return { reason: `missing ${smokeCase.pathEnv}`, smokeCase, status: "skipped" as const };
    }
    const session = profile.sessionEnv ? env[profile.sessionEnv] : "citius-browser-smoke-public";
    if (!session) {
      return { reason: `missing ${profile.sessionEnv}`, smokeCase, status: "skipped" as const };
    }
    return { path, session, smokeCase, status: "ready" as const };
  });
}

const runAgentBrowser: BrowserSmokeCommandRunner = async (session, args) => {
  const child = spawn(["agent-browser", "--session", session, ...args], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, output: `${stdout}${stderr}`.trim() };
};

function nonemptyLines(output: string) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isAllowlisted(line: string, allowlist: readonly string[]) {
  return allowlist.some((allowed) => line.includes(allowed));
}

export function evaluateBrowserHealth({
  consoleAllowlist,
  consoleOutput,
  errorOutput,
  networkAllowlist,
  networkOutput,
  target,
}: {
  consoleAllowlist: readonly string[];
  consoleOutput: string;
  errorOutput: string;
  networkAllowlist: readonly string[];
  networkOutput: string;
  target: string;
}) {
  const findings: string[] = [];
  for (const line of nonemptyLines(consoleOutput)) {
    if (CONSOLE_ERROR_PATTERN.test(line) && !isAllowlisted(line, consoleAllowlist)) {
      findings.push(`console error: ${line}`);
    }
  }
  for (const line of nonemptyLines(errorOutput)) {
    if (!(EMPTY_PAGE_ERRORS_PATTERN.test(line) || isAllowlisted(line, consoleAllowlist))) {
      findings.push(`page error: ${line}`);
    }
  }

  const { origin } = new URL(target);
  for (const line of nonemptyLines(networkOutput)) {
    const failed = FAILED_NETWORK_PATTERN.test(line);
    if (!failed || isAllowlisted(line, networkAllowlist)) {
      continue;
    }
    const sameOrigin = line.includes(origin) || SAME_ORIGIN_PATH_PATTERN.test(line);
    const documentOrData = DOCUMENT_OR_DATA_PATTERN.test(line);
    if (sameOrigin || documentOrData) {
      findings.push(`failed network request: ${line}`);
    }
  }
  return findings.map(redactBrowserEvidence);
}

async function preserveFailureContext(
  artifactDir: string,
  session: string,
  smokeCase: BrowserSmokeCase,
  reason: string,
  dependencies: {
    runCommand: BrowserSmokeCommandRunner;
    writeArtifact: BrowserSmokeArtifactWriter;
  }
) {
  const { runCommand, writeArtifact } = dependencies;
  const screenshotPath = join(artifactDir, `${smokeCase.id}.png`);
  const screenshot = await runCommand(session, ["screenshot", screenshotPath]);
  const [url, consoleOutput, errorOutput, networkOutput] = await Promise.all([
    runCommand(session, ["get", "url"]),
    runCommand(session, ["console"]),
    runCommand(session, ["errors"]),
    runCommand(session, ["network", "requests"]),
  ]);
  const evidence = redactBrowserEvidence(
    JSON.stringify(
      {
        console: consoleOutput,
        errors: errorOutput,
        network: networkOutput,
        reason,
        role: smokeCase.profile,
        route: url,
        screenshot,
      },
      null,
      2
    )
  );
  await writeArtifact(join(artifactDir, `${smokeCase.id}.json`), `${evidence}\n`);
}

type ReadyBrowserSmokeCase = Extract<
  ReturnType<typeof resolveBrowserSmokeCases>[number],
  { status: "ready" }
>;

export async function runBrowserSmokeCase(
  baseUrl: string,
  artifactDir: string,
  manifest: BrowserSmokeManifest,
  resolved: ReadyBrowserSmokeCase,
  dependencies: {
    runCommand: BrowserSmokeCommandRunner;
    writeArtifact: BrowserSmokeArtifactWriter;
  } = { runCommand: runAgentBrowser, writeArtifact: writeFile }
): Promise<SmokeResult> {
  const { runCommand } = dependencies;
  const { path, session, smokeCase } = resolved;
  const viewport = manifest.viewports[smokeCase.viewport];
  const target = new URL(path, baseUrl).toString();
  const fail = async (reason: string): Promise<SmokeResult> => {
    const safeReason = redactBrowserEvidence(reason);
    await preserveFailureContext(artifactDir, session, smokeCase, safeReason, dependencies);
    return { id: smokeCase.id, reason: safeReason, status: "failed" };
  };
  const resetSteps = [
    ["console", "--clear"],
    ["errors", "--clear"],
    ["network", "requests", "--clear"],
  ];
  for (const args of resetSteps) {
    // biome-ignore lint/performance/noAwaitInLoops: browser health buffers must reset in order
    const step = await runCommand(session, args);
    if (step.exitCode !== 0) {
      return await fail(`${args.join(" ")} failed: ${step.output}`);
    }
  }
  const steps = [
    ["set", "viewport", String(viewport.width), String(viewport.height)],
    ["open", target],
    ["wait", "--load", "networkidle"],
  ];
  for (const args of steps) {
    // biome-ignore lint/performance/noAwaitInLoops: browser navigation steps are order-dependent
    const step = await runCommand(session, args);
    if (step.exitCode !== 0) {
      return await fail(`${args.join(" ")} failed: ${step.output}`);
    }
  }

  const inspections = await Promise.all([
    runCommand(session, ["get", "url"]),
    runCommand(session, ["read"]),
    runCommand(session, ["console"]),
    runCommand(session, ["errors"]),
    runCommand(session, ["network", "requests"]),
  ]);
  const inspectionNames = ["get url", "read", "console", "errors", "network requests"];
  for (const [index, inspection] of inspections.entries()) {
    if (inspection.exitCode !== 0) {
      return fail(`${inspectionNames[index]} failed: ${inspection.output}`);
    }
  }
  const [url, page, consoleOutput, errorOutput, networkOutput] = inspections;
  const actualPath = new URL(url.output.trim()).pathname;
  const textMatches = smokeCase.expectText ? page.output.includes(smokeCase.expectText) : true;
  const anyTextMatches = smokeCase.expectAnyText?.length
    ? smokeCase.expectAnyText.some((text) => page.output.includes(text))
    : true;
  const pathMatches = smokeCase.expectPath ? actualPath === smokeCase.expectPath : true;
  if (!(textMatches && anyTextMatches && pathMatches)) {
    const reason = `assertion failed at ${actualPath}`;
    return await fail(reason);
  }
  const healthFindings = evaluateBrowserHealth({
    consoleAllowlist: smokeCase.consoleAllowlist ?? [],
    consoleOutput: consoleOutput.output,
    errorOutput: errorOutput.output,
    networkAllowlist: smokeCase.networkAllowlist ?? [],
    networkOutput: networkOutput.output,
    target,
  });
  if (healthFindings.length > 0) {
    return await fail(healthFindings.join("; "));
  }
  return { id: smokeCase.id, status: "passed" };
}

export async function runBrowserSmoke(options: BrowserSmokeOptions = {}) {
  const manifestPath = options.manifest ?? "config/browser-smoke.json";
  const artifactOption = options.artifacts ?? ".scratch/browser-smoke";
  const artifactDir = isAbsolute(artifactOption)
    ? artifactOption
    : join(process.cwd(), artifactOption);
  const baseUrl = options.baseUrl ?? process.env.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";
  const selectedProfiles = options.profiles
    ? new Set(options.profiles.split(",").filter(Boolean))
    : undefined;
  const selectedCases = options.cases
    ? new Set(options.cases.split(",").filter(Boolean))
    : undefined;
  const manifest = validateBrowserSmokeManifest(
    JSON.parse(await readFile(manifestPath, "utf8")) as BrowserSmokeManifest
  );
  await mkdir(artifactDir, { recursive: true });

  const resolved = resolveBrowserSmokeCases(manifest, process.env, selectedProfiles, selectedCases);
  const results: SmokeResult[] = [];
  for (const item of resolved) {
    if (item.status === "excluded") {
      continue;
    }
    if (item.status === "skipped") {
      results.push({ id: item.smokeCase.id, reason: item.reason, status: "skipped" });
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: cases sharing a role session must not race
    results.push(await runBrowserSmokeCase(baseUrl, artifactDir, manifest, item));
  }

  const summary = { baseUrl, generatedAt: new Date().toISOString(), results };
  await writeFile(join(artifactDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  for (const result of results) {
    console.log(
      `${result.status.padEnd(7)} ${result.id}${result.reason ? ` — ${result.reason}` : ""}`
    );
  }
  const failed = results.some((result) => result.status === "failed");
  const skipped = results.some((result) => result.status === "skipped");
  if (failed || (options.strict && skipped)) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), BROWSER_SMOKE_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(BROWSER_SMOKE_CLI));
    } else {
      await runBrowserSmoke({
        artifacts:
          typeof parsed.values.artifacts === "string" ? parsed.values.artifacts : undefined,
        baseUrl:
          typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
        cases: typeof parsed.values.cases === "string" ? parsed.values.cases : undefined,
        manifest: typeof parsed.values.manifest === "string" ? parsed.values.manifest : undefined,
        profiles: typeof parsed.values.profiles === "string" ? parsed.values.profiles : undefined,
        strict: parsed.values.strict === true,
      });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Browser smoke failed");
    process.exitCode = 1;
  }
}
