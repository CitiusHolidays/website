import { describe, expect, test } from "bun:test";
import {
  assertPinnedBunVersion,
  PINNED_BUN_VERSION,
  runTargetNeutralQuality,
  TARGET_NEUTRAL_QUALITY_GATES,
} from "./run-target-neutral-quality";

describe("Shared target-neutral quality suite", () => {
  test("runs every credential-free gate in one stable order", () => {
    const visited: string[] = [];
    const result = runTargetNeutralQuality((gate) => {
      visited.push(gate.id);
      return 0;
    });

    expect(result).toEqual({ failedGate: null, ok: true });
    expect(visited).toEqual(TARGET_NEUTRAL_QUALITY_GATES.map((gate) => gate.id));
    expect(visited).toContain("lint-all");
    expect(visited).toContain("all-tests");
    expect(visited).toContain("studio-build");
    expect(visited).toContain("diff-hygiene");
    expect(visited.at(-1)).toBe("performance");
  });

  test("rejects local runtime drift from the hosted Bun version", () => {
    expect(PINNED_BUN_VERSION).toBe("1.3.14");
    expect(() => assertPinnedBunVersion("1.3.14")).not.toThrow();
    expect(() => assertPinnedBunVersion("1.3.15")).toThrow("requires Bun 1.3.14");
    expect(() => assertPinnedBunVersion(undefined)).toThrow("received unknown");
  });

  test("stops immediately after the first failed gate", () => {
    const visited: string[] = [];
    const result = runTargetNeutralQuality(
      (gate) => {
        visited.push(gate.id);
        return gate.id === "all-tests" ? 1 : 0;
      },
      () => undefined
    );

    expect(result).toEqual({ failedGate: "all-tests", ok: false });
    expect(visited.at(-1)).toBe("all-tests");
    expect(visited).not.toContain("coverage");
  });
});
