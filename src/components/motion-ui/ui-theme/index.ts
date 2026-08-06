// @motion/ui-theme — the motion vocabulary for Motion UI sections.
// One file sets the feel of an entire site; sections resolve tokens by name.

export { cssVarsToStyleString, themeToCssVars, transitionToLinear } from "./css";
export type { PresetName } from "./presets";
export { defaultTheme, editorial, playful, presets, productive } from "./presets";
export type { MotionUIThemeProviderProps, ResolvedMotionUITheme } from "./react";
export {
  MotionUIThemeProvider,
  useMotionUITheme,
  useMotionUITransition,
} from "./react";
export type { MotionMode, ResolvedReducedMotion } from "./reduced-motion";

export { resolveReducedMotion } from "./reduced-motion";
export { defineTheme } from "./theme";

export type {
  CubicBezier,
  DeepPartial,
  InViewTokens,
  MotionUITheme,
  MotionUIThemeConfig,
  ReducedMotionStrategy,
  StaggerName,
  StaggerTokens,
  TransitionName,
  TransitionToken,
  TransitionTokens,
  TravelName,
  TravelTokens,
  UITransition,
} from "./types";
