import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

interface BiomeDiagnostic {
  category?: string;
  severity: string;
}

interface BiomeReport {
  diagnostics: BiomeDiagnostic[];
}

interface LintBaseline {
  diagnostics: Record<string, Record<string, number>>;
  generatedAt: string;
  schemaVersion: number;
  scope: string;
  tool: string;
  totals: { errors: number; warnings: number };
}

const ROOT = resolve(import.meta.dir, "../..");
const BASELINE_PATH = join(ROOT, "config/release/lint-baseline.json");
const BIOME_PATH = join(ROOT, "node_modules/.bin/biome");
const writeBaseline = process.argv.includes("--write-baseline");
const familyArgument = process.argv.find((argument) => argument.startsWith("--family="));
const family = familyArgument?.slice("--family=".length) ?? "lint/";

function countDiagnostics(report: BiomeReport) {
  const counts: Record<string, Record<string, number>> = {};
  for (const diagnostic of report.diagnostics) {
    if (!diagnostic.category?.startsWith("lint/")) {
      continue;
    }
    counts[diagnostic.severity] ??= {};
    counts[diagnostic.severity][diagnostic.category] =
      (counts[diagnostic.severity][diagnostic.category] ?? 0) + 1;
  }
  return counts;
}

function diagnosticTotals(diagnostics: Record<string, Record<string, number>>) {
  const total = (severity: string) =>
    Object.values(diagnostics[severity] ?? {}).reduce((sum, count) => sum + count, 0);
  return { errors: total("error"), warnings: total("warning") };
}

function runBiome(): Record<string, Record<string, number>> {
  const reportDirectory = mkdtempSync(join(tmpdir(), "citius-lint-ratchet-"));
  const reportPath = join(reportDirectory, "biome.json");
  const result = spawnSync(
    BIOME_PATH,
    [
      "check",
      ".",
      "--reporter=json",
      `--reporter-file=${reportPath}`,
      "--max-diagnostics=none",
      "--formatter-enabled=false",
      "--assist-enabled=false",
    ],
    { cwd: ROOT, encoding: "utf8" }
  );

  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as BiomeReport;
    return countDiagnostics(report);
  } catch (error) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    throw new Error(`Biome did not produce a readable report.\n${stderr}\n${stdout}`, {
      cause: error,
    });
  } finally {
    rmSync(reportDirectory, { force: true, recursive: true });
  }
}

function compareDiagnostics(
  baselineDiagnostics: Record<string, Record<string, number>>,
  current: Record<string, Record<string, number>>
) {
  const increases: string[] = [];
  const reductions: string[] = [];
  const severities = new Set([...Object.keys(baselineDiagnostics), ...Object.keys(current)]);

  for (const severity of severities) {
    const categories = new Set([
      ...Object.keys(baselineDiagnostics[severity] ?? {}),
      ...Object.keys(current[severity] ?? {}),
    ]);
    for (const category of categories) {
      const allowed = baselineDiagnostics[severity]?.[category] ?? 0;
      const found = current[severity]?.[category] ?? 0;
      const message = `${severity} ${category}: ${found}/${allowed}`;
      if (found > allowed) {
        increases.push(message);
      } else if (found < allowed && category.startsWith(family)) {
        reductions.push(message);
      }
    }
  }

  return { increases, reductions };
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as LintBaseline;
const currentDiagnostics = runBiome();
const { increases, reductions } = compareDiagnostics(baseline.diagnostics, currentDiagnostics);
const totals = diagnosticTotals(currentDiagnostics);

if (reductions.length > 0) {
  console.log(`Lint burn-down (${family}):`);
  for (const reduction of reductions.sort((left, right) => left.localeCompare(right))) {
    console.log(`  ${reduction}`);
  }
}

if (writeBaseline && totals.errors === 0 && totals.warnings <= baseline.totals.warnings) {
  const nextBaseline: LintBaseline = {
    ...baseline,
    diagnostics: currentDiagnostics,
    generatedAt: new Date().toISOString(),
    totals,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(nextBaseline, null, 2)}\n`);
  console.log(
    `Updated ${BASELINE_PATH}: raw lint errors are zero and total warnings did not increase.`
  );
} else if (increases.length > 0) {
  console.error("Lint ratchet failed; these rule families exceed the reviewed baseline:");
  for (const increase of increases.sort((left, right) => left.localeCompare(right))) {
    console.error(`  ${increase}`);
  }
  process.exitCode = 1;
} else if (writeBaseline) {
  const nextBaseline: LintBaseline = {
    ...baseline,
    diagnostics: currentDiagnostics,
    generatedAt: new Date().toISOString(),
    totals,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(nextBaseline, null, 2)}\n`);
  console.log(`Updated ${BASELINE_PATH} after a non-increasing lint run.`);
} else {
  console.log(
    `Lint ratchet passed: ${totals.errors} errors and ${totals.warnings} warnings do not exceed the per-rule baseline.`
  );
}
