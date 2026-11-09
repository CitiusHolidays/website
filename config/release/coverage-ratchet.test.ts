import { describe, expect, test } from "bun:test";
import { compareCoverage, parseLcov } from "./coverage-ratchet";

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

  test("Fails closed for malformed LCOV records", () => {
    expect(() => parseLcov("LF:1\nLH:1\n")).toThrow("SF");
    expect(() => parseLcov("SF:a.ts\nLF:1\nLH:2\nFNF:0\nFNH:0\nend_of_record\n")).toThrow(
      "invalid"
    );
    expect(() => parseLcov("SF:a.ts\nLF:1\nLH:1\nFNF:0\nend_of_record\n")).toThrow("incomplete");
  });

  test("Accepts function-free files from Bun 1.4.4 LCOV without weakening the ratchet", () => {
    // Bun 1.4.4 emits FNF:0 for every module without functions, e.g. convex/_generated/api.js.
    const generated =
      "TN:\nSF:convex/_generated/api.js\nFNF:0\nFNH:0\nDA:11,118\nLF:1\nLH:1\nend_of_record\n";
    const coverage = parseLcov(`${lcov}${generated}`);
    expect(coverage["convex/_generated/api.js"]).toEqual({
      functions: { covered: 0, found: 0, percent: null },
      lines: { covered: 1, found: 1, percent: 100 },
    });
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
    expect(compareCoverage(policy, coverage)).toEqual([]);
    expect(
      compareCoverage(
        { files: [{ ...policy.files[0], path: "convex/_generated/api.js" }] },
        coverage
      )
    ).toEqual([expect.stringContaining("zero functions coverage denominator")]);
  });
});
