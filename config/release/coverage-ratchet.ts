import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isRuntimeString } from "../../src/lib/runtimeValues";
import { formatCliHelp, parseCliArguments } from "../commands/cli";

interface CoverageCounter {
  covered: number;
  found: number;
  percent: number;
}

export interface FileCoverage {
  functions: CoverageCounter;
  lines: CoverageCounter;
}

interface CoverageFilePolicy {
  functionsMinimumPercent: number;
  linesMinimumPercent: number;
  path: string;
  risk: string;
}

interface BranchContract {
  requiredTestNames: string[];
  risk: string;
  testFile: string;
}

interface CoveragePolicy {
  branchContracts?: BranchContract[];
  excludedPatterns?: string[];
  files: CoverageFilePolicy[];
  schemaVersion?: number;
}

const COVERAGE_CLI = {
  command: "bun run coverage:check --",
  description:
    "Run isolated Bun coverage and enforce the reviewed high-risk line/function/branch-contract ratchet.",
  options: [
    {
      description: "Evaluate an existing LCOV file instead of running tests",
      name: "lcov",
      type: "string",
    },
  ],
} as const;

function percent(covered: number, found: number, label: string) {
  if (found <= 0) {
    throw new Error(`${label} has a zero coverage denominator`);
  }
  if (covered < 0 || covered > found) {
    throw new Error(`${label} has invalid covered/found counts`);
  }
  return Number(((covered / found) * 100).toFixed(2));
}

export function parseLcov(value: string): Record<string, FileCoverage> {
  const result: Record<string, FileCoverage> = {};
  let path: string | null = null;
  let functionsFound: number | null = null;
  let functionsHit: number | null = null;
  let linesFound: number | null = null;
  let linesHit: number | null = null;

  const finishRecord = () => {
    if (!path) {
      if (
        functionsFound !== null ||
        functionsHit !== null ||
        linesFound !== null ||
        linesHit !== null
      ) {
        throw new Error("LCOV record contains counters before SF");
      }
      return;
    }
    if (
      functionsFound === null ||
      functionsHit === null ||
      linesFound === null ||
      linesHit === null
    ) {
      throw new Error(`LCOV record for ${path} is incomplete`);
    }
    result[path] = {
      functions: {
        covered: functionsHit,
        found: functionsFound,
        percent: percent(functionsHit, functionsFound, `${path} functions`),
      },
      lines: {
        covered: linesHit,
        found: linesFound,
        percent: percent(linesHit, linesFound, `${path} lines`),
      },
    };
    path = null;
    functionsFound = null;
    functionsHit = null;
    linesFound = null;
    linesHit = null;
  };

  for (const line of value.split("\n")) {
    if (line.startsWith("SF:")) {
      if (path) {
        throw new Error(`LCOV record for ${path} is missing end_of_record`);
      }
      path = line.slice(3);
    } else if (line.startsWith("FNF:")) {
      functionsFound = Number(line.slice(4));
    } else if (line.startsWith("FNH:")) {
      functionsHit = Number(line.slice(4));
    } else if (line.startsWith("LF:")) {
      linesFound = Number(line.slice(3));
    } else if (line.startsWith("LH:")) {
      linesHit = Number(line.slice(3));
    } else if (line === "end_of_record") {
      finishRecord();
    }
  }
  if (path || functionsFound !== null || linesFound !== null) {
    finishRecord();
  }
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right))
  );
}

export function compareCoverage(
  policy: Pick<CoveragePolicy, "files">,
  coverage: Record<string, FileCoverage>
) {
  const findings: string[] = [];
  for (const expected of policy.files) {
    const actual = coverage[expected.path];
    if (!actual) {
      findings.push(`${expected.risk}: ${expected.path} is missing from LCOV`);
      continue;
    }
    if (actual.lines.percent < expected.linesMinimumPercent) {
      findings.push(
        `${expected.risk}: ${expected.path} lines ${actual.lines.percent}% is below ${expected.linesMinimumPercent}%`
      );
    }
    if (actual.functions.percent < expected.functionsMinimumPercent) {
      findings.push(
        `${expected.risk}: ${expected.path} functions ${actual.functions.percent}% is below ${expected.functionsMinimumPercent}%`
      );
    }
  }
  return findings;
}

function readPolicy(path: string): CoveragePolicy {
  // SAFETY: validateCoveragePolicy immediately checks every field read from this owned JSON policy.
  const value = JSON.parse(readFileSync(path, "utf8")) as CoveragePolicy;
  if (
    value.schemaVersion !== 1 ||
    !Array.isArray(value.files) ||
    value.files.length === 0 ||
    !Array.isArray(value.branchContracts) ||
    value.branchContracts.length === 0 ||
    !Array.isArray(value.excludedPatterns)
  ) {
    throw new Error("Coverage policy is malformed");
  }
  return value;
}

function verifyBranchContracts(root: string, contracts: BranchContract[]) {
  const findings: string[] = [];
  let covered = 0;
  let total = 0;
  for (const contract of contracts) {
    const source = readFileSync(resolve(root, contract.testFile), "utf8");
    for (const name of contract.requiredTestNames) {
      total += 1;
      const doubleQuoted = `test(${JSON.stringify(name)}`;
      const singleQuoted = `test('${name.replaceAll("'", "\\'")}'`;
      if (source.includes(doubleQuoted) || source.includes(singleQuoted)) {
        covered += 1;
      } else {
        findings.push(
          `${contract.risk}: missing executed branch contract ${contract.testFile} :: ${name}`
        );
      }
    }
  }
  return { covered, findings, mode: "executed-contracts" as const, total };
}

function runCoverage(root: string, lcovPath: string) {
  const started = performance.now();
  const result = spawnSync(
    "bun",
    [
      "test",
      "--isolate",
      "--timeout=30000",
      "--path-ignore-patterns=e2e/specs/**",
      "--path-ignore-patterns=e2e/public/**",
      "--coverage",
      "--coverage-reporter=lcov",
      `--coverage-dir=${dirname(lcovPath)}`,
    ],
    { cwd: root, stdio: "inherit" }
  );
  if (result.status !== 0) {
    throw new Error(`Coverage test suite failed with exit ${result.status ?? "unknown"}`);
  }
  return Number((performance.now() - started).toFixed(2));
}

if (import.meta.main) {
  try {
    const parsed = parseCliArguments(process.argv.slice(2), COVERAGE_CLI);
    if (parsed.help) {
      console.log(formatCliHelp(COVERAGE_CLI));
    } else {
      const root = resolve(import.meta.dir, "../..");
      const policy = readPolicy(resolve(import.meta.dir, "coverage-risk-policy.json"));
      const lcovPath = isRuntimeString(parsed.values.lcov)
        ? resolve(root, parsed.values.lcov)
        : resolve(root, "coverage/lcov.info");
      const durationMs = isRuntimeString(parsed.values.lcov) ? null : runCoverage(root, lcovPath);
      const coverage = parseLcov(readFileSync(lcovPath, "utf8"));
      const findings = compareCoverage(policy, coverage);
      const branches = verifyBranchContracts(root, policy.branchContracts ?? []);
      findings.push(...branches.findings);
      const selectedCoverage = Object.fromEntries(
        policy.files.map((entry) => [entry.path, coverage[entry.path] ?? null])
      );
      const summary = {
        branches: { covered: branches.covered, mode: branches.mode, total: branches.total },
        durationMs,
        excludedPatterns: policy.excludedPatterns,
        files: selectedCoverage,
        schemaVersion: 1,
      };
      const summaryPath = resolve(root, "coverage/coverage-summary.json");
      mkdirSync(dirname(summaryPath), { recursive: true });
      writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
      if (findings.length > 0) {
        throw new Error(
          `Coverage ratchet failed:\n${findings.map((finding) => `- ${finding}`).join("\n")}`
        );
      }
      console.log(
        `Coverage ratchet passed: ${policy.files.length} high-risk files and ${branches.covered}/${branches.total} branch contracts.`
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Coverage ratchet failed");
    process.exitCode = 1;
  }
}
