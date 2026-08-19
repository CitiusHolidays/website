import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { isRuntimeString } from "../../src/lib/runtimeValues";
import { formatCliHelp, parseCliArguments } from "../commands/cli";
import {
  createLocalReleaseEvidence,
  summarizeReleaseEvidence,
  writeReleaseEvidence,
} from "./release-evidence";
import { assertPinnedBunVersion } from "./run-target-neutral-quality";

export interface LocalReleaseGate {
  args: string[];
  command: string;
  id: string;
  label: string;
}

export const LOCAL_RELEASE_GATES: readonly LocalReleaseGate[] = [
  {
    args: ["install", "--frozen-lockfile"],
    command: "bun",
    id: "root-install",
    label: "Root frozen install",
  },
  {
    args: ["run", "quality:target-neutral"],
    command: "bun",
    id: "shared-quality",
    label: "Shared required quality suite",
  },
] as const;

const VERIFY_LOCAL_CLI = {
  command: "bun run verify:local --",
  description:
    "Run the required target-neutral local quality gate. The unfiltered command is the only local release proof.",
  options: [
    {
      description: "Write revision-bound JSON to .scratch/release-evidence, auto, or - for stdout",
      name: "evidence",
      type: "string",
    },
    { name: "list", type: "boolean" },
    {
      description: "Write schema-versioned timings to .scratch/dx-metrics or use - for stdout",
      name: "metrics",
      type: "string",
    },
  ],
} as const;

export interface LocalVerificationGateMetric {
  durationMs: number;
  id: string;
  label: string;
  outcome: "failed" | "passed" | "skipped";
  reason?: string;
}

export interface LocalVerificationMetrics {
  failedGate: string | null;
  gates: LocalVerificationGateMetric[];
  outcome: "failed" | "passed";
  revision: string;
  schemaVersion: 1;
  startedAt: string;
  totalDurationMs: number;
}

interface VerificationOptions {
  commit: string;
  monotonicNow?: () => number;
  now: Date;
  runGate: (gate: LocalReleaseGate) => number;
  startedAtMonotonic?: number;
  write: (line: string) => void;
}

interface WorktreeEvidence {
  status: string;
  trackedDiff: string;
  untrackedFiles: [path: string, content: string | Uint8Array][];
}

export function resolveVerificationRevision(head: string, evidence: WorktreeEvidence) {
  if (!evidence.status.trim()) {
    return head;
  }
  const hash = createHash("sha256");
  hash.update(head);
  hash.update("\0status\0");
  hash.update(evidence.status);
  hash.update("\0tracked\0");
  hash.update(evidence.trackedDiff);
  for (const [path, content] of [...evidence.untrackedFiles].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    hash.update("\0untracked\0");
    hash.update(path);
    hash.update("\0");
    hash.update(content);
  }
  return `${head}+dirty.${hash.digest("hex").slice(0, 12)}`;
}

export function resolveWorkspaceRevision(root: string) {
  const gitOptions = {
    cwd: root,
    encoding: "utf8" as const,
    maxBuffer: 32 * 1024 * 1024,
  };
  const commitResult = spawnSync("git", ["rev-parse", "HEAD"], gitOptions);
  const statusResult = spawnSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    gitOptions
  );
  const diffResult = spawnSync("git", ["diff", "--binary", "HEAD", "--"], gitOptions);
  const untrackedResult = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    gitOptions
  );
  if (
    commitResult.status !== 0 ||
    statusResult.status !== 0 ||
    diffResult.status !== 0 ||
    untrackedResult.status !== 0
  ) {
    throw new Error(
      "Could not resolve the Git revision and worktree fingerprint for verification."
    );
  }
  const untrackedFiles = untrackedResult.stdout
    .split("\0")
    .filter(Boolean)
    .map((path) => [path, readFileSync(resolve(root, path))] as const);
  return resolveVerificationRevision(commitResult.stdout.trim(), {
    status: statusResult.stdout,
    trackedDiff: diffResult.stdout,
    untrackedFiles,
  });
}

export function runLocalReleaseVerification({
  commit,
  monotonicNow = () => performance.now(),
  now,
  runGate,
  startedAtMonotonic,
  write,
}: VerificationOptions) {
  const started = startedAtMonotonic ?? monotonicNow();
  const metrics: LocalVerificationGateMetric[] = [];
  write("Local release verification");
  write(`Commit: ${commit}`);
  write(`Verified at: ${now.toISOString()}`);
  write("Scope: Local proof only; this is not deployment or production proof.");

  for (const [index, gate] of LOCAL_RELEASE_GATES.entries()) {
    write(`Running ${gate.label}...`);
    const gateStarted = monotonicNow();
    const status = runGate(gate);
    const durationMs = Math.max(0, monotonicNow() - gateStarted);
    if (status !== 0) {
      metrics.push({ durationMs, id: gate.id, label: gate.label, outcome: "failed" });
      for (const skipped of LOCAL_RELEASE_GATES.slice(index + 1)) {
        metrics.push({
          durationMs: 0,
          id: skipped.id,
          label: skipped.label,
          outcome: "skipped",
          reason: `not attempted after ${gate.id} failed`,
        });
      }
      write(`Failed: ${gate.label}`);
      write(`Duration: ${durationMs.toFixed(1)} ms`);
      const report: LocalVerificationMetrics = {
        failedGate: gate.id,
        gates: metrics,
        outcome: "failed",
        revision: commit,
        schemaVersion: 1,
        startedAt: now.toISOString(),
        totalDurationMs: Math.max(0, monotonicNow() - started),
      };
      write(`Total: ${report.totalDurationMs.toFixed(1)} ms`);
      return { failedGate: gate.id, metrics: report, ok: false };
    }
    metrics.push({ durationMs, id: gate.id, label: gate.label, outcome: "passed" });
    write(`Passed: ${gate.label} (${durationMs.toFixed(1)} ms)`);
  }

  const report: LocalVerificationMetrics = {
    failedGate: null,
    gates: metrics,
    outcome: "passed",
    revision: commit,
    schemaVersion: 1,
    startedAt: now.toISOString(),
    totalDurationMs: Math.max(0, monotonicNow() - started),
  };
  write("All target-neutral local release gates passed.");
  write(`Total: ${report.totalDurationMs.toFixed(1)} ms`);
  return { failedGate: null, metrics: report, ok: true };
}

export function writeVerificationMetrics(
  root: string,
  option: string,
  metrics: LocalVerificationMetrics,
  write: (line: string) => void = console.log
) {
  const serialized = `${JSON.stringify(metrics, null, 2)}\n`;
  if (option === "-") {
    write(serialized.trimEnd());
    return;
  }
  const outputPath = resolve(root, option);
  const scratchRoot = resolve(root, ".scratch/dx-metrics");
  const relativeOutput = relative(scratchRoot, outputPath);
  if (!relativeOutput || relativeOutput.startsWith("..") || resolve(outputPath) === scratchRoot) {
    throw new Error("--metrics must name a file under .scratch/dx-metrics or use - for stdout");
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized);
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), VERIFY_LOCAL_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(VERIFY_LOCAL_CLI));
    } else if (parsed.values.list) {
      console.log("Target-neutral local gate list (planning output only; not release evidence):");
      for (const gate of LOCAL_RELEASE_GATES) {
        console.log(`${gate.id}: ${gate.label}`);
      }
    } else {
      assertPinnedBunVersion(process.versions.bun);
      const root = resolve(import.meta.dir, "../..");
      const verificationStartedAt = performance.now();
      try {
        const result = runLocalReleaseVerification({
          commit: resolveWorkspaceRevision(root),
          now: new Date(),
          runGate: (gate) =>
            spawnSync(gate.command, gate.args, {
              cwd: root,
              stdio: "inherit",
            }).status ?? 1,
          startedAtMonotonic: verificationStartedAt,
          write: console.log,
        });
        if (isRuntimeString(parsed.values.metrics)) {
          writeVerificationMetrics(root, parsed.values.metrics, result.metrics);
        }
        if (isRuntimeString(parsed.values.evidence)) {
          const evidence = createLocalReleaseEvidence(result.metrics);
          const output = writeReleaseEvidence(root, parsed.values.evidence, evidence);
          const summary = summarizeReleaseEvidence(evidence);
          if (output) {
            console.log(`Wrote release evidence to ${relative(root, output)}`);
            console.log(summary);
          } else {
            console.error(summary);
          }
        }
        if (!result.ok) {
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Could not resolve revision");
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Local verification failed");
    process.exitCode = 1;
  }
}
