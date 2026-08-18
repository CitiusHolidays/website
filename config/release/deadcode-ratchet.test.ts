import { describe, expect, test } from "bun:test";
import {
  compareDeadcodeInventory,
  fingerprintsFromKnipReport,
  summarizeFingerprints,
} from "./deadcode-ratchet";

const report = {
  issues: [
    {
      dependencies: [{ name: "unused-package" }],
      exports: [{ col: 1, line: 4, name: "unusedExport", pos: 30 }],
      file: "src/example.ts",
      files: [],
      unresolved: [],
    },
    {
      dependencies: [],
      exports: [],
      file: "src/old.ts",
      files: [{ name: "src/old.ts" }],
      unresolved: [],
    },
  ],
};

describe("Dead-code inventory ratchet", () => {
  test("Creates stable, category-prefixed fingerprints and counts", () => {
    const fingerprints = fingerprintsFromKnipReport(report);
    expect(fingerprints).toEqual([
      'dependencies|src/example.ts|{"name":"unused-package"}',
      'exports|src/example.ts|{"name":"unusedExport"}',
      'files|src/old.ts|{"name":"src/old.ts"}',
    ]);
    expect(summarizeFingerprints(fingerprints)).toEqual({
      dependencies: 1,
      exports: 1,
      files: 1,
    });
  });

  test("Ignores diagnostic positions that move when package or source lines shift", () => {
    const before = fingerprintsFromKnipReport(report);
    const after = fingerprintsFromKnipReport({
      issues: [
        {
          dependencies: [{ col: 30, line: 90, name: "unused-package", pos: 800 }],
          exports: [{ col: 8, line: 99, name: "unusedExport", pos: 900 }],
          file: "src/example.ts",
          files: [],
          unresolved: [],
        },
        report.issues[1],
      ],
    });
    expect(after).toEqual(before);
  });

  test("Allows removals while rejecting every new fingerprint", () => {
    const baseline = fingerprintsFromKnipReport(report);
    expect(compareDeadcodeInventory(baseline, baseline.slice(0, 2))).toEqual({ newIssues: [] });
    expect(compareDeadcodeInventory(baseline, [...baseline, "files|src/new.ts|{}"])).toEqual({
      newIssues: ["files|src/new.ts|{}"],
    });
    expect(compareDeadcodeInventory(baseline, [...baseline, baseline[0]!])).toEqual({
      newIssues: [baseline[0]],
    });
  });

  test("Fails closed for malformed Knip reports", () => {
    expect(() => fingerprintsFromKnipReport({})).toThrow("issues array");
    expect(() => fingerprintsFromKnipReport({ issues: [{ file: 42 }] })).toThrow(
      "malformed issue row"
    );
  });
});
