# Plan 016: Add saved portal workspaces for reusable CRM views

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update only the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 95cb879..HEAD -- convex/schema.ts convex/crm src/lib/portal src/components/portal`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `95cb879`, 2026-06-12

## Why this matters

The portal already has useful filters, date ranges, job-card scoping, and
dashboard deep links, but every user has to rebuild those views from URL state
and per-page controls. Saved workspaces should make common operating surfaces
first-class: "My confirmed queries", "Visa blockers", "Ticketing reissues",
"Departures this month", and role-specific pinned views. This is the foundation
for a more modern Linear/Jira-style CRM experience and should land before the
command palette or workflow nudges build on it.

## Current state

- `src/lib/portal/listFilterConfig.js` defines filterable views and each
  view's allowed filters. Current excerpt:
  - `src/lib/portal/listFilterConfig.js:46` exports `PORTAL_LIST_VIEWS`.
  - `src/lib/portal/listFilterConfig.js:86` exports `LIST_FILTER_CONFIG`.
  - `src/lib/portal/listFilterConfig.js:286` exports `getListFilterConfig`.
- `src/lib/portal/urlFilterState.js` serializes only transient URL state:
  - `src/lib/portal/urlFilterState.js:3` reads `q`, `from`, `to`, `jc`, and
    `f_*` params.
  - `src/lib/portal/urlFilterState.js:35` serializes the same fields.
  - `src/lib/portal/urlFilterState.js:89` builds filtered links.
- `src/components/portal/usePortalWorkspaceState.js` owns filter state and URL
  replacement:
  - `src/components/portal/usePortalWorkspaceState.js:866` builds the next URL.
  - `src/components/portal/usePortalWorkspaceState.js:883` clears all filters.
  - `src/components/portal/usePortalWorkspaceState.js:897` through `923` update
    search, date range, job-card filter, and list filters.
- `src/components/portal/PortalShell.js` already has sidebar shortcut UI:
  - `src/components/portal/PortalShell.js:89` queries `api.crm.navShortcuts.list`.
  - `src/components/portal/PortalShell.js:329` renders `PortalNav`.
  - `src/components/portal/PortalShell.js:483` renders recent shortcuts under
    active nav items.
- There is no table or API for saved user/team views in `convex/schema.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused unit tests | `bun test src/lib/portal/urlFilterState.test.js src/lib/portal/listFilterConfig.test.js src/lib/portal/savedViews.test.js convex/crm/savedViews.test.ts` | exit 0, all tests pass |
| Convex API/schema | `bunx convex codegen` | exit 0, generated API includes the new saved-view module |
| Workspace contract | `bun test src/components/portal/portalWorkspaceContract.test.js` | exit 0 |
| Full tests | `bun test` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| React frontend check | `bunx react-doctor@latest --verbose` | no new portal findings introduced by this plan |

## Suggested executor toolkit

- Skills: `convex` for schema/function patterns, `build-web-apps:react-best-practices`
  for state and memoization review, `build-web-apps:frontend-testing-debugging`
  for browser verification, `react-doctor` after frontend changes.
- Potential helper agents/tools: Convex schema/API reviewer, portal UI reviewer,
  focused test writer, Browser visual QA for `/portal/queries` and `/portal`.
- If `convex/_generated/ai/guidelines.md` exists in the checkout, read it before
  Convex edits. If it is missing, continue by matching the local Convex modules
  cited in this plan.

## Scope

**In scope**:
- `convex/schema.ts`
- `convex/crm/savedViews.ts` (create)
- `convex/crm/savedViews.test.ts` (create)
- `convex/_runtimeModules.ts` if a new Convex module must be imported for static reachability
- `convex/_exportSurface.ts` only if the repo's generator exists and regenerates it
- `src/lib/portal/savedViews.js` (create)
- `src/lib/portal/savedViews.test.js` (create)
- `src/lib/portal/urlFilterState.js`
- `src/components/portal/SavedViewsBar.js` (create)
- `src/components/portal/PortalWorkspace.js`
- `src/components/portal/usePortalWorkspaceState.js`
- `src/components/portal/PortalShell.js`
- Existing tests under `src/lib/portal/*` and `src/components/portal/*` as needed

**Out of scope**:
- Generic no-code dashboards or custom field builders.
- Workflow notifications for "rows entering a view"; that belongs in Plan 019.
- Changing existing role permissions or page visibility.
- Replacing URL filters; saved workspaces must build on the existing URL model.
- Editing old plans except the status row for this plan.

## Git workflow

- Branch: `codex/016-portal-saved-workspaces`
- Commit style: imperative prose, matching recent history, for example
  `Enhance dashboard metrics and improve component structure`.
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Add a canonical saved-view snapshot format

Create `src/lib/portal/savedViews.js` with pure helpers:

- `normalizeSavedViewState(input, filterConfig)` returns:
  - `search`
  - `dateRange`
  - `jobCardFilter`
  - `listFilters`, limited to the current view's `filterConfig`
  - optional future-safe `sort` and `columns` keys, defaulting to empty values
- `savedViewToUrl(pathname, savedView)` uses the existing URL serializer.
- `currentFiltersToSavedViewInput({ view, pathname, search, dateRange, jobCardFilter, listFilters })`.

Use `parseUrlFilterState` and `serializeUrlFilterState` from
`src/lib/portal/urlFilterState.js` instead of duplicating URL string logic.

**Verify**:
`bun test src/lib/portal/urlFilterState.test.js src/lib/portal/savedViews.test.js`
-> all tests pass. Add tests for unknown filter stripping, job-card filters, and
date-range preservation.

### Step 2: Add Convex storage and permissioned CRUD

In `convex/schema.ts`, add a `portalSavedViews` table. Suggested shape:

- `ownerAuthUserId: v.optional(v.string())`
- `ownerStaffId: v.optional(v.id("staffUsers"))`
- `sharedRole: v.optional(staffRole)`
- `name: v.string()`
- `view: v.string()`
- `pathname: v.string()`
- `filterState: v.any()`
- `isFavorite: v.boolean()`
- `isPinnedToDashboard: v.boolean()`
- `createdBy: v.string()`
- `createdAt: v.number()`
- `updatedAt: v.number()`

Indexes:

- `by_ownerAuthUserId`
- `by_sharedRole`
- `by_view`
- `by_createdBy`

Create `convex/crm/savedViews.ts` with:

- `listForPortal({ view?: string })`
- `create`
- `update`
- `remove`
- `reorderFavorites` only if the UI needs explicit order; otherwise skip it

Access rules:

- Any staff user may create private views for themselves.
- Only `manage:staff` users may create or edit `sharedRole` views.
- A user can see private views they created and shared-role views matching any
  of their roles.
- A user cannot mutate someone else's private view.

If a new Convex module is created, add it to `convex/_runtimeModules.ts`. If
`scripts/generate-convex-export-surface.mjs` exists in the live checkout, run it
to regenerate `convex/_exportSurface.ts`; if the script is absent and only
`_exportSurface.ts` is stale, stop and report instead of hand-editing generated
output.

**Verify**:
`bun test convex/crm/savedViews.test.ts` -> all tests pass.
`bunx convex codegen` -> exit 0.

### Step 3: Wire saved workspaces into the portal state facade

In `src/components/portal/usePortalWorkspaceState.js`:

- Query `api.crm.savedViews.listForPortal` for the current view when `allowed`.
- Add commands:
  - `saveCurrentView(name, options)`
  - `applySavedView(savedView)`
  - `deleteSavedView(id)`
  - `toggleSavedViewFavorite(id)`
  - `toggleSavedViewPinned(id)`
- `applySavedView` must update React state and call the existing
  `replaceFilterUrl` path so URL, UI controls, and list rows stay in sync.
- Return the new data/commands through `workspaceFacade` and the top-level hook
  return object. Update `src/components/portal/portalWorkspaceContract.test.js`
  if it needs explicit coverage for these new keys.

**Verify**:
`bun test src/components/portal/portalWorkspaceContract.test.js src/lib/portal/urlFilterState.test.js`
-> all tests pass.

### Step 4: Add the saved views UI without disturbing PageHeader layout

Create `src/components/portal/SavedViewsBar.js` and render it from
`src/components/portal/PortalWorkspace.js` below `PageHeader` for filterable
views only.

UI requirements:

- Use compact chips/tabs for saved views, with a star icon for favorites.
- Include a single "Save view" icon+label button.
- Use modal or popover form for naming a saved view.
- Do not add another heavy card around the page header.
- Do not shift existing quick-action buttons when filters change.
- Respect permissions from the backend; hide edit/delete for shared views the
  current user cannot mutate.
- Keep text small enough for the portal work surface. Do not use hero-scale
  typography or explanatory copy.

**Verify**:
Browser visual QA:
- `/portal/queries` with filters applied: saving and applying a view preserves
  visible rows and URL params.
- `/portal/job-cards`: job-card filters and list filters still work.
- `/portal`: no dashboard search bar reappears.

### Step 5: Surface favorites in the sidebar and dashboard

In `src/components/portal/PortalShell.js`, add a "Saved views" section or nest
favorites under their matching nav item, using `href` generated from each saved
view. Keep the existing shortcut dropdowns closable even on the active route.

For `isPinnedToDashboard`, either:

- add a small `DashboardSavedViews` component to the portal dashboard, or
- defer dashboard pins if the dashboard composition has drifted too much.

If dashboard pins are implemented, use existing dashboard link styling and avoid
heavy bordered card outlines.

**Verify**:
`bun test src/lib/portal/dashboardLinks.test.js src/components/portal/portalWorkspaceContract.test.js`
-> all tests pass.

## Test plan

- Add `src/lib/portal/savedViews.test.js` for snapshot normalization and URL
  generation.
- Add `convex/crm/savedViews.test.ts` for private view access, shared-role view
  access, and mutation authorization.
- Extend `src/components/portal/portalWorkspaceContract.test.js` so `PortalWorkspace`
  does not read saved-view keys that the hook fails to return.
- Re-run existing URL/filter/list-filter tests to guard compatibility.

## Done criteria

- [ ] Staff can save, apply, favorite, pin, edit, and delete a private saved
  workspace for at least `queries` and `job-cards`.
- [ ] Admin/manage-staff users can create shared role views; non-admin users
  cannot mutate shared views.
- [ ] Applying a saved view updates visible controls and URL params.
- [ ] Sidebar favorites link to the saved view without breaking recent shortcuts.
- [ ] `bun test src/lib/portal/urlFilterState.test.js src/lib/portal/listFilterConfig.test.js src/lib/portal/savedViews.test.js convex/crm/savedViews.test.ts` exits 0.
- [ ] `bunx convex codegen` exits 0.
- [ ] `bun test` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- `src/lib/portal/urlFilterState.js` no longer owns URL serialization.
- `src/components/portal/usePortalWorkspaceState.js` no longer owns filter
  state and URL replacement.
- The saved-view backend requires a general custom-fields system.
- A new Convex module requires updating generated `_exportSurface.ts`, but the
  generator is unavailable in the live checkout.
- React Doctor reports a new state-sync issue caused by this plan.

## Maintenance notes

Saved workspaces will become a dependency for the command palette and workflow
nudges. Reviewers should scrutinize permission boundaries: private views must
stay private, shared role views must not reveal inaccessible routes, and saved
URL filters must keep using the allowed filter config for the target view.
