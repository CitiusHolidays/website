import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export interface TargetNeutralQualityGate {
  args: string[];
  command: string;
  cwd?: "citius-blog";
  id: string;
  label: string;
}

export const PINNED_BUN_VERSION = "1.3.14";

export const TARGET_NEUTRAL_QUALITY_GATES: readonly TargetNeutralQualityGate[] = [
  { args: ["run", "diff:check"], command: "bun", id: "diff-hygiene", label: "Diff hygiene" },
  { args: ["run", "lint:all"], command: "bun", id: "lint-all", label: "Zero-warning lint" },
  { args: ["run", "typecheck"], command: "bun", id: "app-types", label: "Application types" },
  {
    args: ["run", "convex:typecheck"],
    command: "bun",
    id: "convex-types",
    label: "Convex types",
  },
  { args: ["run", "test"], command: "bun", id: "all-tests", label: "Complete test suite" },
  {
    args: ["run", "coverage:check"],
    command: "bun",
    id: "coverage",
    label: "High-risk coverage contract",
  },
  { args: ["run", "assets:check"], command: "bun", id: "assets", label: "Public assets" },
  {
    args: ["run", "automation:check", "--", "git", "diff", "--check"],
    command: "bun",
    id: "automation",
    label: "Automation policy",
  },
  {
    args: ["run", "ai:config-check"],
    command: "bun",
    id: "ai-config",
    label: "AI runtime config",
  },
  {
    args: ["audit", "--audit-level=high"],
    command: "bun",
    id: "root-audit",
    label: "Root dependency audit",
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
  {
    args: ["run", "performance:check"],
    command: "bun",
    id: "performance",
    label: "Performance budgets",
  },
] as const;

export function assertPinnedBunVersion(version: string | undefined) {
  if (version !== PINNED_BUN_VERSION) {
    throw new Error(
      `Target-neutral quality requires Bun ${PINNED_BUN_VERSION}; received ${version || "unknown"}.`
    );
  }
}

export function runTargetNeutralQuality(
  runGate: (gate: TargetNeutralQualityGate) => number,
  write: (line: string) => void = console.log
) {
  for (const gate of TARGET_NEUTRAL_QUALITY_GATES) {
    write(`Running ${gate.label}...`);
    if (runGate(gate) !== 0) {
      write(`Failed: ${gate.label}`);
      return { failedGate: gate.id, ok: false };
    }
    write(`Passed: ${gate.label}`);
  }
  write("All shared target-neutral quality gates passed.");
  return { failedGate: null, ok: true };
}

if (import.meta.main) {
  try {
    assertPinnedBunVersion(process.versions.bun);
    const root = resolve(import.meta.dir, "../..");
    const result = runTargetNeutralQuality((gate) =>
      spawnSync(gate.command, gate.args, {
        cwd: gate.cwd ? resolve(root, gate.cwd) : root,
        stdio: "inherit",
      }).status === 0
        ? 0
        : 1
    );
    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Target-neutral quality failed");
    process.exitCode = 1;
  }
}
