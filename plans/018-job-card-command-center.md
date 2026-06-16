# Plan 018: Build a job-card command center for operational readiness

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update only the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 95cb879..HEAD -- convex/schema.ts convex/crm src/app/portal src/components/portal src/lib/portal`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `95cb879`, 2026-06-12

## Why this matters

Job cards are where Citius work becomes operational: travellers, passports,
visas, tickets, hotels, tour manager, invoices, vendors, event flows, and
readiness all converge. Today the job-card list is a card grid with assignment
buttons and an embedded JSON checklist. The schema already has first-class
`checklistTasks`, `vendors`, `itineraries`, and `eventFlows`; this plan turns
those into one modern command center instead of adding more disconnected pages.

## Current state

- `convex/schema.ts:410` defines `jobCards`, including owners, status, travel
  dates, and `preDepartureChecklist`.
- `convex/schema.ts:704` defines `vendors`; `718` defines `itineraries`; `729`
  defines `eventFlows`; `739` defines `checklistTasks`.
- `convex/crm/jobCards.ts:21` defines `DEFAULT_CHECKLIST` as an embedded array.
- `convex/crm/jobCards.ts:360` updates only `jobCards.preDepartureChecklist`.
- `convex/crm/lib.ts:1282` exposes `preDepartureChecklist` in `publicJobCard`.
- `src/components/portal/PortalWorkspace.js:2522` renders `JobCardsView` as a
  grid of summary cards.
- `src/lib/portal/dashboardLinks.js:222` links dashboard job cards back to the
  list with `?open=jobCard&id=...`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Job-card backend tests | `bun test convex/crm/jobCards.test.ts src/lib/portal/jobCardCommandCenter.test.js src/lib/portal/jobCardCascade.test.ts` | exit 0 |
| Portal contract tests | `bun test src/components/portal/portalWorkspaceContract.test.js src/lib/portal/dashboardLinks.test.js` | exit 0 |
| Convex API/schema | `bunx convex codegen` | exit 0 |
| Full tests | `bun test` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| React frontend check | `bunx react-doctor@latest --verbose` | no new portal findings introduced by this plan |

## Suggested executor toolkit

- Skills: `convex`, `build-web-apps:frontend-app-builder`,
  `build-web-apps:react-best-practices`, `build-web-apps:frontend-testing-debugging`,
  `react-doctor`, `motion` for restrained transitions.
- Potential helper agents/tools: Convex relationship reviewer, portal UX reviewer,
  destructive-cascade reviewer, Browser visual QA for desktop/mobile.
- If `convex/_generated/ai/guidelines.md` exists, read it before Convex edits.

## Scope

**In scope**:
- `convex/schema.ts`
- `convex/crm/jobCards.ts`
- `convex/crm/jobCards.test.ts` (create if absent)
- `convex/crm/lib.ts`
- `convex/_runtimeModules.ts` if adding a new Convex module
- `src/app/portal/job-cards/[jobCardId]/page.js` (create)
- `src/components/portal/jobCard/JobCardCommandCenter.js` (create)
- `src/components/portal/jobCard/JobCardReadinessMap.js` (create)
- `src/components/portal/jobCard/JobCardTaskBoard.js` (create)
- `src/lib/portal/jobCardCommandCenter.js` (create)
- `src/lib/portal/jobCardCommandCenter.test.js` (create)
- `src/lib/portal/dashboardLinks.js`
- `src/components/portal/PortalWorkspace.js`

**Out of scope**:
- Drag-and-drop scheduling.
- Vendor payment automation.
- File upload redesign.
- Generic project management for non-job-card entities.
- Deleting or migrating away from `preDepartureChecklist` in this plan.

## Git workflow

- Branch: `codex/018-job-card-command-center`
- Commit style: imperative prose.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define the command-center payload

Create a pure helper in `src/lib/portal/jobCardCommandCenter.js` that computes:

- readiness sections:
  - traveller master
  - passports
  - visas
  - tickets
  - hotels/rooming
  - tour manager
  - finance/payment
  - checklist tasks
- blockers with severity: `critical`, `warning`, `info`
- owner lanes: Contracting SPOC, Ops Owner, Ticketing Owner, Tour Manager,
  Finance
- next actions sorted by due date and severity

Use current portal naming: "Contracting SPOC", not the DB field name. Use
DD/MM/YYYY display formatting via existing date helpers.

**Verify**:
`bun test src/lib/portal/jobCardCommandCenter.test.js` -> all tests pass.

### Step 2: Materialize checklist tasks without breaking legacy job cards

Keep `jobCards.preDepartureChecklist` for compatibility, but start using
`checklistTasks` as the first-class task source.

In `convex/crm/jobCards.ts`:

- When `createFromQuery` creates a job card, insert matching rows into
  `checklistTasks` using `DEFAULT_CHECKLIST`.
- Add a helper that lazily backfills checklist tasks for a job card if none
  exist but `preDepartureChecklist` does.
- Add mutations:
  - `updateChecklistTask({ taskId, completed, dueDate?, ownerRole? })`
  - `createChecklistTask({ jobCardId, category, title, dueDate?, ownerRole? })`
  - `removeChecklistTask({ taskId })`
- Keep `updateChecklist` working for old UI paths until the new command center
  has fully replaced them.

Permission rules:

- `manage:jobCards`, `manage:operations`, and `manage:finance` may update task
  completion where relevant.
- Users must pass `canSeeJobCardRecord` for the parent job card.

**Verify**:
`bun test convex/crm/jobCards.test.ts src/lib/portal/jobCardCascade.test.ts`
-> all tests pass.
`bunx convex codegen` -> exit 0.

### Step 3: Add a command-center query

Either extend `convex/crm/jobCards.ts` with `getCommandCenter` or create
`convex/crm/jobCardCommandCenter.ts`. The query should accept
`{ jobCardId: v.string() }` and return:

- public job-card details
- linked query/proposal summary
- travellers
- passport/visa/ticket counts
- PNR/tickets/seats
- hotels/rooming
- tour manager
- invoices/expenses
- vendors/itineraries/event flows
- checklist tasks
- recent activity for the job card

Apply the same visibility checks as `list`: require `view:jobCards` and
`canSeeJobCardRecord`.

If a new Convex module is created, add it to `convex/_runtimeModules.ts`.

**Verify**:
`bun test convex/crm/jobCards.test.ts` -> all tests pass.
`bunx convex codegen` -> exit 0.

### Step 4: Add the route and UI

Create `/portal/job-cards/[jobCardId]` with a server page that renders a client
command-center component.

UI layout:

- top compact header: job code, client, destination, dates, status, owners
- left/main: readiness map and task board
- right rail: blockers, next actions, linked records, recent activity
- tabs or segmented control for `Overview`, `Tasks`, `Travellers`, `Commercial`,
  and `Files/Notes` if enough data exists

Do not put cards inside cards. Use full-width bands or unframed sections with
compact repeated item cards where needed. Keep card radius at 8px or less unless
matching a local component requires otherwise.

**Verify**:
Browser visual QA:
- `/portal/job-cards`: open a job card command center.
- `/portal/job-cards/<id>` desktop and mobile widths: no overlap, no blank data
  panels, next actions are visible.

### Step 5: Update existing links to prefer the command center

Update:

- `src/lib/portal/dashboardLinks.js:222` so `buildJobCardHref` points to
  `/portal/job-cards/<id>` when a concrete job card id is known.
- `src/components/portal/PortalWorkspace.js:2522` job cards should include a
  primary "Open" or row/card click to the command-center route.
- Keep existing edit/assign/delete buttons working.

**Verify**:
`bun test src/lib/portal/dashboardLinks.test.js src/components/portal/portalWorkspaceContract.test.js`
-> all tests pass.

## Test plan

- Add backend tests for task materialization, task mutation authorization, and
  command-center query visibility.
- Add pure helper tests for readiness/blocker computation.
- Extend dashboard link tests for the new job-card URL.
- Keep cascade deletion tests passing; checklist tasks must still be deleted
  when a job card is deleted.

## Done criteria

- [ ] New job cards create first-class `checklistTasks`.
- [ ] Existing job cards with only `preDepartureChecklist` still render useful
  command-center tasks through lazy backfill or fallback.
- [ ] `/portal/job-cards/<id>` shows readiness, blockers, owners, linked records,
  and tasks.
- [ ] Dashboard and job-card list links can open the command center.
- [ ] Existing edit/assign/delete job-card actions still work.
- [ ] `bunx convex codegen` exits 0.
- [ ] `bun test` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- The job-card cascade deletion helper no longer covers `checklistTasks`.
- Command-center data requires exposing records the user cannot see through
  existing job-card permissions.
- Implementing the route requires removing the existing job-card modal.
- The command center cannot be made mobile-safe without redesigning unrelated
  portal chrome.

## Maintenance notes

This plan creates the operational object future automation should target.
Reviewers should check that readiness is computed from the same data the export
and list views use, not from display-only approximations.
