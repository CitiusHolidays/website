import type { CubicBezier, MotionUITheme, TransitionToken } from "./types";

// Shipped presets. Each is a genuinely distinct tuning of the same vocabulary,
// so one line switches a site's whole character. The distinctions are physical
// (stiffness, damping, fade duration, travel distance, stagger, easing overshoot),
// not cosmetic: productive dampens hard and travels little; playful bounces
// and travels far; editorial sits deliberately between the two.
//
// These physics values are Motion's exact resolution of the former
// visualDuration/bounce presets. Physical springs preserve momentum when an
// animation is interrupted, unlike time-defined springs, while `duration`
// retains the original timing for fade and CSS channels.

function transition(
  duration: number,
  stiffness: number,
  damping: number,
  ease: CubicBezier
): TransitionToken {
  return { damping, duration, ease, stiffness, type: "spring" };
}

/**
 * `productive` — Linear-grade restraint. Short perceived durations with no
 * bounce, tight stagger, small travel. Motion is felt as crisp
 * responsiveness, never as spectacle. This is `defaultTheme`.
 */
const productiveOut: CubicBezier = [0.22, 1, 0.36, 1];
const productiveInOut: CubicBezier = [0.65, 0, 0.35, 1];

export const productive: MotionUITheme = {
  inView: { amount: 0.4, once: true },
  reducedMotion: "calm",
  stagger: { base: 0.08, relaxed: 0.15, tight: 0.04 },
  transitions: {
    ambient: transition(0.8, 42.836_824_657_505_9, 13.089_969_389_957_473, productiveInOut),
    gentle: transition(0.5, 109.662_271_123_215_1, 19.896_753_472_735_355, productiveOut),
    lively: transition(0.21, 621.668_203_646_344, 17.453_292_519_943_293, productiveOut),
    snap: transition(0.15, 1218.469_679_146_834_6, 69.813_170_079_773_19, productiveOut),
    ui: transition(0.3, 304.617_419_786_708_64, 33.161_255_787_892_26, productiveOut),
  },
  travel: { enter: 24, hover: 4, section: 48 },
};

/**
 * `editorial` — motion.dev's own feel. Slightly longer perceived durations
 * than productive with more generous travel and stagger, so reveals read as
 * considered and paced rather than instantaneous. Still barely bouncy:
 * expressive, not springy.
 */
const editorialOut: CubicBezier = [0.16, 1, 0.3, 1];
const editorialInOut: CubicBezier = [0.62, 0, 0.38, 1];

export const editorial: MotionUITheme = {
  inView: { amount: 0.35, once: true },
  reducedMotion: "calm",
  stagger: { base: 0.1, relaxed: 0.2, tight: 0.05 },
  transitions: {
    ambient: transition(0.8, 42.836_824_657_505_9, 13.089_969_389_957_473, editorialInOut),
    gentle: transition(0.55, 90.629_976_134_888_48, 17.707_158_592_960_65, editorialOut),
    lively: transition(0.23, 518.252_699_070_014_5, 20.033_344_457_674_04, editorialOut),
    snap: transition(0.17, 948.635_563_349_611_4, 58.519_863_155_103_984, editorialOut),
    ui: transition(0.35, 223.800_553_312_683_86, 27.825_534_931_795_31, editorialOut),
  },
  travel: { enter: 32, hover: 6, section: 64 },
};

/**
 * `playful` — Family-ish bounce. Real bounce on every transition, longer
 * perceived durations, big travel, relaxed stagger, and overshooting
 * cubic-beziers on the fade channel. Motion is a personality trait here.
 * `inView.once` is false so sections re-play on re-entry, leaning into the
 * character.
 */
const playfulOut: CubicBezier = [0.34, 1.56, 0.64, 1];
const playfulInOut: CubicBezier = [0.68, -0.6, 0.32, 1.6];

export const playful: MotionUITheme = {
  inView: { amount: 0.3, once: false },
  reducedMotion: "calm",
  stagger: { base: 0.12, relaxed: 0.24, tight: 0.06 },
  transitions: {
    ambient: transition(0.9, 33.846_379_976_300_95, 11.635_528_346_628_863, playfulInOut),
    gentle: transition(0.58, 81.496_931_571_949_39, 11.555_283_323_548_664, playfulOut),
    lively: transition(0.23, 518.252_699_070_014_5, 12.293_188_644_481_798, playfulOut),
    snap: transition(0.18, 846.159_499_407_523_9, 34.906_585_039_886_59, playfulOut),
    ui: transition(0.36, 211.539_874_851_880_97, 16.871_516_102_611_857, playfulOut),
  },
  travel: { enter: 40, hover: 8, section: 80 },
};

/** All shipped presets, keyed by name. */
export const presets = { editorial, playful, productive } as const;

export type PresetName = keyof typeof presets;

/** The bundled default theme (= `productive`), used when no provider is mounted. */
export const defaultTheme: MotionUITheme = productive;
