# 009 — Give circular-menu items a physical entry

- **Status**: TODO
- **Commit**: fe423b1
- **Severity**: HIGH
- **Category**: Physicality
- **Estimated scope**: 1 file, small

## Problem

`src/components/ui/CircularServicesMenu.js:98-115` enters each radial item from literal `scale: 0`, making the item appear from nothing.

## Target

Start hidden items at `scale(0.95)` with opacity 0 and their existing radial translation. Enter to `scale(1)` with opacity 1 using a strong ease-out under 300 ms. Under reduced motion, remove scale/translation movement and retain a brief opacity transition.

## Repo conventions to follow

- Motion client components import from `motion/react`.
- UI entry curve: cubic-bezier equivalent `[0.23, 1, 0.32, 1]`.

## Steps

1. Replace every `scale: 0` target used for radial item entry with `scale: 0.95`.
2. Ensure entry duration is at most 250 ms with strong ease-out.
3. Use `useReducedMotion()` so reduced-motion users receive opacity-only feedback.

## Boundaries

- Do NOT change radial geometry, item ordering, selection, or labels.
- Do NOT alter the center control.
- Do NOT add dependencies.

## Verification

- **Mechanical**: defer until all plans finish.
- **Feel check**: inspect at 10% playback; items should emerge from their radial positions rather than a zero-size point.
- **Done when**: no circular service item enters from `scale(0)`.
