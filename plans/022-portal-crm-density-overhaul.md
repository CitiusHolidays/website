# Plan 022: Portal CRM density and chrome overhaul

> **Executor instructions**: Follow this plan step by step on **`main`** (no feature
> branches unless your operator explicitly asks). Run every verification command
> and confirm the expected result before moving to the next step. If anything in
> the "STOP conditions" section occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 95cb879..HEAD -- src/components/portal src/app/portal src/app/globals.css src/lib/portal`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (features 016–019 are DONE; this plan refines their UX)
- **Category**: direction
- **Planned at**: commit `95cb879`, 2026-06-12

## Why this matters

Plans 016–019 shipped saved views, a command palette, job-card command center,
and capacity nudges — but each added its own horizontal or vertical band. List
pages now stack **PageHeader** (hero title + filter scroll row + search row),
a **Command** button, quick actions, and **SavedViewsBar** before the first table
row. The dashboard repeats titles and nests bordered cards inside cards. Staff
lose **~430px** from page title to first table row on `/portal/queries` at
1500×914 (browser-measured 2026-06-12); the CRM feels crowded at the top and
empty below the fold.

This plan delivers one cohesive **operational density** language: compact
toolbars, sidebar-first pinning, palette-first actions, flatter dashboard
surfaces, and aligned spacing tokens — without removing any shipped capability.

## Design direction (read before coding)

**Design read:** B2B travel CRM for sales/contracting/ops/ticketing staff, with
a calm **Linear-style operational** language — not marketing landing chrome.

| Dial | Target | Meaning for this plan |
|------|--------|------------------------|
| Visual density | **8** | Cockpit: prioritize data rows and KPIs over hero type |
| Motion | **3** | Reduce entrance animations on work surfaces; keep ≤200ms feedback |
| Variance | **5** | Symmetric toolbars; no decorative asymmetry on list pages |

**Hard product constraints from `AGENTS.md` (do not violate):**

- Portal dates stay **DD/MM/YYYY** via `formatDisplayDate` / `PortalDateInput`.
- Inverted From/To on date-range filters must **error**, not silently swap.
- Filter/date changes must **not shift** quick-action button layout.
- Dashboard: **no hero gradients**, avoid heavy card border outlines.
- Dashboard **PageHeader search is hidden** — keep it off dashboard.
- Notification read only on click — do not change notification behavior.
- Use `motion/react` inside `LazyMotion`; render `m` components, not `motion`.
- Read `.claude/skills/motion/SKILL.md` before adding portal animation.
- After frontend changes pass tests, run `bunx react-doctor@latest --verbose`
  and fix findings incrementally (one bounded pass per session).

**Visual rules for this overhaul:**

- List page titles: `text-xl font-semibold` (not `text-3xl md:text-4xl`).
- Remove list subtitles on filter-heavy views (nav label is enough).
- One **sticky** toolbar row per list view; filters collapse behind a
  **Filters** control when more than three controls would show.
- Saved views: **sidebar Pinned** + command palette — not a persistent chip row.
- Command palette: **⌘K / Ctrl+K only** in list headers (icon ghost optional);
  show `⌘K` hint in sidebar footer, not a full "Command" pill button.
- Dashboard: **no outer PageHeader**; `DashboardHero` is the sole greeting.
- Prefer **dividers** over nested `rounded-xl border shadow-sm` cards on dashboard.
- Job card page: inherit shell padding; no nested `<main>`.
- Dashboard stat cards: **no featured gradient** (`DashboardStatCard` `featured`
  prop must not use `bg-linear-to-br` — AGENTS.md).
- Job cards list: prefer **compact table/row** over tall card grid for ops scanning.
- Command center checklist: default **collapsed** with progress summary.

## Browser verification (2026-06-12, localhost:3000)

Verified signed-in as multi-role staff (Admin + three Head roles) in Cursor browser.

| Page | Confirmed | Measurement / note |
|------|-----------|------------------|
| `/portal` | Duplicate **Dashboard** H1 + **Good morning** H2 | Command button visible; 4 create buttons + period presets + date From/To in one hero card |
| `/portal/queries` | Title + subtitle + filters + search + Command + Save view before table | **~433px** title→first row; only **2 data rows** visible at 914px height |
| `/portal/queries` | Table wider than main column | Table `scrollWidth` **1544px** vs main **1244px** (~300px overflow) |
| `/portal/job-cards` | Same header stack + **card grid** (not table) | Single JC card shows **7 action buttons**; card ~2× viewport height |
| `/portal/job-cards/:id` | Command center loads | 13 checklist tasks **all expanded**; blockers/next actions plain text; nested padding |
| All portal pages | Next.js **hydration error** overlay | Points at `PortalShell.js:120` (skip link tree); likely `PortalNav` localStorage SSR mismatch |
| Dashboard KPI | **Active queries** card uses blue gradient | `DashboardStatCard.js:43` `featured` + `bg-linear-to-br` — violates AGENTS.md |
| Header | Role pill shows 4 roles joined with `/` | Truncates on smaller widths; competes with logo/user block |

## Current state

### List header stacking

- `src/components/portal/PortalWorkspace.js`:
  - `PortalWorkspaceHeader` renders `PageHeader` then `SavedViewsBar` at lines
    637–691.
  - `PageHeader` uses `mb-8 gap-5` and `text-3xl md:text-4xl` at lines
    1383–1392.
  - Filter row is `flex-nowrap overflow-x-auto` at line 1400.
  - Command button + quick actions sit in PageHeader children at lines
    677–679.
- `src/components/portal/SavedViewsBar.js` always adds `mb-4` row; save uses
  `window.prompt` at lines 14–18.
- `src/components/portal/PortalCommandPalette.js` renders visible "Command"
  button at lines 82–85; does **not** pass `buildRecentRecordCommands` (defined
  in `src/lib/portal/commandPalette.js:30–47`).

### Dashboard duplication

- Dashboard still uses full `PageHeader` via `PortalWorkspaceHeader` (search
  hidden via `showSearch={w.view !== "dashboard"}` at line 644).
- `DashboardView` wraps hero + actions + stats in one bordered card at lines
  469–482, then a 2-column grid + capacity heatmap at lines 484–505.
- `DashboardHero` already uses compact `text-xl md:text-2xl` at
  `src/components/portal/dashboard/DashboardHero.js:14–16`.

### Job card command center

- `src/app/portal/job-cards/[jobCardId]/page.js` nests `<main>` with extra
  padding inside `PortalShell`'s `<main className="… p-4 md:p-8 lg:p-10">`.
- `JobCardCommandCenter.js` is read-only status blocks; blockers/actions are
  plain `<p>` tags at lines 54–68.

### Sidebar

- `PortalShell.js` `PortalNav` has recent-record shortcuts per nav item (lines
  329–503 area) but **no saved-view favorites** section (plan 016 step 5 was
  deferred).

### Dead code

- `DashboardQueryTypeBreakdown` in `PortalWorkspace.js` at line 1475 is never
  rendered (live dashboard uses `DashboardQueryTypeTabs` in `DashboardView.js`).

### Button / spacing tokens

- `src/app/globals.css` portal buttons use `min-height: 2.5rem` and
  `border-radius: 9999px` at lines 130–167.
- Inconsistent section gaps: `mb-8`, `mb-4`, `space-y-5`, `space-y-6` across
  portal surfaces.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused unit tests | `bun test src/lib/portal/commandPalette.test.js src/lib/portal/savedViews.test.js src/components/portal/portalWorkspaceContract.test.js` | exit 0 |
| Full tests | `bun test` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| React frontend check | `bunx react-doctor@latest --verbose` | no new portal regressions |
| Convex (only if saved-view sidebar query changes) | `bunx convex codegen` | exit 0 |

## Suggested executor toolkit

- Skills: `.claude/skills/motion/SKILL.md` (animation), `.claude/skills/react-doctor/SKILL.md`
  (post-change scan), `ui-skills` (density, no layout animation, inline errors).
- Browser: visually verify `/portal/queries`, `/portal`, `/portal/job-cards`,
  and one job-card detail after layout changes.

## Scope

**In scope**:

- `src/app/globals.css` — portal density tokens (compact control heights)
- `src/components/portal/PortalListToolbar.js` (create) — unified list header
- `src/components/portal/PortalWorkspace.js` — wire toolbar; remove dead breakdown
- `src/components/portal/SavedViewsBar.js` — demote or remove from list pages
- `src/components/portal/PortalCommandPalette.js` — recent commands, compact trigger
- `src/components/portal/PortalShell.js` — Pinned section, ⌘K hint, shortcut cap, hydration fix
- `src/components/portal/dashboard/DashboardView.js` and related dashboard/*
- `src/components/portal/dashboard/DashboardQuickActions.js`
- `src/components/portal/dashboard/DashboardStatCard.js` — remove featured gradient
- `src/app/portal/job-cards/[jobCardId]/page.js`
- `src/components/portal/jobCard/JobCardCommandCenter.js`
- `src/components/portal/PortalWorkspace.js` — `JobCardsView` table refactor
- `src/lib/portal/commandPalette.js` / `.test.js` if command groups change
- `src/components/portal/usePortalWorkspaceState.js` — pass saved views to shell
- Tests listed above; update `portalWorkspaceContract.test.js` if header contract changes

**Out of scope**:

- Backend schema changes (saved views API already exists).
- Interactive task toggles / new Convex mutations for job-card tasks (defer to
  follow-up; this plan is layout/UX only for command center).
- Pipeline drag-and-drop, server pagination (separate backlog).
- Sacred Bharat, payment, or non-portal marketing pages.
- Editing files under `plans/` except `plans/README.md` status row.

## Git workflow

- **Branch:** work on **`main`** (operator request — no `codex/*` branch).
- Commit per phase below; message style from recent history:
  `Refactor portal list toolbar for compact CRM density`.
- Do **not** push unless the operator asks.

---

## Phase 1 — Density tokens and shared toolbar shell

### Step 1.1: Add portal density CSS variables

In `src/app/globals.css`, add a `@layer components` block (after existing
`.portal-*` rules) defining:

```css
:root {
  --portal-toolbar-height: 2.75rem;   /* 44px */
  --portal-section-gap: 1rem;         /* 16px — was 20–32px mixed */
  --portal-page-title-size: 1.25rem;  /* text-xl */
  --portal-surface-radius: 0.5rem;    /* rounded-lg — align job card + lists */
}
.portal-toolbar-control {
  min-height: var(--portal-toolbar-height);
  border-radius: 0.5rem; /* not full pill on dense toolbars */
}
.portal-page-title {
  font-size: var(--portal-page-title-size);
}
```

Add a compact variant `.portal-toolbar-btn` at `min-height: 2.25rem` for
toolbar actions. **Do not** change global marketing site buttons outside
portal.

**Verify**: `bun run lint` → exit 0.

### Step 1.2: Create `PortalListToolbar.js`

Create `src/components/portal/PortalListToolbar.js` — a single sticky band:

```
┌─────────────────────────────────────────────────────────────────┐
│ Title                    [Filters ▾] [Search…] [⌘K] [Primary +] │
└─────────────────────────────────────────────────────────────────┘
```

Props (match what `PageHeader` + header children need today):

- `title`, `search`, `setSearch`, `showSearch`
- `dateRange`, `setDateRange`, `showPeriodFilter`
- `listFilterConfig`, `listFilters`, `setListFilterValue`, `filterSourceRows`
- `showJobCardFilter`, `jobCardFilter`, `setJobCardFilter`, `jobCards`
- `filtersActive`, `onClearAllFilters`
- `commandPalette` (React node — `<PortalCommandPalette … />`)
- `actions` (React node — existing `HeaderActions`)

Layout rules:

- Outer: `sticky top-16 z-[portal chrome layer] bg-brand-light/95 backdrop-blur-sm border-b border-brand-border py-2 mb-4`
- Title row + controls on one line at `lg+`; stack only on `sm`.
- **Filters panel**: collapsed by default when
  `(showPeriodFilter ? 2 : 0) + listFilterConfig.length + (showJobCardFilter ? 1 : 0) > 3`.
  Expanding filters must **not** move the actions row (use absolute or grid with
  fixed action column — satisfy AGENTS.md layout-stability rule).
- Date-range invalid state: show error **inline on To field** (badge/tooltip),
  not a new block below the row — update `PortalDateRangeFilter.js` if needed.
- Title uses `portal-page-title font-heading font-semibold text-citius-blue`.
- **No subtitle** prop on toolbar (drop from list views).

Use `motion/react` only for filter panel expand/collapse (`opacity` + `transform`,
≤200ms). Read motion skill first.

**Verify**: `bun run lint` → exit 0; component exports default.

---

## Phase 2 — Wire list pages to compact toolbar

### Step 2.1: Replace PageHeader in `PortalWorkspaceHeader`

In `PortalWorkspace.js`:

1. Import `PortalListToolbar`.
2. Replace `<PageHeader …>` + inner command/actions wrapper with
   `<PortalListToolbar …>`.
3. **Remove** `<SavedViewsBar />` from list header entirely (lines 683–691).
4. Keep `PageHeader` function temporarily only if settings/team views still need
   it; otherwise delete `PageHeader` and migrate all callers to toolbar.
5. Delete unused `DashboardQueryTypeBreakdown` function (~line 1475).

Pass saved-view handlers to shell instead (Step 3).

**Verify**:

- `bun test src/components/portal/portalWorkspaceContract.test.js` → pass
- `grep -n "SavedViewsBar" src/components/portal/PortalWorkspace.js` → no import usage

### Step 2.2: Compact command palette trigger

In `PortalCommandPalette.js`:

1. Replace full "Command" pill with **icon-only** button:
   `aria-label="Open command palette (⌘K)"`, `className="portal-toolbar-btn …"`.
2. Pass `navShortcuts` from workspace; append
   `...buildRecentRecordCommands({ navShortcuts: workspace.navShortcuts })`
   to the commands array (group "Recent").
3. Optional: render `⌘K` kbd hint inside sidebar (Step 3), not in toolbar.

Update `commandPalette.test.js` if command ordering/group tests exist.

**Verify**: `bun test src/lib/portal/commandPalette.test.js` → pass.

---

## Phase 3 — Sidebar: Pinned views + shortcut cap

### Step 3.1: Add Pinned section to `PortalShell`

In `PortalShell.js`:

1. Accept optional props from layout/workspace:
   `savedViews`, `onApplySavedView`, `onSaveCurrentView`, `onDeleteSavedView`,
   `onToggleSavedViewFavorite`, `currentViewKey` — or use a small context if
   prop drilling from `portal/layout.js` is cleaner (prefer matching existing
   portal patterns in `usePortalWorkspaceState.js`).

2. Below nav groups, render **Pinned** section when
   `savedViews.filter(v => v.isFavorite).length > 0`:
   - Max **5** favorites visible; "Manage in palette" link or overflow.
   - Each item: truncate name, click applies view (same as SavedViewsBar).

3. Footer hint: `⌘K` command palette (text-xs, muted).

4. Cap **recent nav shortcuts** to **3 items** per nav entry; add "Show all"
   only if more exist (reduce sidebar scroll height).

5. Replace `window.prompt` save flow: add minimal popover/dialog component
   `SaveViewDialog.js` (create) — single text field + Save/Cancel; call from
   palette action "Save current view" and sidebar "+" if present.

Wire favorites from `usePortalWorkspaceState` saved view mutations (already exist
from plan 016).

**Verify**:

- `bun test src/lib/portal/savedViews.test.js` → pass
- Manual: favorite a view on `/portal/queries` → appears under Pinned in sidebar

---

## Phase 4 — Dashboard de-chrome

### Step 4.1: Skip PageHeader on dashboard

In `PortalWorkspaceHeader`, when `w.view === "dashboard"`, render **nothing**
from the list toolbar (no title band). Dashboard owns its own header via
`DashboardHero`.

**Verify**: `/portal` has one greeting heading, not two.

### Step 4.2: Flatten `DashboardView` layout

In `DashboardView.js`:

1. Remove outer bordered wrapper around hero + actions + stats (lines 469–482).
   Use `space-y-4` sections with `border-b border-brand-border/70 pb-4` dividers.
2. Merge quick actions + period presets into **one row**:
   `flex flex-wrap items-center justify-between gap-3` — no inner `border-t pt-5`.
3. For non-director personas (`dashboardPersona.js`), default collapsed:
   - `queryTypes` + `pipeline` → single **Pipeline & types** collapsible section.
4. Right rail (`inbox`, `ticketingQueue`, `readiness`): keep on `xl+` only;
   stack below main column on smaller breakpoints (remove fixed `20rem` squeeze
   on `md`).
5. Capacity heatmap: wrap in `DashboardCollapsibleSection` default **collapsed**
   for non-Head roles.

In `DashboardQuickActions.js`: replace horizontal scroll row with:
- Primary persona action as `portal-primary-btn`
- Remaining actions behind **Create ▾** menu (reuse modal open handlers)

**Verify**:

- `bun test src/lib/portal/dashboardLinks.test.js` → pass (if exists)
- Dashboard persona sections still render (spot-check sales vs director in code)

---

## Phase 5 — Job card page alignment

### Step 5.1: Remove nested main wrapper

In `src/app/portal/job-cards/[jobCardId]/page.js`, replace body with:

```jsx
<div className="mx-auto max-w-7xl">
  <JobCardCommandCenter jobCardId={jobCardId} />
</div>
```

No `<main>`, no extra `px-4 py-6`, no `bg-portal-bg`.

### Step 5.2: Compact command center layout

In `JobCardCommandCenter.js`:

1. Use `space-y-4` (not `space-y-6`); sections `rounded-lg` consistent with
   `--portal-surface-radius`.
2. Header band: single row — job code (title size `text-xl`), client,
   destination, travel dates/status if present on `payload.jobCard`.
3. Blockers / next actions: render as **compact list rows** with link styling
   when `action.href` exists in model (check `jobCardCommandCenter.js`); keep
   read-only if no href.
4. **Checklist tasks:** default collapsed; show `0 / 13 complete` summary row;
   expand on click (use `DashboardCollapsibleSection` pattern or similar).
5. Do **not** add task mutation UI in this plan — display-only task board is OK.

**Verify**: job card page horizontal padding matches `/portal/queries`; checklist
section collapsed by default in browser.

### Step 5.3: Job cards list — compact row/table layout

`JobCardsView` in `PortalWorkspace.js` (line ~2554) uses a **3-column card grid**
with hover lift animation and up to **7 buttons per card**. Browser shows one card
consumes most of the viewport.

Refactor to match queries/travellers pattern:

1. Use `SelectableDataTable` (or a slim row component) with columns: Job code,
   Client, Destination, Status, Owners (combined or tooltip), Opened, Actions.
2. Primary row action: **Open** (command center). Secondary actions move to a
   **⋯ menu** or command palette — not 6 inline pills.
3. Remove `whileHover={{ y: -4 }}` card animation on list surfaces (motion skill:
   no layout-adjacent hover lift on data tables).

**Verify**: `/portal/job-cards` shows ≥3 job cards above fold at 914px height
(when data exists); no card grid at `xl`.

---

## Phase 6 — Dashboard gradient + table overflow

### Step 6.1: Remove dashboard KPI gradient

In `src/components/portal/dashboard/DashboardStatCard.js`, remove `featured`
gradient styling (`bg-linear-to-br from-citius-blue…`). Use the same white card
treatment as other KPIs; differentiate "Active queries" with icon/accent border
only (orange left border or citius-blue icon — no gradient fill).

Update `DashboardView` caller if it passes `featured={true}`.

**Verify**: `/portal` — no blue gradient on Active queries card (screenshot).

### Step 6.2: Queries table horizontal fit

On `/portal/queries`, table `scrollWidth` exceeds main width by ~300px. In
`QueriesView` / `SelectableDataTable` column config:

1. Hide or combine low-priority columns behind a row expander on `md` breakpoints
   (candidates: Submitted + Confirmed → single "Dates" column; Budget + Margin →
   tooltip on Pax).
2. Ensure table wrapper uses `overflow-x-auto` on the table only, not the
   whole page; sticky first column (Query ID) optional if quick win.

**Verify**: CDP or browser — table `scrollWidth` ≤ main `clientWidth + 40` at
1500px viewport, or intentional scroll contained in table region.

---

## Phase 7 — Fix portal hydration mismatch

Browser shows React hydration error on `/portal/queries`, `/portal/job-cards`, and
job-card detail. Stack references `PortalShell.js:120`.

Investigate `PortalNav` in `PortalShell.js`:

- `readStoredSet` for nav expand/collapse runs in `useState` initializers
  (lines ~330–337) — client-only localStorage differs from SSR empty state.
- Fix pattern: initialize empty on server/first render; `useEffect` hydrate from
  localStorage after mount (accept brief collapsed flash), **or** use
  `suppressHydrationWarning` only on the specific dynamic nav subtree if needed.

**Verify**:

1. Hard refresh `/portal/queries` — **no** Next.js hydration overlay in dev.
2. `bun test` still passes.

---

## Phase 8 — Cleanup, tests, visual QA

### Step 8.1: Remove or archive `SavedViewsBar.js`

If no imports remain, delete file. If palette/sidebar needs save UI only, keep
file but export only dialog helper — **not** the chip bar.

### Step 8.2: Update contract tests

Update `portalWorkspaceContract.test.js` to assert:

- List views expose sticky toolbar (not `text-3xl` PageHeader).
- Dashboard does not duplicate page title in workspace header.

### Step 8.3: Full verification gate

Run in order:

1. `bun test` → all pass
2. `bun run lint` → exit 0
3. `bunx react-doctor@latest --verbose` → fix any new **error**-level portal
   findings (one bounded pass)
4. Browser check (dev server):
   - `/portal/queries`: first table row visible without scroll on ~900px height
   - `/portal`: single hero, KPIs above fold
   - `/portal/job-cards/{id}`: no double padding
   - ⌘K opens palette with Recent + Saved views groups
   - Date From > To shows inline error without shifting action buttons

### Step 8.4: Update plan index

Set plan 022 status to `DONE` in `plans/README.md`.

---

## Test plan

- Extend `commandPalette.test.js`: Recent group appears when navShortcuts passed.
- Extend `savedViews.test.js` if sidebar favorite filtering logic moves to lib.
- Update `portalWorkspaceContract.test.js` for header contract.
- No new Convex tests unless shell queries change shape.

## Done criteria

ALL must hold:

- [ ] List views use `PortalListToolbar`; no `SavedViewsBar` chip row on lists
- [ ] List titles are `text-xl` or token equivalent — no `text-3xl` on lists
- [ ] Command palette includes Recent commands; list header has no "Command" text pill
- [ ] Saved view favorites appear in sidebar Pinned (max 5 visible)
- [ ] Save view uses dialog/popover — no `window.prompt`
- [ ] Dashboard has no duplicate PageHeader title; flatter section layout
- [ ] Job card page has no nested `<main>` or extra shell padding
- [ ] Job cards list uses compact table/rows (not 3-column card grid)
- [ ] Dashboard Active queries KPI has no gradient fill
- [ ] Queries table overflow contained or columns reduced at 1500px width
- [ ] No React hydration overlay on hard refresh of `/portal/queries`
- [ ] Command center checklist collapsed by default
- [ ] `DashboardQueryTypeBreakdown` removed from PortalWorkspace.js
- [ ] `bun test` and `bun run lint` exit 0
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report (do not improvise) if:

- Live code does not match "Current state" excerpts after drift check.
- Applying sticky toolbar breaks portal z-index stacking (modals/notifications
  hidden) — read `src/lib/portal/zIndex.js` and fix scale before continuing.
- Saved view API shape differs from plan 016 (`savedViews` missing
  `isFavorite` / `canMutate`) — report actual schema.
- Filter layout stability cannot be achieved without redesigning
  `PortalDateRangeFilter` — stop after documenting blocker with screenshot.
- Any step verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Future list features (pagination, bulk bar) should extend `PortalListToolbar`
  action slot — do not reintroduce a second header row.
- New saved-view surfaces belong in sidebar Pinned + palette, not header chips.
- Dashboard panels: prefer collapsible sections over new bordered cards.
- Job card task **interactivity** (plan 018 tabs/mutations) is a follow-up plan;
  this overhaul must not block on Convex changes.
- Reviewers should scrutinize: sticky offset vs `top-16` header, filter panel
  a11y (focus trap when expanded), and mobile toolbar wrap behavior.

## Findings addressed (audit summary)

| ID | Issue | Addressed in phase |
|----|-------|-------------------|
| direction-01 | 3–4 header bands before table | 1–2 |
| direction-02 | Oversized list typography | 1–2 |
| direction-03 | Filter horizontal scroll + error line | 1.2 |
| direction-04 | SavedViewsBar chrome + prompt | 2–3 |
| direction-05 | Command button + missing Recent | 2.2 |
| direction-06 | Dashboard duplicate titles | 4.1 |
| direction-07 | Dashboard nested cards | 4.2 |
| direction-08 | Quick actions horizontal scroll | 4.2 |
| direction-09 | Job card read-only (partial) | 5.2 layout only |
| direction-10 | Double main on job card route | 5.1 |
| direction-11 | Inconsistent spacing tokens | 1.1 |
| direction-12 | Job cards card grid + 7 buttons/card | 5.3 |
| direction-13 | Dashboard KPI gradient on featured stat | 6.1 |
| direction-14 | Queries table 300px wider than main | 6.2 |
| direction-15 | Command center 13 tasks always expanded | 5.2 |
| correctness-01 | Portal hydration error (PortalNav storage) | 7 |
| tech-debt-01 | Dead DashboardQueryTypeBreakdown | 2.1 |
| performance-01 | Sidebar shortcut height | 3.1 |

## Findings deferred (not in this plan)

- **Job card interactive tasks/tabs** (plan 018 full spec): needs Convex
  mutations — separate plan after this UX lands.
- **Extract PortalWorkspace monolith**: valuable but out of scope; only delete
  dead breakdown here.
