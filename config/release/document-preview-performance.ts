import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { cpus, release, totalmem } from "node:os";
import { assertSafeImagePreview } from "@convex/crm/lib/documentPreviewImageSafety";
import { version as bunVersion } from "bun";
import {
  DOCUMENT_PREVIEW_FORMATS,
  hostileOfficeFixture,
  type PreviewCorpusFixture,
  previewCorpusFixture,
} from "../../e2e/fixtures/documentPreviewCorpus";
import { assertSafeOfficeArchive } from "../../src/lib/portal/officeArchiveSafety";
import { assertSafePdfStreams } from "../../src/lib/portal/pdfPreviewSafety";
import { prepareSpreadsheetPreview } from "../../src/lib/portal/spreadsheetPreview";
import { isRuntimeNumber, isRuntimeObject, isRuntimeString } from "../../src/lib/runtimeValues";
import type { JsonObject, JsonValue } from "../lib/jsonValue";
import { computePerformanceSourceHash } from "./check-performance-budgets";
import { collectLocalImportClosure } from "./performance-inputs";

const SHA256 = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{40}$/;
const RUNTIME = /^bun-\d+\.\d+\.\d+-(darwin|linux|win32)-(arm64|x64)$/;
const TRIALS = 20;
const LIMITS = {
  maxArchiveEntries: 4096,
  maxArchiveEntryBytes: 64 * 1024 * 1024,
  maxTotalInflatedBytes: 192 * 1024 * 1024,
};
const PROCESSOR_ROOTS = [
  "config/release/document-preview-performance.ts",
  "convex/crm/lib/documentPreviewImageSafety.ts",
  "e2e/fixtures/documentPreviewCorpus.ts",
  "src/lib/portal/officeArchiveSafety.ts",
  "src/lib/portal/pdfPreviewSafety.ts",
  "src/lib/portal/spreadsheetPreview.ts",
];

interface ProcessorCase {
  format: PreviewCorpusFixture["format"];
  metric: "safetyCheckMs" | "textDecodeMs" | "workbookPreparationMs";
  outcome: "ready" | "rejected";
  scenario: "basic" | "size_boundary" | "corrupt" | "encrypted" | "expansion_limit";
}

const PROCESSOR_METRICS = {
  docx: "safetyCheckMs",
  image: "safetyCheckMs",
  pdf: "safetyCheckMs",
  pptx: "safetyCheckMs",
  text: "textDecodeMs",
  xlsx: "workbookPreparationMs",
} as const;

function processorCases(): ProcessorCase[] {
  return [
    ...DOCUMENT_PREVIEW_FORMATS.flatMap((format) =>
      (["basic", "size_boundary"] as const).map(
        (scenario): ProcessorCase => ({
          format,
          metric: PROCESSOR_METRICS[format],
          outcome: "ready",
          scenario,
        })
      )
    ),
    ...(["corrupt", "encrypted", "expansion_limit"] as const).map(
      (scenario): ProcessorCase => ({
        format: "xlsx",
        metric: "workbookPreparationMs",
        outcome: "rejected",
        scenario,
      })
    ),
  ];
}

function processorFixture(entry: ProcessorCase) {
  return entry.scenario === "basic" || entry.scenario === "size_boundary"
    ? previewCorpusFixture(entry.format, entry.scenario)
    : hostileOfficeFixture(entry.scenario);
}

export interface DocumentPreviewMeasurementIdentity extends JsonObject {
  corpusFingerprint: string;
  environmentFingerprint: string;
  revision: string;
  runtime: string;
  sourceFingerprint: string;
  sourceState: "clean" | "dirty";
}

interface ProcessorMeasurement extends JsonObject {
  format: PreviewCorpusFixture["format"];
  metric: ProcessorCase["metric"];
  outcome: ProcessorCase["outcome"];
  p50: number;
  p95: number;
  scenario: ProcessorCase["scenario"];
  sizeBand: "under_1mb" | "10mb_to_15mb";
}

export interface DocumentPreviewProcessorEvidence extends DocumentPreviewMeasurementIdentity {
  measurements: ProcessorMeasurement[];
  schemaVersion: 1;
  scope: "local-processor";
  trialCount: number;
}

export function documentPreviewMeasurementIdentity(
  root = process.cwd()
): DocumentPreviewMeasurementIdentity {
  const sourceFiles = [
    ...new Set(["bun.lock", "package.json", ...collectLocalImportClosure(root, PROCESSOR_ROOTS)]),
  ];
  const corpus = createHash("sha256");
  for (const entry of processorCases()) {
    corpus.update(`${entry.format}:${entry.scenario}:${entry.metric}:${entry.outcome}\0`);
    corpus.update(processorFixture(entry).buffer);
  }
  return {
    corpusFingerprint: corpus.digest("hex"),
    environmentFingerprint: createHash("sha256")
      .update(
        JSON.stringify({
          architecture: process.arch,
          bun: bunVersion,
          cpuModel: cpus()[0]?.model,
          logicalCpus: cpus().length,
          memoryBytes: totalmem(),
          os: process.platform,
          release: release(),
        })
      )
      .digest("hex"),
    revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    runtime: `bun-${bunVersion}-${process.platform}-${process.arch}`,
    sourceFingerprint: computePerformanceSourceHash(root, sourceFiles),
    sourceState: execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
      ? "dirty"
      : "clean",
  };
}

async function measureProcessor(entry: ProcessorCase, fixture: PreviewCorpusFixture) {
  const bytes = Uint8Array.from(fixture.buffer).buffer;
  const started = performance.now();
  let outcome: ProcessorCase["outcome"] = "ready";
  try {
    switch (entry.format) {
      case "pdf":
        await assertSafePdfStreams(bytes);
        break;
      case "image":
        assertSafeImagePreview(bytes, fixture.mimeType);
        break;
      case "text":
        new TextDecoder().decode(bytes);
        break;
      case "xlsx":
        await prepareSpreadsheetPreview(bytes);
        break;
      default:
        await assertSafeOfficeArchive(bytes, LIMITS);
    }
  } catch {
    outcome = "rejected";
  }
  if (outcome !== entry.outcome) {
    throw new Error("Document Preview processor outcome changed");
  }
  return performance.now() - started;
}

export async function measureDocumentPreviewProcessors(
  identity: DocumentPreviewMeasurementIdentity
): Promise<DocumentPreviewProcessorEvidence> {
  const measurements: ProcessorMeasurement[] = [];
  for (const entry of processorCases()) {
    const fixture = processorFixture(entry);
    const trials: number[] = [];
    for (let trial = 0; trial < TRIALS; trial += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential trials bound memory; concurrent-viewer timing belongs to the separate browser lane.
      trials.push(await measureProcessor(entry, fixture));
    }
    trials.sort((left, right) => left - right);
    measurements.push({
      format: entry.format,
      metric: entry.metric,
      outcome: entry.outcome,
      p50: (trials[TRIALS / 2 - 1] + trials[TRIALS / 2]) / 2,
      p95: trials[Math.ceil(TRIALS * 0.95) - 1],
      scenario: entry.scenario,
      sizeBand: entry.scenario === "size_boundary" ? "10mb_to_15mb" : "under_1mb",
    });
  }
  return {
    ...identity,
    measurements,
    schemaVersion: 1,
    scope: "local-processor",
    trialCount: TRIALS,
  };
}

function exactRecord(value: JsonValue, keys: readonly string[]) {
  if (
    !isRuntimeObject(value) ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== [...keys].sort().join()
  ) {
    throw new Error("Preview performance evidence contains missing or undeclared fields");
  }
  return value;
}

export function parseDocumentPreviewProcessorEvidence(
  value: JsonValue
): DocumentPreviewProcessorEvidence {
  const record = exactRecord(value, [
    "corpusFingerprint",
    "environmentFingerprint",
    "measurements",
    "revision",
    "runtime",
    "schemaVersion",
    "scope",
    "sourceFingerprint",
    "sourceState",
    "trialCount",
  ]);
  if (
    record.schemaVersion !== 1 ||
    record.scope !== "local-processor" ||
    record.trialCount !== TRIALS
  ) {
    throw new Error("Preview processor evidence requires the local scope and 20 complete trials");
  }
  if (
    !(
      isRuntimeString(record.revision) &&
      REVISION.test(record.revision) &&
      isRuntimeString(record.sourceFingerprint) &&
      SHA256.test(record.sourceFingerprint) &&
      isRuntimeString(record.corpusFingerprint) &&
      SHA256.test(record.corpusFingerprint) &&
      isRuntimeString(record.environmentFingerprint) &&
      SHA256.test(record.environmentFingerprint) &&
      isRuntimeString(record.runtime) &&
      RUNTIME.test(record.runtime)
    ) ||
    (record.sourceState !== "clean" && record.sourceState !== "dirty")
  ) {
    throw new Error("Preview processor evidence is missing exact provenance");
  }
  if (!Array.isArray(record.measurements)) {
    throw new Error("Preview processor measurements are required");
  }
  const expected = processorCases();
  if (record.measurements.length !== expected.length) {
    throw new Error("Preview processor corpus is incomplete");
  }
  const measurements = record.measurements.map((raw, index): ProcessorMeasurement => {
    const sample = exactRecord(raw, [
      "format",
      "metric",
      "outcome",
      "p50",
      "p95",
      "scenario",
      "sizeBand",
    ]);
    const entry = expected[index];
    const sizeBand = entry.scenario === "size_boundary" ? "10mb_to_15mb" : "under_1mb";
    if (
      sample.format !== entry.format ||
      sample.scenario !== entry.scenario ||
      sample.outcome !== entry.outcome ||
      sample.metric !== entry.metric ||
      sample.sizeBand !== sizeBand
    ) {
      throw new Error("Preview processor corpus is incomplete or reordered");
    }
    if (
      !(
        isRuntimeNumber(sample.p50) &&
        isRuntimeNumber(sample.p95) &&
        Number.isFinite(sample.p50) &&
        Number.isFinite(sample.p95)
      ) ||
      sample.p50 < 0 ||
      sample.p95 < sample.p50
    ) {
      throw new Error("Preview processor percentile is malformed");
    }
    return {
      format: entry.format,
      metric: entry.metric,
      outcome: entry.outcome,
      p50: sample.p50,
      p95: sample.p95,
      scenario: entry.scenario,
      sizeBand,
    };
  });
  return {
    corpusFingerprint: record.corpusFingerprint,
    environmentFingerprint: record.environmentFingerprint,
    measurements,
    revision: record.revision,
    runtime: record.runtime,
    schemaVersion: 1,
    scope: "local-processor",
    sourceFingerprint: record.sourceFingerprint,
    sourceState: record.sourceState,
    trialCount: TRIALS,
  };
}

export function checkDocumentPreviewProcessorRegression(
  candidateValue: JsonValue,
  baselineValue: JsonValue,
  expected: DocumentPreviewMeasurementIdentity
) {
  if (expected.sourceState !== "clean") {
    throw new Error("Preview processor regression checks require a clean reviewed checkout");
  }
  const candidate = parseDocumentPreviewProcessorEvidence(candidateValue);
  const baseline = parseDocumentPreviewProcessorEvidence(baselineValue);
  for (const record of [candidate, baseline]) {
    if (
      record.sourceState !== "clean" ||
      record.sourceFingerprint !== expected.sourceFingerprint ||
      record.corpusFingerprint !== expected.corpusFingerprint ||
      record.environmentFingerprint !== expected.environmentFingerprint ||
      record.runtime !== expected.runtime
    ) {
      throw new Error(
        "Preview processor evidence is stale or incomparable; a reviewed fresh baseline is required"
      );
    }
  }
  if (candidate.revision !== expected.revision) {
    throw new Error("Preview processor candidate revision does not match the reviewed checkout");
  }
  for (const [index, sample] of candidate.measurements.entries()) {
    if (
      sample.p50 > baseline.measurements[index].p50 ||
      sample.p95 > baseline.measurements[index].p95
    ) {
      throw new Error(
        `Preview processor regression: ${sample.format}/${sample.scenario}/${sample.metric}`
      );
    }
  }
}

if (import.meta.main) {
  try {
    const [mode, candidatePath, baselinePath] = process.argv.slice(2);
    const identity = documentPreviewMeasurementIdentity();
    if (mode === "--measure-local" && !candidatePath) {
      console.log(JSON.stringify(await measureDocumentPreviewProcessors(identity), null, 2));
    } else if (mode === "--check-local" && candidatePath && baselinePath) {
      checkDocumentPreviewProcessorRegression(
        JSON.parse(readFileSync(candidatePath, "utf8")),
        JSON.parse(readFileSync(baselinePath, "utf8")),
        identity
      );
      console.log("Document Preview local processor regression check passed.");
    } else {
      throw new Error(
        "Use --measure-local, or --check-local <candidate.json> <reviewed-baseline.json>; unmeasured budgets cannot pass."
      );
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Document Preview local processor check failed"
    );
    process.exitCode = 1;
  }
}
