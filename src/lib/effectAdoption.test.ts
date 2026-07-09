import { describe, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import {
  buildExternalIoEffect,
  EFFECT_ADOPTION_PRESSURES,
  evaluateEffectAdoption,
} from "./effectAdoption";

describe("evaluateEffectAdoption", () => {
  test("approves Effect only when at least two distinct orchestration pressures apply", () => {
    const result = evaluateEffectAdoption([
      "external-io",
      "typed-recoverable-errors",
      "external-io",
    ]);

    expect(result.appropriate).toBe(true);
    expect(result.matchedPressures).toEqual(["external-io", "typed-recoverable-errors"]);
    expect(result.missingPressureCount).toBe(0);
  });

  test("rejects Effect for simple async code or simple React and Convex state", () => {
    const simpleAsync = evaluateEffectAdoption(["external-io"]);
    const simpleState = evaluateEffectAdoption([]);

    expect(simpleAsync.appropriate).toBe(false);
    expect(simpleAsync.missingPressureCount).toBe(1);
    expect(simpleState.appropriate).toBe(false);
    expect(simpleState.missingPressureCount).toBe(2);
  });

  test("keeps the approved pressure vocabulary stable for agent prompts", () => {
    expect(EFFECT_ADOPTION_PRESSURES).toEqual([
      "external-io",
      "retry-or-throttle",
      "concurrency-control",
      "typed-recoverable-errors",
      "rollback-or-cleanup",
      "test-time-dependency-substitution",
    ]);
  });

  test("documents approved migration seams with at least two pressures", () => {
    const seams = {
      "create-order route": ["external-io", "typed-recoverable-errors"],
      "notification email delivery": [
        "external-io",
        "retry-or-throttle",
        "typed-recoverable-errors",
        "test-time-dependency-substitution",
      ],
      "payment verification": ["external-io", "typed-recoverable-errors"],
      "razorpay webhook": ["external-io", "typed-recoverable-errors"],
    } as const;

    for (const pressures of Object.values(seams)) {
      expect(evaluateEffectAdoption(pressures).appropriate).toBe(true);
    }
  });
});

describe("buildExternalIoEffect", () => {
  test("wraps a project-style external I/O call with a typed recoverable error", async () => {
    const program = buildExternalIoEffect("send notification email", () =>
      Promise.reject(new Error("rate limited"))
    );

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain("send notification email");
      expect(String(exit.cause)).toContain("rate limited");
    }
  });
});
