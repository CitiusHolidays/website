# Issues: Portal CRM Motion Craft

**Parent PRD:** `docs/prd/portal-crm-motion-craft.md`  
**Policy:** `docs/TRANSITION_POLICY.md`  
**Publish status:** Markdown only — apply `ready-for-agent` label when publishing to tracker  
**Generated:** 2026-07-17

---

## Issue 01 — Portal motion contract guardrails

**Blocked by:** None — can start immediately  
**Status:** ready-for-agent

### What to build

Extend the existing transition policy contract test seam so portal CRM motion regressions fail CI before merge. Assertions cover: no Motion `x`/`y`/`scale`/`scaleY` shorthand on portal toast and modal components; command palette still mounts without open/close animation classes; portal easing continues to reference `--portal-ease-out` where portal toolbar/button transitions are declared.

The test file should fail on the current codebase until Issues 02–03 land (TDD gate), or assertions should be scoped to only the components fixed in parallel—prefer failing assertions that document the target state.

### Acceptance criteria

- [ ] `src/transitionPolicy.contract.test.ts` includes portal CRM motion assertions (toast, entity modal shell, import modal shell, confirm dialog, list toolbar filter expand)
- [ ] Command palette no-animation contract from existing test still passes
- [ ] `bun test src/transitionPolicy.contract.test.ts` documents expected failures or passes after downstream fixes
- [ ] `docs/TRANSITION_POLICY.md` updated with a short portal modal/toast subsection referencing the contract

---

## Issue 02 — Portal toast spatial consistency and GPU motion

**Blocked by:** Issue 01  
**Status:** done (local)

### Acceptance criteria

- [x] Toast enter/exit use symmetric bottom-edge `transform` path (`translateY` percentages, not opposing directions)
- [x] No `scale`, `y`, or `layout` Motion shorthand on toast items
- [x] `useReducedMotion()` drops transform movement; opacity feedback remains
- [x] Duration ≤ 200ms with `cubic-bezier(0.23, 1, 0.32, 1)` (or `--portal-ease-out`)
- [x] Issue 01 toast contract assertions pass
- [ ] Feel-check: rapid toast spam during a mutation does not restart animations from zero or exit upward
- [ ] `bun run check` passes

---

## Issue 03 — Portal modal and confirm dialog motion craft

**Blocked by:** Issue 01

### What to build

End-to-end fix for occasional modal surfaces: entity modal shell, spreadsheet import modal shell, and confirm dialog use GPU `transform` strings, `useReducedMotion()` branches, backdrop opacity fade, and `AnimatePresence` exit where missing. Staff opening queries, imports, and destructive confirms get smooth, accessible motion without main-thread shorthand.

### Acceptance criteria

- [ ] Entity modal, import modal, and confirm dialog use `transform` strings (no `scale`/`y` shorthand)
- [ ] Confirm dialog has backdrop fade and exit animation via `AnimatePresence`
- [ ] All three surfaces branch on `useReducedMotion()`
- [ ] Modal entrance uses `scale(0.98)` + opacity minimum (never `scale(0)`)
- [ ] Issue 01 modal contract assertions pass
- [ ] Existing `EntityModal.mounted.test.jsx` and `PortalConfirmDialog.mounted.test.jsx` still pass
- [ ] Feel-check: open/close entity modal and confirm dialog under reduced motion
- [ ] `bun run check` passes

---

## Issue 04 — List toolbar, chrome polish, and nav active state

**Blocked by:** Issue 02, Issue 03

### What to build

Complete remaining corrective portal CRM motion: filter row expand on list toolbars without `scaleY` shorthand, notification badge and any remaining portal chrome shorthand fixes, and simplify sidebar `layoutId` active indicator to static styles (no spring on every route change). Staff filtering queries/travellers and navigating daily see snappier chrome.

### Acceptance criteria

- [ ] `PortalListToolbar` filter expand uses GPU transform or opacity-only collapse with `transform-origin: top`
- [ ] Notification unread badge uses `transform` string if animated
- [ ] Sidebar active indicator no longer uses `layoutId` spring (static active bar or ≤200ms non-spring transition)
- [ ] Issue 01 list-toolbar contract assertions pass
- [ ] Command palette still has zero open/close animation
- [ ] Feel-check: expand/collapse filters on a heavy list view; click through 5+ nav items
- [ ] `bun run check` passes

---

## Issue 05 — Occasional-surface motion polish (dashboard, pipeline, errors)

**Blocked by:** Issue 04

### What to build

Additive motion for occasional CRM surfaces only: dashboard collapsible workflow/team sections animate height/opacity instead of snapping; pipeline board drop zones transition border/ring highlight on drag-over; entity modal validation errors fade in. No new motion on high-frequency list rows or KPI cards.

### Acceptance criteria

- [ ] `DashboardCollapsibleSection` expand/collapse uses ≤200ms ease-out height/opacity (reduced-motion: opacity only or instant)
- [ ] Pipeline stage columns transition border/ring color on drag-over (no scale/bounce)
- [ ] Entity modal error alert fades in on appearance
- [ ] No stagger or entrance animation added to data tables or dashboard stat cards
- [ ] Feel-check: collapse dashboard section; drag pipeline card across columns; trigger modal validation error
- [ ] `bun run check` passes

---

## Issue 06 — Destructive confirm hold-to-fill (optional delight)

**Blocked by:** Issue 03

### What to build

Rare-frequency safety interaction: when `PortalConfirm` is invoked with `danger: true`, the confirm button requires a brief hold (clip-path fill overlay, ~2s linear press / 200ms ease-out release) before the action runs. Non-danger confirms remain single-click. Staff get extra slip protection on bulk delete and irreversible CRM actions.

### Acceptance criteria

- [ ] Hold-to-confirm only applies when `danger: true`
- [ ] Press phase ~2s linear; release snaps back in ~200ms `cubic-bezier(0.23, 1, 0.32, 1)`
- [ ] Reduced motion: shorten or replace with opacity pulse—movement not required
- [ ] Cancel and Escape still work during hold
- [ ] `PortalConfirmDialog.mounted.test.jsx` covers danger vs non-danger behavior
- [ ] Feel-check: attempt accidental click vs deliberate hold on a destructive confirm
- [ ] `bun run check` passes

---

## Recommended execution order

```
01 (contract) ──┬──► 02 (toasts) ──┐
                └──► 03 (modals) ──┼──► 04 (chrome) ──► 05 (polish)
                          └──► 06 (hold confirm, optional)
```

Work the frontier: 01 first, then 02 and 03 in parallel, then 04, then 05. Issue 06 can start after 03 if prioritizing safety over 04/05.
