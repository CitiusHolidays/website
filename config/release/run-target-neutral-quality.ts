import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export interface TargetNeutralQualityGate {
  args: string[];
  command: string;
  id: string;
  label: string;
}

export const PINNED_BUN_VERSION = "1.4.0";

export const TARGET_NEUTRAL_QUALITY_GATES: readonly TargetNeutralQualityGate[] = [
  { args: ["run", "lint:all"], command: "bun", id: "lint-all", label: "Zero-warning lint" },
  {
    args: ["run", "docs:check"],
    command: "bun",
    id: "docs-contract",
    label: "Ownership-critical documentation contracts",
  },
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
  write("All required target-neutral quality gates passed.");
  return { failedGate: null, ok: true };
}

if (import.meta.main) {
  try {
    assertPinnedBunVersion(process.versions.bun);
    const root = resolve(import.meta.dir, "../..");
    const result = runTargetNeutralQuality((gate) =>
      spawnSync(gate.command, gate.args, {
        cwd: root,
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
