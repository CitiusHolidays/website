import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isRuntimeObject, isRuntimeString } from "../../src/lib/runtimeValues";
import { formatCliHelp, parseCliArguments } from "../commands/cli";
import type { JsonValue } from "../lib/jsonValue";

interface DeadcodeBaseline {
  configSha256: string;
  counts: Record<string, number>;
  fingerprints: string[];
  generatedAt: string;
  knipVersion: string;
  schemaVersion: 1;
}

const DEADCODE_CLI = {
  command: "bun run deadcode:ratchet --",
  description:
    "Compare the pinned Knip report with the reviewed local allowlist. Performs no fixes or source deletion.",
  options: [
    {
      description: "Create or shrink the reviewed local allowlist; never accepts new findings",
      name: "write-baseline",
      type: "boolean" as const,
    },
  ],
};

function stableJson(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && isRuntimeObject(value)) {
    return `{${Object.entries(value)
      .filter(([key]) => !["col", "line", "pos"].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintsFromKnipReport(report: JsonValue) {
  if (!(report && isRuntimeObject(report) && Array.isArray(report.issues))) {
    throw new Error("Knip report must contain an issues array");
  }

  const fingerprints: string[] = [];
  for (const row of report.issues) {
    if (!(row && isRuntimeObject(row) && isRuntimeString(row.file))) {
      throw new Error("Knip report contains a malformed issue row");
    }
    for (const [category, findings] of Object.entries(row)) {
      if (category === "file") {
        continue;
      }
      if (!Array.isArray(findings)) {
        throw new Error(`Knip issue category ${category} must be an array`);
      }
      for (const finding of findings) {
        fingerprints.push(`${category}|${row.file}|${stableJson(finding)}`);
      }
    }
  }
  return fingerprints.sort((left, right) => left.localeCompare(right));
}

export function summarizeFingerprints(fingerprints: readonly string[]) {
  const counts: Record<string, number> = {};
  for (const fingerprint of fingerprints) {
    const category = fingerprint.slice(0, fingerprint.indexOf("|"));
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

export function compareDeadcodeInventory(baseline: readonly string[], current: readonly string[]) {
  const remaining = new Map<string, number>();
  for (const fingerprint of baseline) {
    remaining.set(fingerprint, (remaining.get(fingerprint) ?? 0) + 1);
  }
  const newIssues: string[] = [];
  for (const fingerprint of current) {
    const allowed = remaining.get(fingerprint) ?? 0;
    if (allowed === 0) {
      newIssues.push(fingerprint);
    } else {
      remaining.set(fingerprint, allowed - 1);
    }
  }
  return { newIssues };
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readBaseline(path: string): DeadcodeBaseline | null {
  if (!existsSync(path)) {
    return null;
  }
  // SAFETY: the owned baseline is validated for schema version and every consumed collection below.
  const value = JSON.parse(readFileSync(path, "utf8")) as DeadcodeBaseline;
  if (
    value.schemaVersion !== 1 ||
    !Array.isArray(value.fingerprints) ||
    !isRuntimeString(value.configSha256)
  ) {
    throw new Error("Dead-code baseline is malformed");
  }
  return value;
}

function runKnip(root: string) {
  const entry = resolve(root, "node_modules/knip/bin/knip.js");
  if (!existsSync(entry)) {
    throw new Error("Pinned Knip is not installed; run bun install --frozen-lockfile");
  }
  const result = spawnSync(
    process.execPath,
    [entry, "--config", "knip.jsonc", "--reporter", "json", "--no-exit-code", "--no-progress"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: false }
  );
  if (result.status !== 0) {
    throw new Error(`Knip inventory failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return fingerprintsFromKnipReport(JSON.parse(result.stdout));
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), DEADCODE_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(DEADCODE_CLI));
    } else {
      const root = resolve(import.meta.dir, "../..");
      const baselinePath = resolve(root, "config/release/deadcode-baseline.json");
      const configPath = resolve(root, "knip.jsonc");
      // SAFETY: only the optional package fields declared here are read from the repository-owned package.json.
      const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
        devDependencies: Partial<Record<string, string>>;
      };
      const fingerprints = runKnip(root);
      const baseline = readBaseline(baselinePath);
      const baselineFingerprints = baseline ? baseline.fingerprints : [];
      const comparison = compareDeadcodeInventory(baselineFingerprints, fingerprints);

      if (parsed.values["write-baseline"]) {
        if (baseline && comparison.newIssues.length > 0) {
          throw new Error(
            `Refusing to widen the dead-code allowlist by ${comparison.newIssues.length} finding(s)`
          );
        }
        const next: DeadcodeBaseline = {
          configSha256: sha256(configPath),
          counts: summarizeFingerprints(fingerprints),
          fingerprints,
          generatedAt: new Date().toISOString(),
          knipVersion: packageJson.devDependencies.knip ?? "missing",
          schemaVersion: 1,
        };
        writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
        console.log(`Dead-code baseline written: ${fingerprints.length} reviewed finding(s)`);
      } else {
        if (!baseline) {
          throw new Error(
            "Dead-code baseline is missing; review the report before initializing it"
          );
        }
        if (baseline.configSha256 !== sha256(configPath)) {
          throw new Error(
            "knip.jsonc changed; review the inventory and update the baseline intentionally"
          );
        }
        if (comparison.newIssues.length > 0) {
          throw new Error(
            `Dead-code inventory added ${comparison.newIssues.length} finding(s):\n${comparison.newIssues.slice(0, 20).join("\n")}`
          );
        }
        console.log(
          `Dead-code ratchet passed: ${fingerprints.length}/${baseline.fingerprints.length} reviewed finding(s) remain`
        );
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Dead-code inventory failed");
    process.exitCode = 1;
  }
}
