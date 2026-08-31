import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  LOCAL_RELEASE_GATES,
  resolveVerificationRevision,
  runLocalReleaseVerification,
  writeVerificationMetrics,
} from "./verify-local";

const root = resolve(import.meta.dir, "../..");
const DIRTY_REVISION_PATTERN = /^abc123\+dirty\.[a-f0-9]{12}$/;

describe("Target-neutral local release verifier", () => {
  test("Runs every accepted local gate in order and labels the evidence", () => {
    const visited: string[] = [];
    const lines: string[] = [];
    const result = runLocalReleaseVerification({
      commit: "abc123",
      now: new Date("2026-08-07T20:00:00.000Z"),
      runGate: (gate) => {
        visited.push(gate.id);
        return 0;
      },
      write: (line) => lines.push(line),
    });

    expect(result).toMatchObject({ failedGate: null, ok: true });
    expect(visited).toEqual(LOCAL_RELEASE_GATES.map((gate) => gate.id));
    expect(lines.join("\n")).toContain("Commit: abc123");
    expect(lines.join("\n")).toContain("Verified at: 2026-08-07T20:00:00.000Z");
    expect(lines.join("\n")).toContain("Local proof only");
    expect(LOCAL_RELEASE_GATES.find((gate) => gate.id === "root-install")?.args).toEqual([
      "install",
      "--frozen-lockfile",
    ]);
    expect(LOCAL_RELEASE_GATES.find((gate) => gate.id === "shared-quality")?.args).toEqual([
      "run",
      "quality:target-neutral",
    ]);
    expect(LOCAL_RELEASE_GATES.map((gate) => gate.id)).toEqual([
      "root-install",
      "studio-lint-install",
      "shared-quality",
    ]);
  });

  test("Stops at the first failure and excludes target-bound commands", () => {
    const visited: string[] = [];
    const [, , failed] = LOCAL_RELEASE_GATES;
    const result = runLocalReleaseVerification({
      commit: "abc123",
      now: new Date("2026-08-07T20:00:00.000Z"),
      runGate: (gate) => {
        visited.push(gate.id);
        return gate.id === failed.id ? 7 : 0;
      },
      write: () => undefined,
    });

    expect(result).toMatchObject({ failedGate: failed.id, ok: false });
    expect(visited).toEqual(LOCAL_RELEASE_GATES.map((gate) => gate.id));
    const commands = LOCAL_RELEASE_GATES.flatMap((gate) => gate.args).join(" ");
    expect(commands).not.toContain("convex codegen");
    expect(commands).not.toContain("next build");
    expect(commands).not.toContain("convex deploy");
    expect(commands).not.toContain("env:preflight");
  });

  test("Records deterministic monotonic timings for passed, failed, and skipped gates", () => {
    const times = [5, 13, 20, 27, 35];
    const result = runLocalReleaseVerification({
      commit: "abc123+dirty.fixture",
      monotonicNow: () => times.shift() ?? 35,
      now: new Date("2026-08-07T20:00:00.000Z"),
      runGate: (gate) => (gate.id === LOCAL_RELEASE_GATES[1]?.id ? 7 : 0),
      startedAtMonotonic: 0,
      write: () => undefined,
    });

    expect(result.ok).toBe(false);
    expect(result.metrics).toMatchObject({
      failedGate: LOCAL_RELEASE_GATES[1]?.id,
      outcome: "failed",
      revision: "abc123+dirty.fixture",
      schemaVersion: 1,
      totalDurationMs: 35,
    });
    expect(result.metrics.gates[0]).toMatchObject({ durationMs: 8, outcome: "passed" });
    expect(result.metrics.gates[1]).toMatchObject({ durationMs: 7, outcome: "failed" });
    expect(result.metrics.gates[2]).toMatchObject({
      durationMs: 0,
      outcome: "skipped",
      reason: "not attempted after studio-lint-install failed",
    });
    const serialized = JSON.stringify(result.metrics);
    expect(serialized).not.toContain("env");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain(process.cwd());
  });

  test("Writes structured metrics only to the ignored local evidence boundary", () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "citius-verify-metrics-"));
    const result = runLocalReleaseVerification({
      commit: "abc123",
      monotonicNow: (() => {
        let value = 0;
        return () => {
          value += 1;
          return value;
        };
      })(),
      now: new Date("2026-08-07T20:00:00.000Z"),
      runGate: () => 0,
      write: () => undefined,
    });
    try {
      const output = ".scratch/dx-metrics/verify.json";
      writeVerificationMetrics(tempRoot, output, result.metrics);
      const parsed = JSON.parse(readFileSync(resolve(tempRoot, output), "utf8"));
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.gates).toHaveLength(LOCAL_RELEASE_GATES.length);
      expect(() => writeVerificationMetrics(tempRoot, "outside.json", result.metrics)).toThrow(
        ".scratch/dx-metrics"
      );
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  test("Labels dirty worktree evidence with a deterministic content fingerprint", () => {
    expect(
      resolveVerificationRevision("abc123", {
        status: " M tracked.ts\n?? new.ts\n",
        trackedDiff: "diff --git a/tracked.ts b/tracked.ts",
        untrackedFiles: [["new.ts", "new content"]],
      })
    ).toMatch(DIRTY_REVISION_PATTERN);
    expect(
      resolveVerificationRevision("abc123", {
        status: " M tracked.ts\n?? new.ts\n",
        trackedDiff: "diff --git a/tracked.ts b/tracked.ts",
        untrackedFiles: [["new.ts", "new content"]],
      })
    ).not.toBe(
      resolveVerificationRevision("abc123", {
        status: " M tracked.ts\n?? new.ts\n",
        trackedDiff: "diff --git a/tracked.ts b/tracked.ts",
        untrackedFiles: [["new.ts", "changed content"]],
      })
    );
    expect(
      resolveVerificationRevision("abc123", {
        status: "",
        trackedDiff: "",
        untrackedFiles: [],
      })
    ).toBe("abc123");
  });

  test("Help and list are side-effect-free while unknown flags fail before gates", () => {
    const run = (args: string[]) =>
      spawnSync("bun", ["config/release/verify-local.ts", ...args], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });

    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: bun run verify:local");
    expect(help.stdout).toContain("--metrics");
    expect(help.stdout).toContain("--evidence");
    expect(help.stdout).not.toContain("Running Diff hygiene");

    const list = run(["--list"]);
    expect(list.status).toBe(0);
    expect(list.stdout).toContain("root-install: Root frozen install");
    expect(list.stdout).toContain("studio-lint-install: Studio lint dependency install");
    expect(list.stdout).toContain("shared-quality: Shared required quality suite");
    expect(list.stdout).toContain("not release evidence");
    expect(list.stdout).not.toContain("Running Diff hygiene");

    const unknown = run(["--wat"]);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain("Unknown flag --wat");
    expect(unknown.stdout).not.toContain("Running Diff hygiene");
  }, 30_000);
});
