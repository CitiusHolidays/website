import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { gc } from "bun";
import type { ClassValue } from "clsx";
import { cn as baselineCn } from "../src/lib/utils.js";

export type ClassMerger = (...inputs: ClassValue[]) => string;

interface BenchmarkFixture {
  expected: string;
  inputs: ClassValue[];
  name: string;
  source: string;
  surface: "Customer Travel Account" | "Public site" | "Sacred Bharat" | "Staff Workspace";
}

export const CNFAST_BENCHMARK_FIXTURES: BenchmarkFixture[] = [
  {
    expected: "inline-flex items-center py-2 px-6 bg-public-orange focus-visible:ring-2 md:px-8",
    inputs: [
      "inline-flex items-center px-4 py-2",
      false,
      "px-6",
      { "bg-public-orange": true, "opacity-50": false },
      ["focus-visible:ring-2", "md:px-8"],
    ],
    name: "public primary action",
    source: "src/components/ui/PublicContactCta.js",
    surface: "Public site",
  },
  {
    expected: "h-[100dvh] bg-public-night min-h-screen text-public-surface",
    inputs: [
      "h-[100dvh] bg-public-night text-white",
      "min-h-screen",
      { "text-public-surface": true },
      null,
    ],
    name: "public full-height hero",
    source: "src/components/pilgrimage/SacredSitesVisual.js",
    surface: "Public site",
  },
  {
    expected:
      "flex items-center border min-h-14 rounded-2xl px-4 py-3 text-public-paper focus-visible:outline-2",
    inputs: [
      "flex min-h-11 items-center rounded-xl border px-3 py-2 text-white",
      ["min-h-14", "rounded-2xl", "px-4", "py-3"],
      { "text-public-paper": true },
      "focus-visible:outline-2",
    ],
    name: "Sacred Bharat edition choice",
    source: "src/components/sacredBharat/edition/SacredBharatEdition.js",
    surface: "Sacred Bharat",
  },
  {
    expected:
      "inline-flex min-h-12 rounded-full bg-public-orange px-5 text-public-ink hover:bg-public-lime",
    inputs: [
      "inline-flex min-h-11 rounded-xl bg-public-night px-4 text-white",
      ["min-h-12", "rounded-full", "bg-public-orange", "px-5"],
      { "text-public-ink": true },
      "hover:bg-public-lime",
    ],
    name: "Sacred Bharat edition share action",
    source: "src/components/sacredBharat/edition/SacredBharatEdition.js",
    surface: "Sacred Bharat",
  },
  {
    expected: "flex min-w-16 flex-1 py-2 px-4 justify-center text-xs md:text-sm",
    inputs: [
      "flex min-w-16 flex-1 px-3 py-2",
      "px-4",
      { "justify-center": true },
      ["text-xs", "md:text-sm"],
    ],
    name: "Account navigation control",
    source: "src/components/account/AccountUi.js",
    surface: "Customer Travel Account",
  },
  {
    expected:
      "border border-[var(--account-border)] bg-[var(--account-surface)] shadow-sm focus-visible:ring-2",
    inputs: [
      "border border-[var(--account-border)] bg-[var(--account-surface)]",
      { "border-transparent": false, "shadow-sm": true },
      "focus-visible:ring-2",
    ],
    name: "Account surface card",
    source: "src/components/ui/application-field.tsx",
    surface: "Customer Travel Account",
  },
  {
    expected: "sticky z-20 top-[var(--portal-chrome-height)] bg-white sm:px-4 px-3",
    inputs: [
      "sticky top-16 z-20",
      "top-[var(--portal-chrome-height)]",
      { "bg-white": true },
      ["sm:px-4", "px-3"],
    ],
    name: "Staff Workspace sticky toolbar",
    source: "src/components/portal/PortalPopover.tsx",
    surface: "Staff Workspace",
  },
  {
    expected: "tabular-nums text-right font-medium text-base leading-5",
    inputs: [
      "tabular-nums text-right text-sm",
      0,
      "",
      { "font-medium": true },
      ["text-base", ["leading-5"]],
    ],
    name: "Staff Workspace numeric cell",
    source: "src/components/ui/application-status.tsx",
    surface: "Staff Workspace",
  },
];

export function buildBenchmarkCases(iterations: number) {
  const warm = Array.from(
    { length: iterations },
    (_, index) => CNFAST_BENCHMARK_FIXTURES[index % CNFAST_BENCHMARK_FIXTURES.length]?.inputs ?? []
  );
  const cold = warm.map((inputs, index) => [...inputs, `cnfast-benchmark-${index}`]);
  return { cold, warm };
}

export function parseBenchmarkOptions(args: string[]) {
  let candidatePath = "";
  let iterations = 20_000;
  let trials = 7;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--candidate" && value) {
      candidatePath = value;
      index += 1;
    } else if (argument === "--iterations" && value) {
      iterations = Number.parseInt(value, 10);
      index += 1;
    } else if (argument === "--trials" && value) {
      trials = Number.parseInt(value, 10);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete benchmark argument: ${argument ?? "<missing>"}`);
    }
  }

  if (!candidatePath) {
    throw new Error("The cnfast benchmark requires --candidate <path-to-index.mjs>");
  }
  if (!(Number.isSafeInteger(iterations) && iterations >= 100)) {
    throw new Error("The cnfast benchmark requires at least 100 iterations");
  }
  if (!(Number.isSafeInteger(trials) && trials >= 3)) {
    throw new Error("The cnfast benchmark requires at least 3 trials");
  }

  return { candidatePath, iterations, trials };
}

function compareInputCases<Metadata>(
  baseline: ClassMerger,
  candidate: ClassMerger,
  cases: ClassValue[][],
  metadataFor: (index: number) => Metadata
) {
  const mismatches = cases.flatMap((inputs, index) => {
    const expected = baseline(...inputs);
    const actual = candidate(...inputs);
    return actual === expected ? [] : [{ actual, expected, ...metadataFor(index) }];
  });
  return { checked: cases.length, mismatches };
}

export function compareMergerOutputs(baseline: ClassMerger, candidate: ClassMerger) {
  return compareInputCases(
    baseline,
    candidate,
    CNFAST_BENCHMARK_FIXTURES.map((fixture) => fixture.inputs),
    (index) => ({
      fixture: CNFAST_BENCHMARK_FIXTURES[index]?.name ?? `fixture-${index}`,
      surface: CNFAST_BENCHMARK_FIXTURES[index]?.surface ?? "unknown",
    })
  );
}

function round(value: number) {
  return Number(value.toFixed(3));
}

export function summarizeSamples(samples: number[]) {
  if (samples.length < 2) {
    throw new Error("At least two benchmark samples are required");
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const mean = sorted.reduce((total, sample) => total + sample, 0) / sorted.length;
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2
      : (sorted[midpoint] ?? 0);
  const variance =
    sorted.reduce((total, sample) => total + (sample - mean) ** 2, 0) / (sorted.length - 1);
  const standardDeviation = Math.sqrt(variance);

  return {
    maximum: round(sorted.at(-1) ?? 0),
    mean: round(mean),
    median: round(median),
    minimum: round(sorted[0] ?? 0),
    relativeStandardDeviation: mean === 0 ? 0 : round(standardDeviation / Math.abs(mean)),
    standardDeviation: round(standardDeviation),
  };
}

function runWorkload(merger: ClassMerger, cases: ClassValue[][]) {
  let checksum = 0;
  const startedAt = performance.now();
  for (const inputs of cases) {
    checksum += merger(...inputs).length;
  }
  const durationMs = performance.now() - startedAt;
  if (checksum === Number.MIN_SAFE_INTEGER) {
    throw new Error("Unreachable checksum guard");
  }
  return (cases.length / durationMs) * 1000;
}

function measureThroughput(
  baseline: ClassMerger,
  candidate: ClassMerger,
  cases: ClassValue[][],
  trials: number
) {
  const baselineSamples: number[] = [];
  const candidateSamples: number[] = [];
  const warmupCases = cases.slice(0, Math.min(500, cases.length));
  runWorkload(baseline, warmupCases);
  runWorkload(candidate, warmupCases);

  for (let trial = 0; trial < trials; trial += 1) {
    if (trial % 2 === 0) {
      baselineSamples.push(runWorkload(baseline, cases));
      candidateSamples.push(runWorkload(candidate, cases));
    } else {
      candidateSamples.push(runWorkload(candidate, cases));
      baselineSamples.push(runWorkload(baseline, cases));
    }
  }

  const baselineSummary = summarizeSamples(baselineSamples);
  const candidateSummary = summarizeSamples(candidateSamples);
  return {
    baselineOperationsPerSecond: baselineSummary,
    candidateOperationsPerSecond: candidateSummary,
    medianSpeedup: round(candidateSummary.median / baselineSummary.median),
  };
}

function compareCases(baseline: ClassMerger, candidate: ClassMerger, cases: ClassValue[][]) {
  const comparison = compareInputCases(baseline, candidate, cases, (index) => ({ index }));
  return { ...comparison, mismatches: comparison.mismatches.slice(0, 20) };
}

function findPackageRoot(entryPath: string) {
  let current = dirname(resolve(entryPath));
  const filesystemRoot = parse(current).root;
  while (current !== filesystemRoot) {
    if (existsSync(resolve(current, "package.json"))) {
      return current;
    }
    current = dirname(current);
  }
  throw new Error(`Unable to find a package root for ${entryPath}`);
}

function directoryBytes(path: string): number {
  return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) {
      return total + directoryBytes(child);
    }
    return entry.isFile() ? total + statSync(child).size : total;
  }, 0);
}

function runtimeFootprint(paths: string[]) {
  return paths.reduce(
    (total, path) => {
      const contents = readFileSync(path);
      return {
        gzipBytes: total.gzipBytes + gzipSync(contents).byteLength,
        rawBytes: total.rawBytes + contents.byteLength,
      };
    },
    { gzipBytes: 0, rawBytes: 0 }
  );
}

function packageMetadata(entryPath: string) {
  const packageRoot = findPackageRoot(entryPath);
  // SAFETY: npm package metadata is read-only benchmark input and validated below.
  const metadata = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as {
    name?: string;
    version?: string;
  };
  if (!(metadata.name && metadata.version)) {
    throw new Error(`Candidate package metadata is incomplete at ${packageRoot}`);
  }
  return {
    name: metadata.name,
    packageBytes: directoryBytes(packageRoot),
    version: metadata.version,
  };
}

function measureMemorySignal(merger: ClassMerger, cases: ClassValue[][], trials: number) {
  const heapUsedDeltaBytes: number[] = [];
  const rssDeltaBytes: number[] = [];
  for (let trial = 0; trial < trials; trial += 1) {
    gc(true);
    const before = process.memoryUsage();
    runWorkload(merger, cases);
    const after = process.memoryUsage();
    heapUsedDeltaBytes.push(after.heapUsed - before.heapUsed);
    rssDeltaBytes.push(after.rss - before.rss);
  }
  return {
    heapUsedDeltaBytes: summarizeSamples(heapUsedDeltaBytes),
    rssDeltaBytes: summarizeSamples(rssDeltaBytes),
  };
}

function gitRevision() {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== "";
  return { head, state: dirty ? "working-tree" : "clean" };
}

async function runBenchmark() {
  const options = parseBenchmarkOptions(process.argv.slice(2));
  const candidateEntry = resolve(options.candidatePath);
  const candidateModule = await import(pathToFileURL(candidateEntry).href);
  if (!(Object.hasOwn(candidateModule, "cn") && candidateModule.cn instanceof Function)) {
    throw new Error("The candidate module must export a cn function");
  }
  const candidateCn: ClassMerger = (...inputs) => candidateModule.cn(...inputs);
  const cases = buildBenchmarkCases(options.iterations);
  const fixtureCorrectness = compareMergerOutputs(baselineCn, candidateCn);
  const coldCorrectness = compareCases(
    baselineCn,
    candidateCn,
    cases.cold.slice(0, Math.min(5000, cases.cold.length))
  );
  const require = createRequire(import.meta.url);
  const baselineEntries = [require.resolve("clsx"), require.resolve("tailwind-merge")];
  const baselinePackageRoots = [...new Set(baselineEntries.map(findPackageRoot))];
  const candidate = packageMetadata(candidateEntry);
  // SAFETY: project package metadata is read-only benchmark provenance.
  const projectPackage = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  const report = {
    candidate: { name: candidate.name, version: candidate.version },
    compatibility: {
      bunEsmImport: "passed",
      next: "Framework-agnostic API; no Citius Next integration was made in this benchmark-only ticket.",
      react:
        "No React peer dependency; exercised as a plain function with Citius ClassValue inputs.",
      reactCompiler:
        "No application import was made; a follow-up adoption ticket must rerun typecheck and the target-aware build workflow.",
    },
    correctness: {
      coldVariants: coldCorrectness,
      representativeFixtures: fixtureCorrectness,
    },
    footprint: {
      baseline: {
        packageBytes: baselinePackageRoots.reduce(
          (total, packageRoot) => total + directoryBytes(packageRoot),
          0
        ),
        packages: ["clsx", "tailwind-merge"],
        ...runtimeFootprint(baselineEntries),
      },
      candidate: {
        packageBytes: candidate.packageBytes,
        ...runtimeFootprint([candidateEntry]),
      },
      note: "Runtime footprint sums resolved entry files; package bytes sum all published files on disk.",
    },
    generatedAt: new Date().toISOString(),
    memorySignal: {
      baseline: measureMemorySignal(baselineCn, cases.warm, options.trials),
      candidate: measureMemorySignal(candidateCn, cases.warm, options.trials),
      note: "Directional process deltas after explicit Bun GC; not an allocation profile or budget.",
    },
    methodology: {
      coldDefinition: "representative fixture call groups with a unique unknown class per call",
      iterationsPerTrial: options.iterations,
      order: "alternating baseline-first and candidate-first trials",
      privacy: "static class strings only; no customer, CRM, authentication, or provider data",
      trials: options.trials,
      warmDefinition: "the same eight representative fixture call groups repeated",
    },
    revision: gitRevision(),
    runtime: {
      architecture: process.arch,
      bun: process.versions.bun ?? "unknown",
      nodeCompatibility: process.version,
      platform: process.platform,
    },
    schemaVersion: 1,
    throughput: {
      cold: measureThroughput(baselineCn, candidateCn, cases.cold, options.trials),
      warm: measureThroughput(baselineCn, candidateCn, cases.warm, options.trials),
    },
    toolchain: {
      next: projectPackage.dependencies.next,
      react: projectPackage.dependencies.react,
      reactCompiler: projectPackage.devDependencies["babel-plugin-react-compiler"],
      tailwindMerge: projectPackage.dependencies["tailwind-merge"],
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (fixtureCorrectness.mismatches.length > 0 || coldCorrectness.mismatches.length > 0) {
    process.exitCode = 2;
  }
}

if (import.meta.main) {
  await runBenchmark();
}
