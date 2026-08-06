import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface BiomeDiagnostic {
  category?: string;
  severity: string;
}

export interface BiomeReport {
  diagnostics: BiomeDiagnostic[];
}

export interface DiagnosticCounts {
  [severity: string]: Record<string, number>;
}

export interface LintBaseline {
  diagnostics: DiagnosticCounts;
  generatedAt: string;
  schemaVersion: number;
  scope: string;
  tool: string;
  totals: { errors: number; warnings: number };
}

interface BiomeProcessResult {
  error?: Error;
  signal?: string | null;
  status: number | null;
}

const ROOT = resolve(import.meta.dir, "../..");
const BASELINE_PATH = join(ROOT, "config/release/lint-baseline.json");
const BIOME_PATH = join(ROOT, "node_modules/.bin/biome");
const writeBaseline = process.argv.includes("--write-baseline");
const familyArgument = process.argv.find((argument) => argument.startsWith("--family="));
const family = familyArgument?.slice("--family=".length) ?? "lint/";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function countDiagnostics(report: BiomeReport): DiagnosticCounts {
  const counts: DiagnosticCounts = {};
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

export function diagnosticTotals(diagnostics: DiagnosticCounts) {
  const total = (severity: string) =>
    Object.values(diagnostics[severity] ?? {}).reduce((sum, count) => sum + count, 0);
  return { errors: total("error"), warnings: total("warning") };
}

export function parseBiomeReport(serializedReport: string): BiomeReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedReport);
  } catch (error) {
    throw new Error("Biome report is not valid JSON", { cause: error });
  }
  if (!(isRecord(parsed) && Array.isArray(parsed.diagnostics))) {
    throw new Error("Biome report is missing a diagnostics array");
  }
  for (const diagnostic of parsed.diagnostics) {
    if (!isRecord(diagnostic) || typeof diagnostic.severity !== "string") {
      throw new Error("Biome report contains a malformed diagnostic");
    }
    if (diagnostic.category !== undefined && typeof diagnostic.category !== "string") {
      throw new Error("Biome report contains a malformed diagnostic category");
    }
  }
  return parsed as unknown as BiomeReport;
}

export function parseBiomeResult(result: BiomeProcessResult, serializedReport: string) {
  if (result.error) {
    throw new Error("Biome failed to start", { cause: result.error });
  }
  if (result.signal) {
    throw new Error(`Biome was terminated by ${result.signal}`);
  }
  if (result.status === null) {
    throw new Error("Biome terminated without an exit status");
  }
  // Biome uses status 1 for a valid report containing diagnostics. Any other non-zero status (or
  // status 1 without diagnostics) is a runner/configuration failure and must not be interpreted as
  // a lint report.
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`Biome exited unexpectedly with status ${result.status}`);
  }
  const report = parseBiomeReport(serializedReport);
  if (result.status === 1 && report.diagnostics.length === 0) {
    throw new Error("Biome exited with status 1 but did not report diagnostics");
  }
  return countDiagnostics(report);
}

export function parseLintBaseline(value: unknown): LintBaseline {
  if (!isRecord(value)) {
    throw new Error("Lint baseline must be an object");
  }
  if (value.schemaVersion !== 1 || typeof value.generatedAt !== "string") {
    throw new Error("Lint baseline has an unsupported schema or generatedAt value");
  }
  if (typeof value.scope !== "string" || typeof value.tool !== "string") {
    throw new Error("Lint baseline requires scope and tool metadata");
  }

  const diagnosticsValue = value.diagnostics;
  if (!isRecord(diagnosticsValue)) {
    throw new Error("Lint baseline diagnostics must be an object");
  }
  const diagnostics: DiagnosticCounts = {};
  for (const [severity, categoriesValue] of Object.entries(diagnosticsValue)) {
    if (!isRecord(categoriesValue)) {
      throw new Error(`Lint baseline ${severity} diagnostics must be an object`);
    }
    diagnostics[severity] = {};
    for (const [category, count] of Object.entries(categoriesValue)) {
      if (!isNonNegativeInteger(count)) {
        throw new Error(`Lint baseline count for ${severity} ${category} is invalid`);
      }
      diagnostics[severity][category] = count;
    }
  }

  if (!isRecord(value.totals)) {
    throw new Error("Lint baseline totals must be an object");
  }
  const { errors, warnings } = value.totals;
  if (!(isNonNegativeInteger(errors) && isNonNegativeInteger(warnings))) {
    throw new Error("Lint baseline totals must be non-negative integers");
  }
  const computedTotals = diagnosticTotals(diagnostics);
  if (computedTotals.errors !== errors || computedTotals.warnings !== warnings) {
    throw new Error("Lint baseline totals do not match its diagnostic counts");
  }

  return {
    diagnostics,
    generatedAt: value.generatedAt,
    schemaVersion: value.schemaVersion,
    scope: value.scope,
    tool: value.tool,
    totals: { errors, warnings },
  };
}

export function compareDiagnostics(
  baselineDiagnostics: DiagnosticCounts,
  current: DiagnosticCounts,
  familyName = "lint/"
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
      } else if (found < allowed && category.startsWith(familyName)) {
        reductions.push(message);
      }
    }
  }

  return { increases, reductions };
}

export function canWriteBaseline({
  baseline,
  current,
  increases,
}: {
  baseline: LintBaseline;
  current: DiagnosticCounts;
  increases: string[];
}) {
  const totals = diagnosticTotals(current);
  return (
    increases.length === 0 && totals.errors === 0 && totals.warnings <= baseline.totals.warnings
  );
}

function runBiome(): DiagnosticCounts {
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
    const report = readFileSync(reportPath, "utf8");
    return parseBiomeResult(result, report);
  } catch (error) {
    const stderr = result.stderr?.trim() ?? "";
    const stdout = result.stdout?.trim() ?? "";
    throw new Error(`Biome did not produce a valid report.\n${stderr}\n${stdout}`, {
      cause: error,
    });
  } finally {
    rmSync(reportDirectory, { force: true, recursive: true });
  }
}

function loadBaseline() {
  let serializedBaseline: string;
  try {
    serializedBaseline = readFileSync(BASELINE_PATH, "utf8");
  } catch (error) {
    throw new Error(`Unable to read lint baseline at ${BASELINE_PATH}`, { cause: error });
  }
  try {
    return parseLintBaseline(JSON.parse(serializedBaseline) as unknown);
  } catch (error) {
    throw new Error(`Lint baseline is malformed at ${BASELINE_PATH}`, { cause: error });
  }
}

function writeBaselineAtomically(nextBaseline: LintBaseline) {
  const directory = mkdtempSync(join(dirname(BASELINE_PATH), ".lint-ratchet-"));
  const temporaryPath = join(directory, "lint-baseline.json");
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(nextBaseline, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    renameSync(temporaryPath, BASELINE_PATH);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function printError(error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function loadBaselineSafely() {
  try {
    return loadBaseline();
  } catch (error) {
    printError(error);
    return null;
  }
}

function runBiomeSafely() {
  try {
    return runBiome();
  } catch (error) {
    printError(error);
    return null;
  }
}

function printReductions(reductions: string[]) {
  if (reductions.length === 0) {
    return;
  }
  console.log(`Lint burn-down (${family}):`);
  for (const reduction of reductions.sort((left, right) => left.localeCompare(right))) {
    console.log(`  ${reduction}`);
  }
}

function refuseBaselineWrite(increases: string[]) {
  console.error(
    "Lint baseline update refused; the current report has errors, exceeds a reviewed budget, or introduces a new rule family."
  );
  for (const increase of increases.sort((left, right) => left.localeCompare(right))) {
    console.error(`  ${increase}`);
  }
  process.exitCode = 1;
}

function updateBaseline(
  baseline: LintBaseline,
  currentDiagnostics: DiagnosticCounts,
  totals: { errors: number; warnings: number }
) {
  const nextBaseline: LintBaseline = {
    ...baseline,
    diagnostics: currentDiagnostics,
    generatedAt: new Date().toISOString(),
    totals,
  };
  try {
    writeBaselineAtomically(nextBaseline);
  } catch (error) {
    printError(error);
    return false;
  }
  console.log(
    `Updated ${BASELINE_PATH}: raw lint errors are zero and total warnings did not increase.`
  );
  return true;
}

function main() {
  const baseline = loadBaselineSafely();
  if (!baseline) {
    return;
  }
  const currentDiagnostics = runBiomeSafely();
  if (!currentDiagnostics) {
    return;
  }

  const { increases, reductions } = compareDiagnostics(
    baseline.diagnostics,
    currentDiagnostics,
    family
  );
  const totals = diagnosticTotals(currentDiagnostics);

  printReductions(reductions);

  if (writeBaseline) {
    if (!canWriteBaseline({ baseline, current: currentDiagnostics, increases })) {
      refuseBaselineWrite(increases);
      return;
    }
    updateBaseline(baseline, currentDiagnostics, totals);
    return;
  }

  if (increases.length > 0) {
    console.error("Lint ratchet failed; these rule families exceed the reviewed baseline:");
    for (const increase of increases.sort((left, right) => left.localeCompare(right))) {
      console.error(`  ${increase}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Lint ratchet passed: ${totals.errors} errors, ${totals.warnings} warnings; configured debt ceiling: ${baseline.totals.errors} errors, ${baseline.totals.warnings} warnings.`
  );
}

if (import.meta.main) {
  main();
}
