import { beforeAll, describe, expect, test } from "bun:test";
import {
  checkDocumentPreviewProcessorRegression,
  type DocumentPreviewProcessorEvidence,
  measureDocumentPreviewProcessors,
  parseDocumentPreviewProcessorEvidence,
} from "./document-preview-performance";

const PRIVATE_CONTENT = /Preview fixture|Costs|SUM|preview-basic|\.xlsx|filename|storageId/;

const IDENTITY = {
  corpusFingerprint: "a".repeat(64),
  environmentFingerprint: "d".repeat(64),
  revision: "b".repeat(40),
  runtime: "bun-1.4.0-darwin-arm64",
  sourceFingerprint: "c".repeat(64),
  sourceState: "clean" as const,
};

let evidence: DocumentPreviewProcessorEvidence;

beforeAll(async () => {
  evidence = await measureDocumentPreviewProcessors(IDENTITY);
}, 30_000);

describe("Document Preview local processor evidence", () => {
  test("measures the complete synthetic processor matrix with content-free p50 and p95 aggregates", () => {
    expect(parseDocumentPreviewProcessorEvidence(evidence)).toEqual(evidence);
    expect(evidence.measurements).toHaveLength(15);
    expect(evidence.measurements.filter((sample) => sample.outcome === "rejected")).toHaveLength(3);
    expect(JSON.stringify(evidence)).not.toMatch(PRIVATE_CONTENT);
  }, 30_000);

  test("refuses missing budgets, unknown content fields, incomplete formats, and invalid percentiles", () => {
    expect(() => checkDocumentPreviewProcessorRegression(evidence, null, IDENTITY)).toThrow();
    expect(() =>
      parseDocumentPreviewProcessorEvidence({ ...evidence, fileName: "private" })
    ).toThrow("undeclared");
    expect(() =>
      parseDocumentPreviewProcessorEvidence({
        ...evidence,
        measurements: evidence.measurements.slice(1),
      })
    ).toThrow("incomplete");
    expect(() =>
      parseDocumentPreviewProcessorEvidence({
        ...evidence,
        environmentFingerprint: { fileName: "private" },
      })
    ).toThrow("provenance");
    for (const unsafe of [
      { ...evidence.measurements[0], extractedText: "private" },
      { ...evidence.measurements[0], p50: Number.NaN },
      { ...evidence.measurements[0], p95: -1 },
    ]) {
      expect(() =>
        parseDocumentPreviewProcessorEvidence({
          ...evidence,
          measurements: [unsafe, ...evidence.measurements.slice(1)],
        })
      ).toThrow();
    }
  });

  test("fails closed on stale provenance, dirty measurements, and exceeded p50 or p95", () => {
    expect(() =>
      checkDocumentPreviewProcessorRegression(evidence, evidence, IDENTITY)
    ).not.toThrow();
    for (const patch of [
      { sourceFingerprint: "d".repeat(64) },
      { corpusFingerprint: "e".repeat(64) },
      { revision: "f".repeat(40) },
      { sourceState: "dirty" },
      { environmentFingerprint: "e".repeat(64) },
      { runtime: "bun-1.4.0-linux-x64" },
    ]) {
      expect(() =>
        checkDocumentPreviewProcessorRegression({ ...evidence, ...patch }, evidence, IDENTITY)
      ).toThrow();
    }
    const baseline = structuredClone(evidence);
    baseline.measurements[0].p50 = 10;
    baseline.measurements[0].p95 = 20;
    for (const percentile of ["p50", "p95"] as const) {
      const candidate = structuredClone(baseline);
      candidate.measurements[0][percentile] += 1;
      expect(() => checkDocumentPreviewProcessorRegression(candidate, baseline, IDENTITY)).toThrow(
        "regression"
      );
    }
  });
});
