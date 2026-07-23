import { createGeneratorEasing, generateLinearEasing, spring } from "motion";
import type {
  CubicBezier,
  MotionUITheme,
  TransitionName,
  TransitionToken,
} from "./types";

// CSS emit: mirror the JS vocabulary as `--motion-ui-*` custom properties so
// pure-CSS states (`:hover`, `[data-state]`) share the exact same feel as the
// JS-driven sections. Each transition token emits both of its channels: the
// fade ease + duration (the common CSS need, colour/opacity
// transitions), and the spring compiled to a `linear()` easing sampled from
// Motion's own spring generator (the same one that drives the JS animations),
// guaranteeing the two channels match.

/** Format a number without a trailing `.0` / exponent, for CSS output. */
function num(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function cubicBezier(points: CubicBezier): string {
  return `cubic-bezier(${points.map(num).join(", ")})`;
}

/**
 * Compile a transition token's spring channel to a CSS `linear()` easing
 * string plus its natural settle duration in seconds, using Motion's spring
 * generator + `generateLinearEasing` (its own exported utilities), so no
 * bespoke sampler is needed.
 */
export function transitionToLinear(token: TransitionToken): {
  easing: string;
  duration: number;
} {
  const easing = createGeneratorEasing(
    { stiffness: token.stiffness, damping: token.damping },
    100,
    spring
  );
  return {
    // generateLinearEasing takes duration in milliseconds.
    easing: generateLinearEasing(easing.ease, easing.duration * 1000),
    duration: easing.duration,
  };
}

/**
 * Emit the theme as a flat record of `--motion-ui-*` custom properties. Per
 * transition token: the fade channel as `--motion-ui-transition-<name>`
 * (`cubic-bezier()`) + `--motion-ui-transition-<name>-duration` (the fade
 * duration, in `s`), and the spring channel as
 * `--motion-ui-transition-<name>-spring` (`linear()`) +
 * `--motion-ui-transition-<name>-spring-duration` (its settle time). Stagger
 * emits in `s`, travel in `px`.
 */
export function themeToCssVars(theme: MotionUITheme): Record<string, string> {
  const vars: Record<string, string> = {};

  const transitionNames = Object.keys(theme.transitions) as TransitionName[];
  for (const name of transitionNames) {
    const token = theme.transitions[name];
    vars[`--motion-ui-transition-${name}`] = cubicBezier(token.ease);
    vars[`--motion-ui-transition-${name}-duration`] = `${num(token.duration)}s`;
    const { easing, duration } = transitionToLinear(token);
    vars[`--motion-ui-transition-${name}-spring`] = easing;
    vars[`--motion-ui-transition-${name}-spring-duration`] = `${num(duration)}s`;
  }

  for (const [name, value] of Object.entries(theme.stagger)) {
    vars[`--motion-ui-stagger-${name}`] = `${num(value)}s`;
  }

  for (const [name, value] of Object.entries(theme.travel)) {
    vars[`--motion-ui-travel-${name}`] = `${num(value)}px`;
  }

  return vars;
}

/**
 * Render the theme's custom properties as a `:root { ... }` CSS block, for a
 * build step or a `<style>` tag.
 */
export function cssVarsToStyleString(theme: MotionUITheme): string {
  const vars = themeToCssVars(theme);
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `:root {\n${body}\n}`;
}
