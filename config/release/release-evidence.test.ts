import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  createLocalReleaseEvidence,
  parseReleaseEvidence,
  RELEASE_EVIDENCE_SCOPES,
  summarizeReleaseEvidence,
  writeReleaseEvidence,
} from "./release-evidence";
import type { LocalVerificationMetrics } from "./verify-local";

const passedMetrics: LocalVerificationMetrics = {
  failedGate: null,
  gates: [{ durationMs: 12, id: "types", label: "Types", outcome: "passed" }],
  outcome: "passed",
  revision: "abc123+dirty.123456789abc",
  schemaVersion: 1,
  startedAt: "2026-08-12T10:00:00.000Z",
  totalDurationMs: 12,
};

describe("Revision-bound release evidence", () => {
  test("A local pass proves only the local scope", () => {
    const evidence = createLocalReleaseEvidence(passedMetrics, "2026-08-12T10:01:00.000Z");
    expect(parseReleaseEvidence(evidence)).toEqual(evidence);
    expect(evidence.scopes.local).toMatchObject({ status: "passed", target: { kind: "local" } });
    for (const scope of RELEASE_EVIDENCE_SCOPES.filter((candidate) => candidate !== "local")) {
      expect(evidence.scopes[scope]).toMatchObject({ command: null, status: "not_run" });
    }
  });

  test("Failed and skipped checks retain actionable generated reasons", () => {
    const evidence = createLocalReleaseEvidence({
      ...passedMetrics,
      failedGate: "types",
      gates: [
        { durationMs: 4, id: "types", label: "Types", outcome: "failed" },
        {
          durationMs: 0,
          id: "assets",
          label: "Assets",
          outcome: "skipped",
          reason: "not attempted after types failed",
        },
      ],
      outcome: "failed",
    });
    expect(evidence.scopes.local).toMatchObject({ reason: "gate types failed", status: "failed" });
    expect(evidence.scopes.local.checks[0]?.reason).toBe("gate types failed");
    expect(evidence.scopes.local.checks[1]?.reason).toBe("not attempted after types failed");
    expect(parseReleaseEvidence(evidence)).toEqual(evidence);
  });

  test("Keeps evidence creation at or after the monotonic completion time", () => {
    const evidence = createLocalReleaseEvidence(
      { ...passedMetrics, totalDurationMs: 1001 },
      "2026-08-12T10:00:01.000Z"
    );
    expect(evidence.createdAt).toBe("2026-08-12T10:00:01.001Z");
    expect(parseReleaseEvidence(evidence)).toEqual(evidence);
  });

  test("Rejects undeclared fields and invalid proof transitions", () => {
    const evidence = createLocalReleaseEvidence(passedMetrics);
    expect(() => parseReleaseEvidence({ ...evidence, secretValue: "do-not-record" })).toThrow(
      "not part of the release evidence schema"
    );
    expect(() =>
      parseReleaseEvidence({
        ...evidence,
        scopes: {
          ...evidence.scopes,
          "production-deploy": {
            ...evidence.scopes["production-deploy"],
            command: "deploy",
          },
        },
      })
    ).toThrow("cannot claim execution or a target while not_run");
  });

  test("Rejects malformed nested checks, targets, timestamps, and sensitive evidence text", () => {
    const evidence = createLocalReleaseEvidence(passedMetrics);
    const { local } = evidence.scopes;
    const malformed = [
      { ...local, checks: [{ ...local.checks[0], durationMs: -1 }] },
      { ...local, checks: [{ ...local.checks[0], artifactRefs: ["../secret.txt"] }] },
      { ...local, checks: [{ ...local.checks[0], artifactRefs: ["https://example.test/log"] }] },
      {
        ...local,
        checks: [local.checks[0], { ...local.checks[0] }],
      },
      { ...local, checks: [{ ...local.checks[0], outcome: "skipped" }] },
      { ...local, finishedAt: "2020-01-01T00:00:00.000Z" },
      { ...local, target: { id: "preview-123", kind: "preview" } },
      { ...local, command: "TOKEN=do-not-record bun run verify:local" },
    ];
    for (const candidate of malformed) {
      expect(() =>
        parseReleaseEvidence({
          ...evidence,
          scopes: { ...evidence.scopes, local: candidate },
        })
      ).toThrow();
    }
  });

  test("Rejects blocked execution claims, Production-like Preview targets, and future completion", () => {
    const evidence = createLocalReleaseEvidence(passedMetrics, "2026-08-12T10:01:00.000Z");
    const blocked = {
      ...evidence.scopes["preview-deploy"],
      reason: "provider approval is pending",
      status: "blocked",
    };
    expect(
      parseReleaseEvidence({
        ...evidence,
        scopes: { ...evidence.scopes, "preview-deploy": blocked },
      }).scopes["preview-deploy"]
    ).toEqual(blocked);
    expect(() =>
      parseReleaseEvidence({
        ...evidence,
        scopes: {
          ...evidence.scopes,
          "preview-deploy": {
            ...blocked,
            command: "deploy preview",
            startedAt: "2026-08-12T10:00:00.000Z",
            target: { id: "preview-safe", kind: "preview" },
          },
        },
      })
    ).toThrow("while blocked");
    expect(() =>
      parseReleaseEvidence({
        ...evidence,
        scopes: {
          ...evidence.scopes,
          "preview-public-smoke": {
            checks: [{ ...evidence.scopes.local.checks[0] }],
            command: "preview smoke",
            finishedAt: "2026-08-12T10:00:01.000Z",
            reason: null,
            startedAt: "2026-08-12T10:00:00.000Z",
            status: "passed",
            target: { id: "preview-production-copy", kind: "preview" },
          },
        },
      })
    ).toThrow("Production-like");
    expect(() =>
      parseReleaseEvidence({
        ...evidence,
        createdAt: "2026-08-12T10:00:00.000Z",
      })
    ).toThrow("cannot precede");
  });

  test("Requires internally consistent passed and failed evidence", () => {
    const evidence = createLocalReleaseEvidence(passedMetrics);
    const { local } = evidence.scopes;
    expect(() =>
      parseReleaseEvidence({
        ...evidence,
        scopes: {
          ...evidence.scopes,
          local: {
            ...local,
            checks: [{ ...local.checks[0], outcome: "failed", reason: "types failed" }],
          },
        },
      })
    ).toThrow("passed evidence");
    expect(() =>
      parseReleaseEvidence({
        ...evidence,
        scopes: {
          ...evidence.scopes,
          local: { ...local, reason: "gate failed", status: "failed" },
        },
      })
    ).toThrow("at least one failed check");
  });

  test("Writes only to the ignored evidence boundary and summarizes the same JSON", () => {
    const root = mkdtempSync(resolve(tmpdir(), "citius-release-evidence-"));
    try {
      const evidence = createLocalReleaseEvidence(passedMetrics, "2026-08-12T10:01:00.000Z");
      const output = writeReleaseEvidence(root, "auto", evidence);
      expect(output).not.toBeNull();
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const parsed = JSON.parse(readFileSync(output as string, "utf8"));
      expect(summarizeReleaseEvidence(parsed)).toContain("production-authenticated-smoke: not_run");
      expect(() => writeReleaseEvidence(root, "outside.json", evidence)).toThrow(
        ".scratch/release-evidence"
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
