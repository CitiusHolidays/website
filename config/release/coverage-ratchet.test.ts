import { describe, expect, test } from "bun:test";
import { compareCoverage, parseLcov, selectCoverageTestFiles } from "./coverage-ratchet";

const lcov = `TN:
SF:src/high-risk.ts
FNF:4
FNH:3
DA:1,2
DA:2,0
DA:3,1
LF:3
LH:2
end_of_record
`;

describe("Risk-based coverage ratchet", () => {
  test("Parses machine-readable line and function coverage deterministically", () => {
    expect(parseLcov(lcov)).toEqual({
      "src/high-risk.ts": {
        functions: { covered: 3, found: 4, percent: 75 },
        lines: { covered: 2, found: 3, percent: 66.67 },
      },
    });
    expect(parseLcov(lcov)).toEqual(parseLcov(lcov));
  });

  test("Rejects missing files and line or function regressions", () => {
    const policy = {
      files: [
        {
          functionsMinimumPercent: 75,
          linesMinimumPercent: 66.67,
          path: "src/high-risk.ts",
          risk: "authorization",
        },
      ],
    };

    expect(compareCoverage(policy, parseLcov(lcov))).toEqual([]);
    expect(
      compareCoverage(
        {
          files: [{ ...policy.files[0], functionsMinimumPercent: 75.01 }],
        },
        parseLcov(lcov)
      )
    ).toEqual([expect.stringContaining("functions")]);
    expect(compareCoverage(policy, {})).toEqual([expect.stringContaining("missing")]);
  });

  test("Fails closed for malformed or zero-denominator LCOV records", () => {
    expect(() => parseLcov("SF:a.ts\nLF:0\nLH:0\nFNF:0\nFNH:0\nend_of_record\n")).toThrow("zero");
    expect(() => parseLcov("LF:1\nLH:1\n")).toThrow("SF");
  });

  test("Runs each policy-owned coverage test exactly once", () => {
    expect(
      selectCoverageTestFiles([
        { testFile: "src/z.test.ts" },
        { testFile: "src/a.test.ts" },
        { testFile: "src/z.test.ts" },
      ])
    ).toEqual(["src/a.test.ts", "src/z.test.ts"]);
  });
});
