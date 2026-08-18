import { describe, expect, test } from "bun:test";
// biome-ignore lint/performance/noNamespaceImport: the parity test intentionally runs the same contract over both modules.
import * as convexRuntimeValues from "../../convex/lib/runtimeValues";
import {
  isRuntimeBigInt as convexIsRuntimeBigInt,
  isRuntimeSymbol as convexIsRuntimeSymbol,
} from "../../convex/lib/runtimeValues";
// biome-ignore lint/performance/noNamespaceImport: the parity test intentionally runs the same contract over both modules.
import * as appRuntimeValues from "./runtimeValues";
import {
  isRuntimeBigInt as appIsRuntimeBigInt,
  isRuntimeSymbol as appIsRuntimeSymbol,
} from "./runtimeValues";

const implementations = [
  {
    ...appRuntimeValues,
    isRuntimeBigInt: appIsRuntimeBigInt,
    isRuntimeSymbol: appIsRuntimeSymbol,
  },
  {
    ...convexRuntimeValues,
    isRuntimeBigInt: convexIsRuntimeBigInt,
    isRuntimeSymbol: convexIsRuntimeSymbol,
  },
] as const;

describe("Runtime value guards", () => {
  test("Match primitive typeof semantics without accepting boxed values", () => {
    for (const guards of implementations) {
      expect(guards.isRuntimeString("value")).toBe(true);
      // biome-ignore lint/style/useConsistentBuiltinInstantiation: boxed primitives are the negative test case.
      expect(guards.isRuntimeString(new String("value"))).toBe(false);
      expect(guards.isRuntimeNumber(Number.NaN)).toBe(true);
      // biome-ignore lint/style/useConsistentBuiltinInstantiation: boxed primitives are the negative test case.
      expect(guards.isRuntimeNumber(new Number(1))).toBe(false);
      expect(guards.isRuntimeBoolean(false)).toBe(true);
      // biome-ignore lint/style/useConsistentBuiltinInstantiation: boxed primitives are the negative test case.
      expect(guards.isRuntimeBoolean(new Boolean(false))).toBe(false);
      expect(guards.isRuntimeBigInt(1n)).toBe(true);
      expect(guards.isRuntimeSymbol(Symbol("value"))).toBe(true);
    }
  });

  test("Keeps functions distinct from runtime objects", () => {
    for (const guards of implementations) {
      expect(guards.isRuntimeFunction(() => undefined)).toBe(true);
      expect(guards.isRuntimeObject(() => undefined)).toBe(false);
      expect(guards.isRuntimeObject({})).toBe(true);
      expect(guards.isRuntimeObject(null)).toBe(false);
    }
  });

  test("Preserves optional-property omission semantics", () => {
    for (const guards of implementations) {
      expect({
        required: true,
        ...guards.propertiesWhen(true, () => ({ optional: "value" })),
      }).toEqual({ optional: "value", required: true });
      expect({
        required: true,
        ...guards.propertiesWhen(false, () => ({ optional: "value" })),
      }).toEqual({ required: true });
    }
  });
});
