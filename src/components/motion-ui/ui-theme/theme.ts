import { defaultTheme } from "./presets";
import type { DeepPartial, MotionUITheme, MotionUIThemeConfig, TransitionToken } from "./types";

/**
 * Deep-merge a partial config over a complete base. Plain objects merge
 * recursively; arrays (easing tuples) and primitives replace wholesale, so an
 * easing override is taken as a complete tuple rather than merged element-wise.
 */
function mergeTransition(
  base: TransitionToken,
  override: DeepPartial<TransitionToken> | undefined
): TransitionToken {
  return { ...base, ...override };
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
  return structuredClone({
    inView: { ...defaultTheme.inView, ...config.inView },
    reducedMotion: config.reducedMotion ?? defaultTheme.reducedMotion,
    stagger: { ...defaultTheme.stagger, ...config.stagger },
    transitions: {
      ambient: mergeTransition(defaultTheme.transitions.ambient, config.transitions?.ambient),
      gentle: mergeTransition(defaultTheme.transitions.gentle, config.transitions?.gentle),
      lively: mergeTransition(defaultTheme.transitions.lively, config.transitions?.lively),
      snap: mergeTransition(defaultTheme.transitions.snap, config.transitions?.snap),
      ui: mergeTransition(defaultTheme.transitions.ui, config.transitions?.ui),
    },
    travel: { ...defaultTheme.travel, ...config.travel },
  });
}
