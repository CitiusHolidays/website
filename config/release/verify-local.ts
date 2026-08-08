import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface LocalReleaseGate {
  args: string[];
  command: string;
  cwd?: "citius-blog";
  id: string;
  label: string;
}

export const LOCAL_RELEASE_GATES: readonly LocalReleaseGate[] = [
  { args: ["run", "diff:check"], command: "bun", id: "diff-hygiene", label: "Diff hygiene" },
  { args: ["run", "check"], command: "bun", id: "project-check", label: "Lint and tests" },
  { args: ["run", "typecheck"], command: "bun", id: "app-types", label: "Application types" },
  { args: ["run", "convex:typecheck"], command: "bun", id: "convex-types", label: "Convex types" },
  { args: ["run", "assets:check"], command: "bun", id: "assets", label: "Public assets" },
  {
    args: ["run", "performance:check"],
    command: "bun",
    id: "performance",
    label: "Performance budgets",
  },
  {
    args: ["run", "automation:check", "--", "git", "diff", "--check"],
    command: "bun",
    id: "automation",
    label: "Automation policy",
  },
  { args: ["run", "ai:config-check"], command: "bun", id: "ai-config", label: "AI runtime config" },
  {
    args: ["audit", "--audit-level=high"],
    command: "bun",
    id: "root-audit",
    label: "Root dependency audit",
  },
  {
    args: ["install", "--frozen-lockfile"],
    command: "bun",
    cwd: "citius-blog",
    id: "studio-install",
    label: "Studio frozen install",
  },
  {
    args: ["run", "build"],
    command: "bun",
    cwd: "citius-blog",
    id: "studio-build",
    label: "Studio static build",
  },
  {
    args: ["audit", "--audit-level=high"],
    command: "bun",
    cwd: "citius-blog",
    id: "studio-audit",
    label: "Studio dependency audit",
  },
] as const;

interface VerificationOptions {
  commit: string;
  now: Date;
  runGate: (gate: LocalReleaseGate) => number;
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

export function runLocalReleaseVerification({ commit, now, runGate, write }: VerificationOptions) {
  write("Local release verification");
  write(`Commit: ${commit}`);
  write(`Verified at: ${now.toISOString()}`);
  write("Scope: Local proof only; this is not deployment or production proof.");

  for (const gate of LOCAL_RELEASE_GATES) {
    write(`Running ${gate.label}...`);
    if (runGate(gate) !== 0) {
      write(`Failed: ${gate.label}`);
      return { failedGate: gate.id, ok: false };
    }
  }

  write("All target-neutral local release gates passed.");
  return { failedGate: null, ok: true };
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  const gitOptions = { cwd: root, encoding: "utf8" as const, maxBuffer: 32 * 1024 * 1024 };
  const commitResult = spawnSync("git", ["rev-parse", "HEAD"], {
    ...gitOptions,
  });
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
    commitResult.status === 0 &&
    statusResult.status === 0 &&
    diffResult.status === 0 &&
    untrackedResult.status === 0
  ) {
    const untrackedFiles = untrackedResult.stdout
      .split("\0")
      .filter(Boolean)
      .map((path) => [path, readFileSync(resolve(root, path))] as const);
    const result = runLocalReleaseVerification({
      commit: resolveVerificationRevision(commitResult.stdout.trim(), {
        status: statusResult.stdout,
        trackedDiff: diffResult.stdout,
        untrackedFiles,
      }),
      now: new Date(),
      runGate: (gate) =>
        spawnSync(gate.command, gate.args, {
          cwd: gate.cwd ? resolve(root, gate.cwd) : root,
          stdio: "inherit",
        }).status ?? 1,
      write: console.log,
    });
    if (!result.ok) {
      process.exitCode = 1;
    }
  } else {
    console.error("Could not resolve the Git revision and worktree fingerprint for verification.");
    process.exitCode = 1;
  }
}
