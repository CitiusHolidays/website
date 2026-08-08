import { describe, expect, test } from "bun:test";
import {
  LOCAL_RELEASE_GATES,
  resolveVerificationRevision,
  runLocalReleaseVerification,
} from "./verify-local";

describe("target-neutral local release verifier", () => {
  test("runs every accepted local gate in order and labels the evidence", () => {
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

    expect(result).toEqual({ failedGate: null, ok: true });
    expect(visited).toEqual(LOCAL_RELEASE_GATES.map((gate) => gate.id));
    expect(lines.join("\n")).toContain("Commit: abc123");
    expect(lines.join("\n")).toContain("Verified at: 2026-08-07T20:00:00.000Z");
    expect(lines.join("\n")).toContain("Local proof only");
    expect(LOCAL_RELEASE_GATES.find((gate) => gate.id === "automation")?.args).toEqual([
      "run",
      "automation:check",
      "--",
      "git",
      "diff",
      "--check",
    ]);
  });

  test("stops at the first failure and excludes target-bound commands", () => {
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

    expect(result).toEqual({ failedGate: failed.id, ok: false });
    expect(visited).toEqual(LOCAL_RELEASE_GATES.slice(0, 3).map((gate) => gate.id));
    const commands = LOCAL_RELEASE_GATES.flatMap((gate) => gate.args).join(" ");
    expect(commands).not.toContain("convex codegen");
    expect(commands).not.toContain("next build");
    expect(commands).not.toContain("convex deploy");
    expect(commands).not.toContain("env:preflight");
  });

  test("labels dirty worktree evidence with a deterministic content fingerprint", () => {
    expect(
      resolveVerificationRevision("abc123", {
        status: " M tracked.ts\n?? new.ts\n",
        trackedDiff: "diff --git a/tracked.ts b/tracked.ts",
        untrackedFiles: [["new.ts", "new content"]],
      })
    ).toMatch(/^abc123\+dirty\.[a-f0-9]{12}$/);
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
});
