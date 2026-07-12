# 006 — Make command-palette selection instant

- **Status**: TODO
- **Commit**: fe423b1
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file, small

## Problem

Keyboard navigation animates the active command on every arrow-key press, adding 150 ms of lag to a 100+-times/day interaction:

```jsx
// src/components/portal/PortalCommandPalette.js:135-156 — current
className={`... transition-[background-color,color] duration-150 ...`}
className={`... transition-[background-color,transform] duration-150 ...`}
```

## Target

Active-row background and icon color change instantly. Keep the button's pointer press feedback through `active:scale-[0.96]`, but transition only `transform` for 150 ms with `var(--portal-ease-out)`.

## Repo conventions to follow

- The command palette intentionally has no open/close animation.
- Portal motion uses `--portal-ease-out: cubic-bezier(0.23, 1, 0.32, 1)` in `src/app/globals.css`.

## Steps

1. In `CommandPaletteIcon`, remove the transition classes so active colors update instantly.
2. In `CommandPaletteItem`, replace the background-and-transform transition with `transition-transform duration-150 ease-[var(--portal-ease-out)]`.
3. Do not alter hover, focus, scrolling, or keyboard behavior.

## Boundaries

- Do NOT animate palette open/close.
- Do NOT change command filtering or keyboard behavior.
- Do NOT add dependencies.

## Verification

- **Mechanical**: defer until all animation plans are implemented; then run targeted tests, typecheck, lint, and React Doctor.
- **Feel check**: hold ArrowDown and confirm selection keeps up instantly; pointer press should still compress subtly.
- **Done when**: keyboard selection has no color/background interpolation.
