# 011 — Align portal dropdown motion with its triggers

- **Status**: TODO
- **Commit**: fe423b1
- **Severity**: MEDIUM
- **Category**: Physicality and origin
- **Estimated scope**: 1 file, small

## Problem

Account and notification menus in `src/components/portal/PortalShell.tsx:281-300` and `:461-475` scale from the browser-default center despite opening from top-right header triggers.

## Target

Both panels use `transform-origin: top right`, enter from `scale(0.98) translateY(6px)` to identity in 150 ms, and exit slightly faster. Use full transform strings and strong ease-out. Reduced motion keeps opacity but drops scale/translation.

## Repo conventions to follow

- The shared surface class provides radius only; origin can be set explicitly on these right-aligned dropdowns.
- Portal strong ease-out is `[0.23, 1, 0.32, 1]` / `--portal-ease-out`.

## Steps

1. Import/use `useReducedMotion()` in the relevant portal shell component.
2. Add `origin-top-right` to both dropdown panels.
3. Replace shorthand scale/y animation with full transform strings; use 150 ms entry and 120 ms exit with strong ease-out.
4. For reduced motion, animate opacity only.

## Boundaries

- Do NOT change dropdown positioning, focus management, notification semantics, or z-index.
- Do NOT change the command palette.
- Do NOT add dependencies.

## Verification

- **Mechanical**: defer until all plans finish.
- **Feel check**: use 10% playback and confirm each panel grows from its header trigger; spam open/close and verify clean reversal.
- **Done when**: neither dropdown appears to grow from its center.
