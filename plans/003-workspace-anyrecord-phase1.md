# Plan 003: Tighten workspace AnyRecord types (phase 1)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-land-ts-migration-branch.md, plans/005-portal-workspace-contract-tests.md (recommended)
- **Category**: tech-debt
- **Planned at**: commit `53e0e4b`, 2026-07-08

## Why this matters

`workspaceStateTypes.ts` defines `AnyRecord = Record<string, any>`, undermining `strict` mode across the split workspace modules. Phase 1 replaces the worst hotspots (query/job card row types) with Convex `Doc<>` types where queries already return typed data.

## Current state

- `src/components/portal/workspace/workspaceStateTypes.ts:1` — `AnyRecord`
- `usePortalWorkspaceData.ts` — 20+ queries returning Convex docs
- `portalWorkspaceRows.ts` — row lists typed as `AnyRecord[]`

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test src/components/portal/portalWorkspaceContract.test.js` | pass |

## Scope

**In scope:**
- `workspaceStateTypes.ts`
- `portalWorkspaceRows.ts`
- `usePortalWorkspaceData.ts` (type-only changes where safe)

**Out of scope:**
- `usePortalWorkspaceState.ts` modal form typing (phase 2)
- Entity modal components

## Steps

### Step 1: Import Convex Doc types for top 3 entities

Use `Doc<"queries">`, `Doc<"jobCards">`, `Doc<"proposals">` from `convex/_generated/dataModel` in row helpers.

### Step 2: Replace `AnyRecord` on those row arrays

Keep `AnyRecord` only where Convex validators are loose or union-heavy.

**Verify**: `bun run typecheck` → exit 0

### Step 3: Run contract tests

**Verify**: `bun test src/components/portal/portalWorkspaceContract.test.js` → pass

## Done criteria

- [ ] At least queries, jobCards, proposals rows use `Doc<>` or dedicated interfaces
- [ ] `grep -c "AnyRecord" src/components/portal/workspace/` reduced vs baseline
- [ ] All tests pass

## STOP conditions

- Type errors cascade into `PortalWorkspace.js` — limit scope to workspace/ folder only

## Maintenance notes

- Phase 2: modal `form` state typing after entity modal field map is documented.
