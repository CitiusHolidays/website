import { describe, expect, test } from "bun:test";
import {
  assertPinnedBunVersion,
  PINNED_BUN_VERSION,
  runTargetNeutralQuality,
  TARGET_NEUTRAL_QUALITY_GATES,
} from "./run-target-neutral-quality";

describe("Required target-neutral quality suite", () => {
  test("runs only the required checks in one stable order", () => {
    const visited: string[] = [];
    const result = runTargetNeutralQuality((gate) => {
      visited.push(gate.id);
      return 0;
    });

    expect(result).toEqual({ failedGate: null, ok: true });
    expect(visited).toEqual(["lint-all", "app-types", "convex-types", "all-tests", "coverage"]);
    expect(visited).toEqual(TARGET_NEUTRAL_QUALITY_GATES.map((gate) => gate.id));
  });

  test("rejects local runtime drift from the hosted Bun version", () => {
    expect(PINNED_BUN_VERSION).toBe("1.4.0");
    expect(() => assertPinnedBunVersion("1.4.0")).not.toThrow();
    expect(() => assertPinnedBunVersion("1.4.1")).toThrow("requires Bun 1.4.0");
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
