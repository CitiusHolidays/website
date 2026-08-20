// @motion/ui-theme — the motion vocabulary for Motion UI sections.
// One file sets the feel of an entire site; sections resolve tokens by name.

import {
  themeToCssVars as resolveThemeCssVars,
  cssVarsToStyleString as serializeCssVars,
  transitionToLinear as serializeLinearTransition,
} from "./css";
import type { PresetName as ThemePresetName } from "./presets";
import {
  defaultTheme as defaultMotionTheme,
  editorial as editorialTheme,
  playful as playfulTheme,
  productive as productiveTheme,
  presets as themePresets,
} from "./presets";
import type {
  ResolvedMotionUITheme as ResolvedTheme,
  MotionUIThemeProviderProps as ThemeProviderProps,
} from "./react";
import {
  MotionUIThemeProvider as ThemeProvider,
  useMotionUITheme as useResolvedMotionTheme,
  useMotionUITransition as useResolvedMotionTransition,
} from "./react";
import type {
  MotionMode as ResolvedMotionMode,
  ResolvedReducedMotion as ResolvedMotionPreference,
} from "./reduced-motion";
import { resolveReducedMotion as resolveMotionPreference } from "./reduced-motion";
import { defineTheme as createTheme } from "./theme";

export const cssVarsToStyleString = serializeCssVars;
export const themeToCssVars = resolveThemeCssVars;
export const transitionToLinear = serializeLinearTransition;
export const defaultTheme = defaultMotionTheme;
export const editorial = editorialTheme;
export const playful = playfulTheme;
export const presets = themePresets;
export const productive = productiveTheme;
export const MotionUIThemeProvider = ThemeProvider;
export const useMotionUITheme = useResolvedMotionTheme;
export const useMotionUITransition = useResolvedMotionTransition;
export const resolveReducedMotion = resolveMotionPreference;
export const defineTheme = createTheme;

export type PresetName = ThemePresetName;
export type MotionUIThemeProviderProps = ThemeProviderProps;
export type ResolvedMotionUITheme = ResolvedTheme;
export type MotionMode = ResolvedMotionMode;
export type ResolvedReducedMotion = ResolvedMotionPreference;
export type CubicBezier = import("./types").CubicBezier;
export type DeepPartial<T> = import("./types").DeepPartial<T>;
export type InViewTokens = import("./types").InViewTokens;
export type MotionUITheme = import("./types").MotionUITheme;
export type MotionUIThemeConfig = import("./types").MotionUIThemeConfig;
export type ReducedMotionStrategy = import("./types").ReducedMotionStrategy;
export type StaggerName = import("./types").StaggerName;
export type StaggerTokens = import("./types").StaggerTokens;
export type TransitionName = import("./types").TransitionName;
export type TransitionToken = import("./types").TransitionToken;
export type TransitionTokens = import("./types").TransitionTokens;
export type TravelName = import("./types").TravelName;
export type TravelTokens = import("./types").TravelTokens;
export type UITransition = import("./types").UITransition;
