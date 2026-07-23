// The Motion UI theme schema: one file that sets the "feel" of an entire site.
// Sections reference these tokens by name (never by literal value), so retuning
// the whole site is a single-file edit. See README for the vocabulary.

/** A cubic-bezier control-point tuple. */
export type CubicBezier = readonly [number, number, number, number];

/**
 * A named transition. One token carries both channels of a state change:
 *
 * - The physics half (`stiffness` + `damping`) drives travel — transforms,
 *   layout morphs, anything that moves. It is a valid Motion spring
 *   transition as-is (`type: "spring"`) and carries velocity across
 *   interruptions.
 * - The `ease` + `duration` half is the matched channel for fades
 *   (opacity, colour), so both channels land together.
 *
 * `duration` is the former spring's visual duration, retained as the explicit
 * timing for non-physics channels and CSS output.
 */
export interface TransitionToken {
  type: "spring";
  /** Spring stiffness, resolved from the preset's former visual duration. */
  stiffness: number;
  /** Spring damping, resolved from the preset's former bounce. */
  damping: number;
  /** Companion fade/colour duration in seconds. */
  duration: number;
  /** Companion curve for fades (opacity/colour), over `duration`. */
  ease: CubicBezier;
}

/** The five feel-vocabulary transitions every section resolves by name. */
export interface TransitionTokens {
  /** Instant feedback: toggles, tabs, hovers. */
  snap: TransitionToken;
  /** Default: menus, cards, reveals. */
  ui: TransitionToken;
  /** Large surfaces: sections, sheets, curtains. */
  gentle: TransitionToken;
  /** Celebratory: confetti, badges, counters. */
  lively: TransitionToken;
  /**
   * Continuous background motion: pulses, sweeps, blinks. `duration` is the
   * cycle length; consumers usually pair it with `repeat: Infinity`.
   */
  ambient: TransitionToken;
}

/** Names of the transitions, usable as `useMotionUITransition(name)`. */
export type TransitionName = keyof TransitionTokens;

/**
 * The resolved transition returned by `useMotionUITransition`: the token plus
 *
 * - `duration`, supplied by the token, so `{ ...t, type: "tween" }` degrades
 *   to an eased tween of the same visual length. Motion ignores this timing
 *   parameter while the physics spring is active.
 * - `opacity`, a baked per-value tween so fades ride along with the spring
 *   and land together. Its ease is always `"linear"` — opacity is
 *   perceptually compressed, so the token's decelerating curve front-loads
 *   visibility and reads as a pop — while the token's `ease` remains the
 *   curve for colour and CSS channels. It carries `inherit: true` so
 *   top-level keys a consumer adds next to the spread (`repeat`, `delay`,
 *   `times`, ...) still reach the opacity channel — Motion resolves a
 *   per-value transition INSTEAD of the top level unless it inherits.
 *   Override with `opacity: { ... }` after the spread when a section needs
 *   something else.
 */
export interface UITransition extends TransitionToken {
  opacity: {
    type: "tween";
    duration: number;
    ease: "linear";
    inherit: true;
  };
}

/** Orchestration: stagger between children, in seconds. */
export interface StaggerTokens {
  tight: number;
  base: number;
  relaxed: number;
}

export type StaggerName = keyof StaggerTokens;

/** How far things travel on enter/hover, in pixels. */
export interface TravelTokens {
  hover: number;
  enter: number;
  section: number;
}

export type TravelName = keyof TravelTokens;

/** Viewport-entry defaults for `whileInView` sections. */
export interface InViewTokens {
  /** Fraction of the element that must be visible before it animates in. */
  amount: number;
  /** Animate only the first time it enters the viewport. */
  once: boolean;
}

/**
 * How to degrade when the user asks for reduced motion.
 * - `"calm"`: kill travel, keep opacity fades (duration-based).
 * - `"off"`: no animation at all.
 */
export type ReducedMotionStrategy = "calm" | "off";

/** The full, resolved theme. `defineTheme` always returns this complete shape. */
export interface MotionUITheme {
  transitions: TransitionTokens;
  stagger: StaggerTokens;
  travel: TravelTokens;
  inView: InViewTokens;
  reducedMotion: ReducedMotionStrategy;
}

/** Recursive partial: any subtree of a theme may be omitted in a config. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

/** A partial theme config, as passed to `defineTheme`. */
export type MotionUIThemeConfig = DeepPartial<MotionUITheme>;
