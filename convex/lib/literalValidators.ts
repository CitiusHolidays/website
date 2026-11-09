import { v } from "convex/values";

/**
 * Build a `v.union` of string literals from a `const` array, so the runtime
 * list, the validator, and the inferred type come from one source.
 */
export function literalUnion<const Value extends string>(values: readonly Value[]) {
  return v.union(...values.map((value) => v.literal(value)));
}
