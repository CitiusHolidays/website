import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { spawn } from "bun";

export interface BrowserSmokeManifest {
  cases: BrowserSmokeCase[];
  profiles: Record<string, { sessionEnv?: string }>;
  viewports: Record<string, { height: number; width: number }>;
}

export interface BrowserSmokeCase {
  expectAnyText?: string[];
  expectPath?: string;
  expectText?: string;
  id: string;
  path?: string;
  pathEnv?: string;
  profile: string;
  viewport: string;
}

interface SmokeResult {
  id: string;
  reason?: string;
  status: "passed" | "failed" | "skipped";
}

const SECRET_PATTERNS = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]"],
  [/([?&](?:token|secret|key|code)=)[^&\s]+/gi, "$1[redacted]"],
  [/(authorization|cookie|set-cookie):\s*[^\r\n]+/gi, "$1: [redacted]"],
] as const;

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
  }
  return manifest;
}

export function resolveBrowserSmokeCases(
  manifest: BrowserSmokeManifest,
  env: Record<string, string | undefined>,
  selectedProfiles?: Set<string>
) {
  return manifest.cases.map((smokeCase) => {
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

async function runAgentBrowser(session: string, args: string[]) {
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
}

async function preserveFailureContext(
  artifactDir: string,
  session: string,
  smokeCase: BrowserSmokeCase,
  reason: string
) {
  const screenshotPath = join(artifactDir, `${smokeCase.id}.png`);
  await runAgentBrowser(session, ["screenshot", screenshotPath]);
  const [url, consoleOutput, networkOutput] = await Promise.all([
    runAgentBrowser(session, ["get", "url"]),
    runAgentBrowser(session, ["console"]),
    runAgentBrowser(session, ["network", "requests"]),
  ]);
  const evidence = redactBrowserEvidence(
    JSON.stringify(
      {
        console: consoleOutput.output,
        network: networkOutput.output,
        reason,
        role: smokeCase.profile,
        route: url.output,
      },
      null,
      2
    )
  );
  await writeFile(join(artifactDir, `${smokeCase.id}.json`), `${evidence}\n`);
}

async function runCase(
  baseUrl: string,
  artifactDir: string,
  manifest: BrowserSmokeManifest,
  resolved: Extract<ReturnType<typeof resolveBrowserSmokeCases>[number], { status: "ready" }>
): Promise<SmokeResult> {
  const { path, session, smokeCase } = resolved;
  const viewport = manifest.viewports[smokeCase.viewport];
  const target = new URL(path, baseUrl).toString();
  const steps = [
    ["set", "viewport", String(viewport.width), String(viewport.height)],
    ["open", target],
    ["wait", "--load", "networkidle"],
  ];
  for (const args of steps) {
    // biome-ignore lint/performance/noAwaitInLoops: browser navigation steps are order-dependent
    const step = await runAgentBrowser(session, args);
    if (step.exitCode !== 0) {
      await preserveFailureContext(artifactDir, session, smokeCase, step.output);
      return { id: smokeCase.id, reason: step.output, status: "failed" };
    }
  }

  const [url, page] = await Promise.all([
    runAgentBrowser(session, ["get", "url"]),
    runAgentBrowser(session, ["read"]),
  ]);
  const actualPath = new URL(url.output.trim()).pathname;
  const textMatches = smokeCase.expectText ? page.output.includes(smokeCase.expectText) : true;
  const anyTextMatches = smokeCase.expectAnyText?.length
    ? smokeCase.expectAnyText.some((text) => page.output.includes(text))
    : true;
  const pathMatches = smokeCase.expectPath ? actualPath === smokeCase.expectPath : true;
  if (!(textMatches && anyTextMatches && pathMatches)) {
    const reason = `assertion failed at ${actualPath}`;
    await preserveFailureContext(artifactDir, session, smokeCase, reason);
    return { id: smokeCase.id, reason, status: "failed" };
  }
  return { id: smokeCase.id, status: "passed" };
}

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

export async function runBrowserSmoke() {
  const manifestPath = option("manifest") ?? "config/browser-smoke.json";
  const artifactOption = option("artifacts") ?? ".scratch/browser-smoke";
  const artifactDir = isAbsolute(artifactOption)
    ? artifactOption
    : join(process.cwd(), artifactOption);
  const baseUrl =
    option("base-url") ?? process.env.BROWSER_SMOKE_BASE_URL ?? "http://localhost:3000";
  const selectedProfiles = option("profiles")
    ? new Set(option("profiles")?.split(",").filter(Boolean))
    : undefined;
  const strict = process.argv.includes("--strict");
  const manifest = validateBrowserSmokeManifest(
    JSON.parse(await readFile(manifestPath, "utf8")) as BrowserSmokeManifest
  );
  await mkdir(artifactDir, { recursive: true });

  const resolved = resolveBrowserSmokeCases(manifest, process.env, selectedProfiles);
  const results: SmokeResult[] = [];
  for (const item of resolved) {
    if (item.status === "skipped") {
      results.push({ id: item.smokeCase.id, reason: item.reason, status: "skipped" });
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: cases sharing a role session must not race
    results.push(await runCase(baseUrl, artifactDir, manifest, item));
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
  if (failed || (strict && skipped)) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await runBrowserSmoke();
}
