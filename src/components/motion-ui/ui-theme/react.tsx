"use client";

import { useReducedMotion } from "motion/react";
import { createContext, createElement, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { defaultTheme } from "./presets";
import { resolveReducedMotion } from "./reduced-motion";
import type { MotionMode } from "./reduced-motion";
import type { MotionUITheme, TransitionName, UITransition } from "./types";

// React bindings. Everything falls back to the bundled `defaultTheme` when no
// provider is mounted, so a section is always usable standalone (a buyer can
// paste one section in with no setup and it still reads a coherent theme).

const UIThemeContext = createContext<MotionUITheme | null>(null);

export interface MotionUIThemeProviderProps {
  theme?: MotionUITheme;
  children: ReactNode;
}

/**
 * Provide a theme to every Motion UI section below it. Omitting `theme` supplies
 * the default (`productive`), which is also what `useMotionUITheme` returns
 * with no provider present, so wrapping is optional.
 */
export function MotionUIThemeProvider({
  theme,
  children,
}: MotionUIThemeProviderProps) {
  const value = theme ?? defaultTheme;
  return createElement(UIThemeContext.Provider, { value }, children);
}

function useThemeContext(): MotionUITheme {
  return useContext(UIThemeContext) ?? defaultTheme;
}

/** The active theme plus the resolved runtime motion posture. */
export interface ResolvedMotionUITheme extends MotionUITheme {
  /**
   * The posture resolved from the visitor's reduced-motion preference and the
   * theme's configured `reducedMotion` strategy.
   */
  motionMode: MotionMode;
}

/**
 * Read the active Motion UI theme and its resolved runtime motion posture.
 * Returns `defaultTheme` when no provider is mounted.
 *
 * `reducedMotion` remains the configured fallback (`"calm"` or `"off"`).
 * `motionMode` is the posture currently in effect (`"full"`, `"calm"` or
 * `"off"`), so components do not need their own reduced-motion hook.
 */
export function useMotionUITheme(): ResolvedMotionUITheme {
  const theme = useThemeContext();
  const prefersReducedMotion = !!useReducedMotion();
  const motionMode = resolveReducedMotion(theme, prefersReducedMotion).strategy;

  return useMemo(() => ({ ...theme, motionMode }), [theme, motionMode]);
}

/**
 * Resolve a named transition to a Motion-compatible transition object, ready
 * to spread into `transition` on a `motion` component. Works with no provider
 * (falls back to the default).
 *
 * The result carries both channels of the token: the spring
 * (`stiffness` + `damping`) drives travel and preserves velocity across
 * interruptions, and a baked per-value
 * `opacity` tween fades over the same perceived duration so both land
 * together. The fade is deliberately LINEAR (the token's `ease` stays for
 * colour and CSS channels): opacity is perceptually compressed, so an eased
 * fade front-loads visibility and reads as a pop; linear is what looks
 * evenly paced. `{ ...transition, type: "tween" }` degrades to an eased
 * tween over the token's duration.
 */
export function useMotionUITransition(name: TransitionName): UITransition {
  const theme = useThemeContext();
  const token = theme.transitions[name];
  return useMemo(() => {
    const { duration, stiffness, damping, ease } = token;
    return {
      type: "spring",
      stiffness,
      damping,
      duration,
      ease,
      // inherit: true lets consumer-added top-level keys (repeat, delay,
      // times, ...) reach the opacity channel; without it Motion resolves a
      // per-value transition INSTEAD of the top level, so a spread pulse
      // would play its fade exactly once.
      opacity: { type: "tween", duration, ease: "linear", inherit: true },
    };
  }, [token]);
}
