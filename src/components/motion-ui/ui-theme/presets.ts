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
  return { type: "spring", duration, stiffness, damping, ease };
}

/**
 * `productive` — Linear-grade restraint. Short perceived durations with no
 * bounce, tight stagger, small travel. Motion is felt as crisp
 * responsiveness, never as spectacle. This is `defaultTheme`.
 */
const productiveOut: CubicBezier = [0.22, 1, 0.36, 1];
const productiveInOut: CubicBezier = [0.65, 0, 0.35, 1];

export const productive: MotionUITheme = {
  transitions: {
    snap: transition(0.15, 1218.4696791468346, 69.81317007977319, productiveOut),
    ui: transition(0.3, 304.61741978670864, 33.16125578789226, productiveOut),
    gentle: transition(0.5, 109.6622711232151, 19.896753472735355, productiveOut),
    lively: transition(0.21, 621.668203646344, 17.453292519943293, productiveOut),
    ambient: transition(0.8, 42.8368246575059, 13.089969389957473, productiveInOut),
  },
  stagger: { tight: 0.04, base: 0.08, relaxed: 0.15 },
  travel: { hover: 4, enter: 24, section: 48 },
  inView: { amount: 0.4, once: true },
  reducedMotion: "calm",
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
  transitions: {
    snap: transition(0.17, 948.6355633496114, 58.519863155103984, editorialOut),
    ui: transition(0.35, 223.80055331268386, 27.82553493179531, editorialOut),
    gentle: transition(0.55, 90.62997613488848, 17.70715859296065, editorialOut),
    lively: transition(0.23, 518.2526990700145, 20.03334445767404, editorialOut),
    ambient: transition(0.8, 42.8368246575059, 13.089969389957473, editorialInOut),
  },
  stagger: { tight: 0.05, base: 0.1, relaxed: 0.2 },
  travel: { hover: 6, enter: 32, section: 64 },
  inView: { amount: 0.35, once: true },
  reducedMotion: "calm",
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
  transitions: {
    snap: transition(0.18, 846.1594994075239, 34.90658503988659, playfulOut),
    ui: transition(0.36, 211.53987485188097, 16.871516102611857, playfulOut),
    gentle: transition(0.58, 81.49693157194939, 11.555283323548664, playfulOut),
    lively: transition(0.23, 518.2526990700145, 12.293188644481798, playfulOut),
    ambient: transition(0.9, 33.84637997630095, 11.635528346628863, playfulInOut),
  },
  stagger: { tight: 0.06, base: 0.12, relaxed: 0.24 },
  travel: { hover: 8, enter: 40, section: 80 },
  inView: { amount: 0.3, once: false },
  reducedMotion: "calm",
};

/** All shipped presets, keyed by name. */
export const presets = { productive, editorial, playful } as const;

export type PresetName = keyof typeof presets;

/** The bundled default theme (= `productive`), used when no provider is mounted. */
export const defaultTheme: MotionUITheme = productive;
