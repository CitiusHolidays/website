import { describe, expect, test } from "bun:test";
import { evaluateAiRuntimeManifest } from "./ai-runtime-config";

const validManifest = {
  browser: ["NEXT_PUBLIC_CONVEX_URL"],
  convexRuntime: ["AI_RUNTIME_SECRET"],
  nextServer: ["AI_RATE_LIMIT_SALT", "AI_RUNTIME_SECRET", "OPENROUTER_API_KEY"],
};

describe("AI runtime configuration preflight", () => {
  test("accepts correctly grouped server-only configuration", () => {
    expect(evaluateAiRuntimeManifest(validManifest)).toEqual({ errors: [], ok: true });
  });

  test("reports a missing Convex copy of the shared capability by key name only", () => {
    const result = evaluateAiRuntimeManifest({ ...validManifest, convexRuntime: [] });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "AI_RUNTIME_SECRET must be assigned to the Convex runtime group",
    ]);
  });

  test("rejects any browser exposure of AI secrets", () => {
    const result = evaluateAiRuntimeManifest({
      ...validManifest,
      browser: ["AI_RUNTIME_SECRET", "NEXT_PUBLIC_CONVEX_URL"],
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "AI_RUNTIME_SECRET must not be assigned to the browser runtime group",
    ]);
  });

  test("reports every missing Next.js server key without inspecting values", () => {
    const result = evaluateAiRuntimeManifest({ ...validManifest, nextServer: [] });
    expect(result.errors).toEqual([
      "AI_RATE_LIMIT_SALT must be assigned to the Next.js server runtime group",
      "AI_RUNTIME_SECRET must be assigned to the Next.js server runtime group",
      "OPENROUTER_API_KEY must be assigned to the Next.js server runtime group",
    ]);
  });
});
