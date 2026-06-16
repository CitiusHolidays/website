# Plan 017: Add a portal command palette for fast navigation and actions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update only the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 95cb879..HEAD -- src/components/portal src/lib/portal convex/crm`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/016-portal-saved-workspaces.md
- **Category**: direction
- **Planned at**: commit `95cb879`, 2026-06-12

## Why this matters

The CRM has many pages and modal actions. A command palette makes the portal
feel fast: jump to a query/job/proposal/ticket, create records, apply saved
workspaces, and open deep-linked modals without hunting through sidebars and
page headers. This should use the existing permission system and modal/deep-link
infrastructure instead of inventing a parallel action layer.

## Current state

- `src/components/portal/PortalShell.js:329` renders sidebar navigation and
  recent shortcuts.
- `src/components/portal/PortalWorkspace.js:1151` defines per-view header
  actions that call `openModal`.
- `src/components/portal/usePortalWorkspaceState.js:928` defines `openModal`.
- `src/components/portal/usePortalWorkspaceState.js:1170` exposes a `commands`
  facade with `openModal`, filter setters, delete commands, and `submit`.
- `src/lib/portal/syncNotificationDeepLink.js:8` applies `?open=` / `?id=`
  deep links after list data is ready.
- `src/lib/portal/notificationTargets.js` and
  `src/lib/portal/dashboardLinks.js` already encode modal deep-link behavior.
- `convex/crm/navShortcuts.ts:55` provides recent queries, proposals, job cards,
  and tickets with permission filtering.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Command helpers | `bun test src/lib/portal/commandPalette.test.js src/lib/portal/dashboardLinks.test.js src/lib/portal/notificationTargets.test.js` | exit 0 |
| Workspace contract | `bun test src/components/portal/portalWorkspaceContract.test.js` | exit 0 |
| Full tests | `bun test` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| React frontend check | `bunx react-doctor@latest --verbose` | no new portal findings introduced by this plan |

## Suggested executor toolkit

- Skills: `build-web-apps:react-best-practices`, `build-web-apps:frontend-testing-debugging`,
  `react-doctor`, `motion` if adding animation.
- Potential helper agents/tools: keyboard accessibility reviewer, portal
  permission reviewer, Browser visual QA across desktop and mobile.
- Use lucide icons for command categories and action buttons.

## Scope

**In scope**:
- `src/lib/portal/commandPalette.js` (create)
- `src/lib/portal/commandPalette.test.js` (create)
- `src/components/portal/PortalCommandPalette.js` (create)
- `src/components/portal/PortalWorkspace.js`
- `src/components/portal/usePortalWorkspaceState.js`
- `src/components/portal/PortalShell.js` only if shell-level keyboard help or
  trigger placement is needed
- Existing portal tests as needed

**Out of scope**:
- Fuzzy search across every database table.
- Mutations that bypass existing modal validation.
- Creating a custom UI component library.
- Changing auth, role permissions, or notification read behavior.
- Implementing saved workspaces; use Plan 016 outputs instead.

## Git workflow

- Branch: `codex/017-portal-command-palette`
- Commit style: imperative prose.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Build command descriptors as pure data

Create `src/lib/portal/commandPalette.js` with functions that return command
objects:

- `buildNavigationCommands({ navGroups, currentPathname })`
- `buildRecentRecordCommands({ navShortcuts })`
- `buildCreateCommands({ has, canAssign... })`
- `buildSavedViewCommands({ savedViews })`
- `filterCommands(commands, term)`

Each command should have:

- `id`
- `label`
- `subtitle`
- `keywords`
- `icon`
- `group`
- `href` or `run`

Rules:

- Navigation commands go to `href`.
- Recent records use the existing shortcut `href`.
- Create/edit actions should call `openModal` only for the current mounted
  workspace when possible. For cross-page creates, prefer route + deep link.
- Never show commands the user lacks permission for.

**Verify**:
`bun test src/lib/portal/commandPalette.test.js` -> all tests pass.

### Step 2: Add the palette component

Create `src/components/portal/PortalCommandPalette.js`.

UI requirements:

- Trigger with `Cmd+K` on Mac and `Ctrl+K` elsewhere.
- Include a compact icon button trigger in portal chrome or workspace header.
- Use an accessible dialog: focus trap, Escape closes, Enter runs selected
  command, arrow keys move selection.
- Group commands by `Navigate`, `Create`, `Recent`, and `Saved views`.
- Use `lucide-react` icons.
- Keep the surface utilitarian: no hero copy, no large decorative cards, no
  gradient panels.
- Text must fit on mobile; truncate subtitles with `line-clamp` or similar.

Render the component from `PortalWorkspaceLayout` so it can use the current
workspace's `commands`, rows, saved views, and permission helpers.

**Verify**:
Browser visual QA:
- `/portal/queries`: `Cmd+K`, search "new query", Enter opens the query modal.
- `/portal/job-cards`: search a recent job card, Enter navigates correctly.
- Mobile width: palette fits and no text overlaps.

### Step 3: Connect existing workspace commands safely

In `src/components/portal/usePortalWorkspaceState.js`, expose any missing safe
palette inputs through `workspaceFacade`:

- access/session
- view/pathname
- nav metadata if needed
- saved views from Plan 016
- `openModal`
- route/filter helpers

Do not expose raw mutation functions to the palette. The palette should route
through existing `openModal`, deep links, or saved-view application. This keeps
validation inside `EntityModal` and `executeModalCommand`.

**Verify**:
`bun test src/components/portal/portalWorkspaceContract.test.js` -> exit 0.

### Step 4: Add useful first-pass commands

Implement this initial catalog:

- Navigate to every accessible portal nav item.
- Open recent query/proposal/job card/ticket shortcuts.
- Create:
  - query
  - proposal
  - job card from current query context only if modal initialization can do it
  - ticket
  - traveller
  - expense
  - leave request/record
- Assign teams from current query context when the current view/row supports it.
- Apply saved workspaces from Plan 016.
- Clear all filters for the current view.

If a command cannot be implemented without a reliable target row, omit it. Do
not add commands that silently fail.

**Verify**:
`bun test src/lib/portal/commandPalette.test.js src/lib/portal/dashboardLinks.test.js`
-> all tests pass.

## Test plan

- `src/lib/portal/commandPalette.test.js` should cover permission gating,
  search ranking, saved-view commands, and recent shortcut commands.
- Extend `src/components/portal/portalWorkspaceContract.test.js` only if the
  palette reads new `w.*` keys.
- Use browser QA for keyboard behavior, focus, and modal opening because the
  project does not currently have component-level DOM tests.

## Done criteria

- [ ] `Cmd+K` / `Ctrl+K` opens the palette from portal workspaces.
- [ ] Enter runs the selected command; Escape closes.
- [ ] Commands are permission-gated.
- [ ] Create commands route through existing modals or deep links.
- [ ] Saved workspace commands from Plan 016 are searchable and apply correctly.
- [ ] `bun test src/lib/portal/commandPalette.test.js src/lib/portal/dashboardLinks.test.js src/lib/portal/notificationTargets.test.js` exits 0.
- [ ] `bun test` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- Plan 016 has not landed and there is no saved-view API/facade to integrate.
- Opening create/edit actions requires bypassing `openModal` or
  `executeModalCommand`.
- The palette introduces a React Doctor state-sync finding.
- Keyboard handling conflicts with text inputs or modal forms.

## Maintenance notes

Reviewers should test this on keyboard only. The palette is a high-leverage
workflow layer, so broken permission gating or a command that opens the wrong
modal will erode trust quickly.
