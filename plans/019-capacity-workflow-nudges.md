# Plan 019: Add capacity heatmaps and constrained workflow nudges

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update only the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 95cb879..HEAD -- convex/schema.ts convex/crm convex/crons.ts src/components/portal src/lib/portal`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/016-portal-saved-workspaces.md, plans/018-job-card-command-center.md
- **Category**: direction
- **Planned at**: commit `95cb879`, 2026-06-12

## Why this matters

The portal already surfaces urgent actions and a small contracting workload
table, but leadership and team heads still lack a clear capacity view across
Sales, Contracting, Operations, Ticketing, Finance, Visa, and Tour Managers.
Constrained workflow nudges should catch predictable travel-operations risks
without becoming a fragile no-code automation engine.

## Current state

- `convex/crm/dashboard.ts:94` computes hard-coded urgent actions and slices to
  eight rows.
- `convex/crm/dashboard.ts:519` returns `myTeam` as a simple same-role staff
  slice.
- `convex/crm/dashboard.ts:532` returns aggregate readiness percentages.
- `src/components/portal/PortalWorkspace.js:2020` computes active contracting
  queries inside the Contracting view only.
- `convex/schema.ts:240` defines staff users with roles, department, function,
  location, active state, and `lastSeenAt`.
- `convex/schema.ts:288` defines query owners.
- `convex/schema.ts:410` defines job-card owners.
- `convex/schema.ts:856` defines activity logs; `869` defines notifications.
- `convex/crm/lib.ts:840` exports `notifyRoles`; `882` exports
  `notifyStaffMatching`.
- `convex/crons.ts:6` already runs one daily internal CRM job.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Workflow helper tests | `bun test src/lib/portal/capacity.test.js convex/crm/workflowNudges.test.ts convex/crm/dashboard.test.ts` | exit 0 |
| Convex API/schema | `bunx convex codegen` | exit 0 |
| Portal contract | `bun test src/components/portal/portalWorkspaceContract.test.js` | exit 0 |
| Full tests | `bun test` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| React frontend check | `bunx react-doctor@latest --verbose` | no new portal findings introduced by this plan |

## Suggested executor toolkit

- Skills: `convex`, `build-web-apps:react-best-practices`,
  `build-web-apps:frontend-testing-debugging`, `react-doctor`.
- Potential helper agents/tools: workflow/domain reviewer, permission reviewer,
  cron/idempotency reviewer, Browser visual QA for dashboard and settings.
- Read `convex/_generated/ai/guidelines.md` if present before Convex edits.

## Scope

**In scope**:
- `convex/schema.ts`
- `convex/crm/workflowNudges.ts` (create)
- `convex/crm/workflowNudges.test.ts` (create)
- `convex/crm/dashboard.ts`
- `convex/crm/dashboard.test.ts`
- `convex/crons.ts`
- `convex/_runtimeModules.ts` if creating a new module
- `src/lib/portal/capacity.js` (create)
- `src/lib/portal/capacity.test.js` (create)
- `src/components/portal/dashboard/*`
- `src/components/portal/PortalWorkspace.js`
- Settings UI only for enabling/disabling the fixed rule catalog

**Out of scope**:
- Arbitrary no-code rule builders.
- External Slack/WhatsApp/email integrations beyond existing notifications.
- Auto-assigning work to staff.
- Changing business statuses or lead-stage names.
- Replacing saved workspaces or job-card command center behavior.

## Git workflow

- Branch: `codex/019-capacity-workflow-nudges`
- Commit style: imperative prose.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Build capacity calculations as pure helpers

Create `src/lib/portal/capacity.js` with helpers that accept already-public CRM
rows and return:

- `buildStaffCapacityRows`
- `buildRoleCapacitySummary`
- `buildOwnerSuggestions`

Metrics to include:

- active sales queries
- active contracting queries
- active job cards by owner role
- ticket attention items
- visa blockers
- upcoming departures in 7/14/30 days
- pending approvals/finance items where the role owns them
- stale owner assignment, based on `updatedAt`

Use severity bands like `normal`, `busy`, `overloaded`, but keep thresholds in
one exported constant so the team can tune them later.

**Verify**:
`bun test src/lib/portal/capacity.test.js` -> all tests pass.

### Step 2: Add backend capacity and nudge APIs

In `convex/schema.ts`, add a small configuration table, not a general workflow
engine:

`portalWorkflowRules` fields:

- `key: v.string()`
- `enabled: v.boolean()`
- `thresholdHours: v.optional(v.number())`
- `recipientRole: v.optional(staffRole)`
- `createdAt: v.number()`
- `updatedAt: v.number()`

`portalWorkflowRuleRuns` fields:

- `ruleKey: v.string()`
- `entityType: v.string()`
- `entityId: v.string()`
- `lastTriggeredAt: v.number()`
- indexes by rule/entity to dedupe notifications

Create `convex/crm/workflowNudges.ts` with a fixed catalog:

- `confirmed_query_without_job_card`
- `query_without_contracting_owner_after_24h`
- `job_card_without_operations_owner_after_24h`
- `departure_14d_visa_not_ready`
- `departure_14d_ticket_not_ready`
- `passport_expiry_blocks_departure`
- `ticket_attention_status`
- `invoice_overdue_balance`

APIs:

- `listRules`
- `updateRule`
- `getCapacityOverview`
- `runNudgesNow` for `manage:staff` or Directors/Admin
- internal `runScheduledNudges`

Use existing `notifyRoles` or `notifyStaffMatching`. Deduplicate with
`portalWorkflowRuleRuns` so daily crons do not spam users.

**Verify**:
`bun test convex/crm/workflowNudges.test.ts` -> all tests pass.
`bunx convex codegen` -> exit 0.

### Step 3: Schedule the fixed nudge catalog

In `convex/crons.ts`, add a daily run for
`internal.crm.workflowNudges.runScheduledNudges`.

The nudge runner must be idempotent:

- If the same rule/entity was triggered within the configured quiet window,
  do not notify again.
- If the risk resolves, future runs should not create a new notification until
  it becomes risky again.

Do not add minute-level polling.

**Verify**:
`bun test convex/crm/workflowNudges.test.ts` -> includes idempotency cases and
passes.

### Step 4: Add capacity dashboard surfaces

Add dashboard components that show:

- role heatmap by department
- overloaded staff list
- unassigned work
- upcoming departures with readiness blockers
- links into saved views from Plan 016 where possible

Prefer compact operational UI over decorative cards. Link every count to a list
or command-center route if possible.

**Verify**:
Browser visual QA:
- `/portal` as Admin/Director: capacity heatmap is visible and compact.
- `/portal` as a role-limited user: only relevant capacity is visible.
- Dashboard quick actions and period controls still hold their layout.

### Step 5: Add settings for rule toggles

In portal settings, add a compact "Workflow nudges" section:

- fixed rule name
- enabled toggle
- threshold hours input only where relevant
- last run time if available
- "Run now" button for admins/directors

Do not expose arbitrary conditions, scripts, custom recipients, or webhook URLs.

**Verify**:
`bun test src/components/portal/portalWorkspaceContract.test.js` -> exit 0.

## Test plan

- Pure helper tests for capacity thresholds and owner suggestions.
- Convex tests for rule access, deduping, disabled rules, and notification
  creation.
- Dashboard tests for payload keys if `getPortalSummary` changes.
- Browser QA for dashboard density and settings toggles.

## Done criteria

- [ ] Dashboard shows a role-aware capacity heatmap.
- [ ] Team heads can see unassigned and overloaded work without seeing records
  outside their permissions.
- [ ] Fixed workflow nudges can be enabled/disabled.
- [ ] Scheduled nudges dedupe notifications.
- [ ] No generic rule builder is introduced.
- [ ] `bunx convex codegen` exits 0.
- [ ] `bun test` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report if:

- Plan 018 has not landed and there is no reliable command-center/task target
  for job-card nudges.
- A requested nudge requires exposing sensitive traveller data to users without
  `view:sensitiveTravellerData`.
- Implementing settings requires changing role permissions broadly.
- Notifications would spam the same entity every cron run.

## Maintenance notes

This is intentionally not a no-code automation product. Future rules should be
added to the fixed catalog with tests and dedupe behavior, not through arbitrary
user-authored conditions.
