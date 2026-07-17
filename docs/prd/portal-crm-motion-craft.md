# PRD: Portal CRM Motion Craft

**Status:** Ready for agent  
**Triage label:** `ready-for-agent`  
**Parent audit:** CRM portal animation review (find / improve / review skills)  
**Related policy:** `docs/TRANSITION_POLICY.md`  
**Generated:** 2026-07-17

## Problem Statement

Citius Connect staff use the CRM portal hundreds of times per day for queries, proposals, job cards, imports, and approvals. Motion in the portal is mostly restrained and intentional—the command palette opens instantly, press feedback is consistent, and dropdowns scale from their triggers—but several high-traffic feedback surfaces still use Motion shorthand properties (`scale`, `y`, `scaleY`) that run on the main thread instead of the GPU, and portal toasts enter from below but exit upward, breaking spatial consistency.

Staff experience this as subtle sluggishness when toasts stack during saves and bulk actions, and as polish gaps when modals, filter panels, and dashboard sections snap between states. The product already documents a transition policy and enforces it with contract tests for the command palette and global CSS, but portal modal and toast motion is not yet covered by the same guardrails—so regressions can slip in without CI signal.

## Solution

Harden portal CRM motion to match the existing craft bar: GPU-only `transform` and `opacity` on animated portal surfaces, symmetric enter/exit paths where spatial consistency matters, `useReducedMotion()` branching on JS-driven Motion components (not only the global CSS hammer), and contract tests that lock the policy so future portal work cannot reintroduce shorthand or keyboard-initiated animation.

Preserve deliberate restraint: no open/close animation on the command palette, no decorative motion on data tables or KPI cards, and no animation on keyboard-heavy actions. Add motion only where it prevents jarring state changes (occasional surfaces) or provides rare delight (destructive confirm hold-to-fill).

## User Stories

### Corrective (in scope)

1. As a sales user, I want save confirmations to appear and dismiss from the same screen edge, so that toast feedback feels physically anchored and I am not distracted by inconsistent motion.
2. As a contracting user, I want entity modals to open and close smoothly without frame drops when the workspace is busy, so that proposal and query edits feel responsive.
3. As an operations user, I want spreadsheet import modals to animate without stutter, so that large imports feel as reliable as the rest of the portal.
4. As any staff user, I want confirm dialogs (especially destructive ones) to fade in and out cleanly, so that accidental dismissals feel less abrupt.
5. As a staff user with reduced-motion preferences, I want portal toasts and modals to drop positional movement but keep opacity feedback, so that the UI remains comprehensible without vestibular discomfort.
6. As a staff user, I want the filter row on list views to expand and collapse without layout jank, so that filtering dense query and traveller lists feels crisp.
7. As an engineer, I want portal motion anti-patterns caught in CI, so that shorthand `scale`/`y` props cannot merge unnoticed.
8. As an engineer, I want portal motion to reuse the existing `--portal-ease-out` token, so that easing stays cohesive across dropdowns, modals, and toasts.
9. As an engineer, I want the transition policy document updated for portal modal/toast rules, so that contributors know what is allowed before opening a PR.
10. As a director reviewing the portal, I want sidebar active-state indication to feel instant on every navigation, so that daily CRM navigation is not slowed by decorative springs.

### Additive polish (in scope, lower priority)

11. As a staff user on the dashboard, I want collapsible workflow and team sections to expand smoothly, so that collapsing panels do not snap and disorient.
12. As a sales or contracting user on the pipeline board, I want drop zones to highlight progressively when dragging cards, so that valid targets are obvious without instant flash.
13. As a staff user fixing a form error in an entity modal, I want validation errors to fade in, so that the error state change is legible.
14. As a staff user confirming a destructive action, I want a hold-to-confirm interaction on danger buttons, so that accidental deletes require deliberate intent.

### Restraint (must remain true)

15. As a power user, I want the command palette (⌘K / Ctrl+K) to open and close instantly, so that keyboard workflows are never delayed by animation.
16. As a staff user scanning query lists, I want table rows to appear without staggered entrance choreography, so that I can read and act on data immediately.
17. As a staff user, I want KPI stat cards on the dashboard to avoid hover lift animation, so that metrics remain stable while I compare numbers.
18. As a mobile user, I want the portal navigation drawer to slide in at an acceptable occasional-use duration, without bounce that feels playful on operational UI.

## Implementation Decisions

- **Motion library:** Continue using `motion/react` inside existing `LazyMotion` + `MotionConfig` (`ReducedMotionProvider`). No new animation dependencies.
- **Easing token:** Use `cubic-bezier(0.23, 1, 0.32, 1)` via existing `--portal-ease-out` on `.portal-shell` for all new portal transitions. Drawer surfaces may use `cubic-bezier(0.32, 0.72, 0, 1)` where horizontal slide is already established.
- **GPU rule:** Animate `opacity` and full `transform` strings only. Replace Motion `x`, `y`, `scale`, and `scaleY` shorthand props on portal CRM components with `transform: "translateY(...) scale(...)"` form, matching the pattern already used in portal action menus and shell dropdowns.
- **Toast behavior:** Enter and exit from the same edge (bottom of toast stack / safe area). Use percentage `translateY(100%)` for entry offset. Remove `layout` prop on toast items to avoid reflow-driven animation on rapid enqueue/dismiss; prefer CSS transitions or transform-only Motion without layout.
- **Modal family:** Entity modal shell, spreadsheet import modal shell, and confirm dialog share: centered scale + opacity entrance (`scale(0.98)` minimum, never `scale(0)`), backdrop opacity fade, `AnimatePresence` for exit where missing, and `useReducedMotion()` branches that set transform to `none` while keeping opacity transitions.
- **Confirm dialog:** Add backdrop fade and exit animation. Destructive confirms optionally gain hold-to-confirm fill (`clip-path: inset`) in a later slice—only when `danger: true`.
- **Filter toolbar:** Replace `scaleY` shorthand on collapsible filter row with `transform: scaleY(...)` and explicit `transform-origin: top`, or simplify to opacity-only collapse if height animation risks layout cost.
- **Navigation active indicator:** Remove or drastically shorten `layoutId` spring on sidebar active bar (tens-of-times-per-day frequency). Prefer static active styles.
- **Command palette:** No change to instant mount/unmount; contract test must continue to pass.
- **Additive surfaces:** Dashboard collapsible sections use height/opacity transition (occasional). Pipeline drop zones use border/ring color transition only (no scale). Entity modal validation errors use short opacity + subtle translate fade-in.
- **Accessibility:** Branch JS motion with `useReducedMotion()` per component; do not rely solely on global `prefers-reduced-motion` 1ms override for Framer/Motion props. Keep global CSS reduced-motion rules intact.
- **Duration budgets:** UI feedback 100–200ms; modals/drawers 200–250ms; hold-to-confirm deliberate phase up to 2s linear on press only.

## Testing Decisions

- **Principle:** Test external, stable behavior and policy invariants—not Motion's internal prop shapes in isolation. Prefer contract tests that scan portal source for prohibited patterns (highest seam), plus targeted mounted tests only where DOM behavior must be verified.
- **Primary seam (extend, do not fork):** `src/transitionPolicy.contract.test.ts` — add portal CRM motion rules alongside existing command-palette and `transition-all` guards. This is the single highest seam; one file should own portal motion policy assertions.
- **Contract assertions to add:**
  - Portal toast component does not use Motion `y`/`scale` shorthand props; uses `transform` string.
  - Portal modal shells (entity, import, confirm) do not use `y`/`scale` shorthand props.
  - Command palette still has no open/close animation classes on backdrop/panel.
  - Optional: portal list toolbar filter expand does not use `scaleY` shorthand.
- **Prior art:** `src/transitionPolicy.contract.test.ts` (palette, reduced-motion CSS, `transition-all` ban); `src/components/portal/PortalConfirmDialog.mounted.test.jsx` and `EntityModal.mounted.test.jsx` for mounted portal dialog patterns.
- **Out of test scope:** Pixel-perfect animation timing, spring bounce feel, and visual regression of motion curves—cover with manual feel-check steps in ticket acceptance criteria instead.
- **Verification commands:** `bun test src/transitionPolicy.contract.test.ts`, `bun run check` before merge.

## Out of Scope

- Public/marketing site motion (pilgrimage, Sacred Bharat, auth marketing shells, chatbot).
- New animation on command palette, command palette results, or keyboard-initiated navigation.
- Staggered list/table row entrances on CRM list views.
- Dashboard KPI card hover elevation animation.
- Pipeline card drag physics / spring dismissal (native HTML5 DnD stays; only drop-zone highlight transition is in scope).
- Migrating portal components from JavaScript to TypeScript solely for this work.
- Effect library adoption for animation orchestration.
- `plans/` animation plan files from the improve-animations skill (this PRD supersedes ad-hoc plan numbering unless explicitly linked later).
- Visual regression screenshot infrastructure.

## Further Notes

- Audit verdict was **Block** until toast and modal shorthand issues are fixed; command palette discipline and dropdown patterns are already correct.
- `AGENTS.md` portal chrome rules explicitly require command palette to skip open/close animation—any ticket must not regress this.
- Global CSS already sets `:active { transform: none !important }` under reduced motion and provides `.motion-reduce-spatial` for opacity-only feedback; new components should align with these utilities where appropriate.
- Feel-check is mandatory for motion work: slow-motion DevTools playback, rapid toast spam during a save flow, and `prefers-reduced-motion` toggle in Rendering panel.
- Publish status: markdown in `docs/issues/portal-crm-motion-craft-issues.md`; apply `ready-for-agent` when publishing to GitHub if `gh` auth is available.
