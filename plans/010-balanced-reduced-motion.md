# 010 — Balance reduced-motion behavior

- **Status**: TODO
- **Commit**: fe423b1
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 files, medium

## Problem

The global rule in `src/app/globals.css:23-31` reduces every animation and transition to 0.01 ms, eliminating useful opacity/color feedback. Conversely, `AnimatedSubmitButton.js:90-103` drives rotation from `useTime()` without an explicit reduced-motion branch, so the JS value can keep changing.

## Target

Reduced motion removes spatial transforms and continuous decorative movement while preserving short opacity/color feedback up to 200 ms. The submit loader must be static when `useReducedMotion()` is true. Existing `MotionConfig` remains in place.

## Repo conventions to follow

- `ReducedMotionProvider.js` already wraps the app with `MotionConfig`.
- Portal command backdrop already removes blur under reduced motion.

## Steps

1. Replace the blanket global duration-zeroing rule with scoped behavior that stops CSS animations/scroll motion but permits short non-spatial transitions.
2. Add reusable reduced-motion selectors for transform-based utility motion used by the touched components, without trying to rewrite every marketing animation in this plan.
3. In `AnimatedSubmitButton.js`, import and use `useReducedMotion`; keep loader rotation at zero/static when requested.
4. Confirm plans 007 and 009 branch their spatial movement appropriately.

## Boundaries

- Do NOT remove `ReducedMotionProvider` or `MotionConfig`.
- Do NOT disable all visual feedback.
- Do NOT add dependencies.

## Verification

- **Mechanical**: defer until all plans finish.
- **Feel check**: emulate reduced motion; colors and opacity may respond briefly, while dashboard, circular-menu, and loader movement stop.
- **Done when**: reduced motion is gentler rather than visually dead, and no touched continuous loader rotates.
