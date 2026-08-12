import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  canWriteBaseline,
  compareDiagnostics,
  diagnosticTotals,
  parseBiomeReport,
  parseBiomeResult,
  parseLintBaseline,
} from "./lint-ratchet";

const root = resolve(import.meta.dir, "../..");

const baseline = {
  diagnostics: { warning: { "lint/style/example": 2 } },
  generatedAt: "2026-08-05T00:00:00.000Z",
  schemaVersion: 1,
  scope: ".",
  tool: "@biomejs/biome@2.5.2",
  totals: { errors: 0, warnings: 2 },
};

describe("lint ratchet safety contract", () => {
  test("accepts a valid report and counts only lint diagnostics", () => {
    const report = parseBiomeReport(
      JSON.stringify({
        diagnostics: [
          { category: "lint/style/example", severity: "warning" },
          { category: "format", severity: "error" },
        ],
      })
    );
    expect(diagnosticTotals({ warning: { "lint/style/example": 1 } })).toEqual({
      errors: 0,
      warnings: 1,
    });
    expect(report.diagnostics).toHaveLength(2);
  });

  test("fails closed for malformed JSON, malformed diagnostics, and abnormal exits", () => {
    expect(() => parseBiomeReport("not-json")).toThrow("not valid JSON");
    expect(() => parseBiomeReport(JSON.stringify({ diagnostics: "nope" }))).toThrow(
      "diagnostics array"
    );
    expect(() =>
      parseBiomeResult({ error: new Error("spawn failed"), signal: null, status: null }, "{}")
    ).toThrow("failed to start");
    expect(() => parseBiomeResult({ signal: "SIGTERM", status: null }, "{}")).toThrow(
      "terminated by SIGTERM"
    );
    expect(() => parseBiomeResult({ status: 2 }, "{}")).toThrow("unexpectedly");
    expect(() => parseBiomeResult({ status: 0 }, JSON.stringify({ diagnostics: [{}] }))).toThrow(
      "malformed diagnostic"
    );
  });

  test("allows Biome status 1 only when the report is valid and policy comparison rejects increases", () => {
    expect(
      parseBiomeResult(
        { status: 1 },
        JSON.stringify({ diagnostics: [{ category: "lint/style/example", severity: "warning" }] })
      )
    ).toEqual({ warning: { "lint/style/example": 1 } });
    expect(() => parseBiomeResult({ status: 1 }, JSON.stringify({ diagnostics: [] }))).toThrow(
      "did not report diagnostics"
    );
    const comparison = compareDiagnostics(
      { warning: { "lint/style/example": 2 } },
      { warning: { "lint/style/example": 3 } }
    );
    expect(comparison.increases).toEqual(["warning lint/style/example: 3/2"]);
  });

  test("rejects a new warning family and every lint error from a zero-error baseline", () => {
    const comparison = compareDiagnostics(baseline.diagnostics, {
      error: { "lint/correctness/new-error": 1 },
      warning: {
        "lint/performance/new-debt": 1,
        "lint/style/example": 2,
      },
    });

    expect(comparison.increases).toEqual([
      "warning lint/performance/new-debt: 1/0",
      "error lint/correctness/new-error: 1/0",
    ]);
  });

  test("rejects malformed or internally inconsistent baselines", () => {
    expect(parseLintBaseline(baseline)).toEqual(baseline);
    expect(() => parseLintBaseline({ ...baseline, totals: { errors: 0, warnings: 3 } })).toThrow(
      "do not match"
    );
    expect(() =>
      parseLintBaseline({ ...baseline, diagnostics: { warning: { "lint/style/example": -1 } } })
    ).toThrow("invalid");
  });

  test("never permits a baseline write when lint errors, increases, or warning growth exist", () => {
    expect(
      canWriteBaseline({
        baseline,
        current: { warning: { "lint/style/example": 2 } },
        increases: [],
      })
    ).toBe(true);
    expect(
      canWriteBaseline({
        baseline,
        current: { error: { "lint/correctness/example": 1 } },
        increases: [],
      })
    ).toBe(false);
    expect(
      canWriteBaseline({
        baseline,
        current: { warning: { "lint/style/example": 3 } },
        increases: ["warning lint/style/example: 3/2"],
      })
    ).toBe(false);
  });

  test("help and invalid flags exit before Biome or baseline work", () => {
    const run = (args: string[]) =>
      spawnSync("bun", ["config/release/lint-ratchet.ts", ...args], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });

    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: bun run lint:ratchet");
    expect(help.stdout).not.toContain("Lint ratchet passed");

    const invalid = run(["--wat"]);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("Unknown flag --wat");
    expect(invalid.stdout).not.toContain("Lint ratchet passed");
  });
});
