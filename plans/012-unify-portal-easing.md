# 012 — Unify portal easing tokens

- **Status**: TODO
- **Commit**: fe423b1
- **Severity**: MEDIUM
- **Category**: Cohesion and tokens
- **Estimated scope**: 6 files, medium

## Problem

The portal defines `--portal-ease-out: cubic-bezier(0.23, 1, 0.32, 1)` in `src/app/globals.css:243`, but related interactions mix built-in `ease-out`, inline copies, and `[0.16, 1, 0.3, 1]` across `PortalShell.tsx`, `PortalListToolbar.js`, `PortalCommandPalette.js`, `PortalWorkspace.js`, `DashboardPanel.js`, and `EntityModalShell.js`.

## Target

Use `--portal-ease-out` for CSS/Tailwind portal transitions and `[0.23, 1, 0.32, 1]` only where Motion requires an array. Keep modal duration at 250 ms, dropdowns at 120–150 ms, buttons at 150–160 ms, and progress at 200 ms.

## Repo conventions to follow

- The existing token is canonical; do not create a parallel token.
- Modals may retain centered transform origin.

## Steps

1. Replace touched portal `ease-out` and inline cubic-bezier Tailwind classes with `ease-[var(--portal-ease-out)]`.
2. Replace touched `[0.16, 1, 0.3, 1]` Motion arrays with `[0.23, 1, 0.32, 1]`.
3. Limit edits to files already touched by plans 006, 007, and 011 plus the entity-modal transition.
4. Do not alter duration unless another selected plan specifies it.

## Boundaries

- Do NOT sweep public marketing motion.
- Do NOT change modal structure or behavior.
- Do NOT add a new easing token or dependency.

## Verification

- **Mechanical**: defer until all plans finish; search the touched portal files for duplicate curve forms.
- **Feel check**: compare dropdown, modal, toolbar, and progress response; they should share the same fast-starting character without identical durations everywhere.
- **Done when**: touched portal UI uses the canonical curve consistently.
