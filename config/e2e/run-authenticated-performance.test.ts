import { describe, expect, test } from "bun:test";
import { consolidateAuthenticatedPerformanceEvidence } from "./run-authenticated-performance";

function sample(target: "job-cards" | "proposals" | "queries", warm: boolean) {
  return { target, warm };
}

describe("revision-bound authenticated performance evidence", () => {
  const values = ["job-cards", "proposals", "queries"].map((target) => ({
    cold: sample(target as "job-cards", false),
    revision: "abc123+dirty.123456789abc",
    target: target as "job-cards" | "proposals" | "queries",
    warm: sample(target as "job-cards", true),
  }));

  test("requires all three cold/warm scenarios at one exact revision", () => {
    const evidence = consolidateAuthenticatedPerformanceEvidence(
      "abc123+dirty.123456789abc",
      values,
      ["package.json"],
      "source-hash",
      "2026-08-12T12:00:00.000Z"
    );
    expect(evidence.samples).toHaveLength(6);
    expect(evidence).toMatchObject({
      revision: "abc123+dirty.123456789abc",
      schemaVersion: 1,
      sourceHash: "source-hash",
    });
  });

  test("fails closed for missing targets, revision mismatch, or malformed warm state", () => {
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence(
        "abc123+dirty.123456789abc",
        values.slice(1),
        [],
        "x"
      )
    ).toThrow("missing");
    expect(() => consolidateAuthenticatedPerformanceEvidence("other", values, [], "x")).toThrow(
      "revision mismatch"
    );
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence(
        "abc123+dirty.123456789abc",
        [{ ...values[0], warm: sample("job-cards", false) }, ...values.slice(1)] as any,
        [],
        "x"
      )
    ).toThrow("warm sample");
  });
});
