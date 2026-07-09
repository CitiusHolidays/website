# Plan 005: Portal workspace contract characterization tests

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-land-ts-migration-branch.md
- **Category**: tests
- **Planned at**: commit `53e0e4b`, 2026-07-08

## Why this matters

`usePortalWorkspaceState.js` (1,292 lines) was split into multiple modules. `portalWorkspaceContract.test.js` exists but may not cover filter/row/mutation splits — characterization tests prevent silent behavior drift during typing refactors.

## Current state

- `src/components/portal/portalWorkspaceContract.test.js`
- `src/lib/portal/workspaceContract.ts` (migrated from `.js`)
- Split modules: `portalWorkspaceFilters.ts`, `portalWorkspaceRows.ts`, `usePortalWorkspaceMutations.ts`

## Scope

**In scope:**
- `portalWorkspaceContract.test.js`
- Pure functions in `portalWorkspaceRows.ts`, `portalWorkspaceFilters.ts`

**Out of scope:**
- Full React hook integration tests (unless existing pattern in repo)

## Steps

### Step 1: Read existing contract test coverage

Identify exported pure functions without tests.

### Step 2: Add tests for row filtering and filter state transitions

Model after `workspaceContract.test.js` patterns.

### Step 3: Test date-range filter error path (inverted From/To)

Align with AGENTS.md: inverted ranges must error, not silently swap.

**Verify**: `bun test src/components/portal/portalWorkspaceContract.test.js src/lib/portal/workspaceContract.test.js` → pass

## Done criteria

- [ ] New tests cover at least `portalWorkspaceRows` and `portalWorkspaceFilters` happy paths
- [ ] Inverted date range case asserted
- [ ] `bun test` → pass

## STOP conditions

- Pure functions are not exported — export for test or test via public API documented in contract

## Maintenance notes

- Run before Plan 003 typing changes to lock behavior.
