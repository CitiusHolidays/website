// @motion/ui-theme — the motion vocabulary for Motion UI sections.
// One file sets the feel of an entire site; sections resolve tokens by name.

export { defineTheme } from "./theme";
export { defaultTheme, productive, editorial, playful, presets } from "./presets";
export type { PresetName } from "./presets";

export {
  MotionUIThemeProvider,
  useMotionUITheme,
  useMotionUITransition,
} from "./react";
export type { MotionUIThemeProviderProps, ResolvedMotionUITheme } from "./react";

export { themeToCssVars, cssVarsToStyleString, transitionToLinear } from "./css";

export { resolveReducedMotion } from "./reduced-motion";
export type { MotionMode, ResolvedReducedMotion } from "./reduced-motion";

export type {
  MotionUITheme,
  MotionUIThemeConfig,
  DeepPartial,
  CubicBezier,
  TransitionToken,
  TransitionTokens,
  TransitionName,
  UITransition,
  StaggerTokens,
  StaggerName,
  TravelTokens,
  TravelName,
  InViewTokens,
  ReducedMotionStrategy,
} from "./types";
