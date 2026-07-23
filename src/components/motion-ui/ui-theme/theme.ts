import { defaultTheme } from "./presets";
import type { MotionUITheme, MotionUIThemeConfig } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge a partial config over a complete base. Plain objects merge
 * recursively; arrays (easing tuples) and primitives replace wholesale, so an
 * easing override is taken as a complete tuple rather than merged element-wise.
 */
function deepMerge<T>(base: T, override: unknown): T {
  // Only plain-object-over-plain-object recurses; anything else (primitive,
  // array/easing tuple) replaces the base value wholesale.
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T;

  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    if (overrideValue === undefined) continue;
    result[key] = deepMerge((base as Record<string, unknown>)[key], overrideValue);
  }
  return result as T;
}

/**
 * Build a complete, resolved `MotionUITheme` from a partial config by
 * deep-merging over the bundled default (`productive`). Any omitted subtree
 * falls back to the default, so partial configs are always valid.
 *
 * @example
 * defineTheme({ transitions: { ui: { stiffness: 300, damping: 20 } } })
 */
export function defineTheme(config: MotionUIThemeConfig = {}): MotionUITheme {
  // structuredClone so the resolved theme never aliases defaultTheme's
  // sub-objects: deepMerge only recurses into overridden branches, leaving
  // untouched subtrees (e.g. `travel` when only `transitions` is overridden)
  // pointing at the shared default. Mutating one of those would corrupt
  // defaultTheme — and every preset, since defaultTheme === productive.
  return structuredClone(deepMerge(defaultTheme, config));
}
