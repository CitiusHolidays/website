# Plan 001: Land TypeScript migration branch cleanly

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `53e0e4b`, 2026-07-08

## Why this matters

The branch deletes large JS modules and adds TS replacements. Landing without duplicate files or stale imports breaks production builds and confuses future migrations. Clean land establishes the baseline for follow-up typing work.

## Current state

- Deleted (staged/unstaged): `usePortalWorkspaceState.js`, payment `route.js` files, portal lib `*.js` modules.
- Added: `usePortalWorkspaceState.ts`, `src/components/portal/workspace/*`, `src/app/api/*/route.ts`, `src/lib/*.ts`, `convex/crm/notificationEmailDelivery.ts`.
- `tsconfig.json` includes `src/**/*.ts(x)` with `strict: true`, `allowJs: true`.
- Verification: `bun run typecheck`, `bun test` both pass on current tree.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `bun run typecheck` | exit 0 |
| Tests | `bun test` | 439+ pass, 0 fail |
| Lint | `bun run lint` | exit 0 |
| Convex codegen | `bunx convex codegen` | exit 0 (if Convex API touched) |

## Scope

**In scope:**
- Resolve any remaining import paths pointing at deleted `.js` modules
- Ensure git tracks new `.ts` files and deletions of paired `.js`
- Update `README.md` if verification commands changed

**Out of scope:**
- New Effect usage
- Typing `AnyRecord` replacements
- Migrating unrelated `src/**/*.js` files

## Steps

### Step 1: Verify no duplicate module pairs

Search for imports of deleted basenames without extension conflicts.

**Verify**: `bun run typecheck` → exit 0

### Step 2: Run full check suite

**Verify**: `bun run check` → lint + tests pass

### Step 3: Confirm Convex notification delivery wired

Read `convex/crm/notificationEmails.ts` — ensure it imports/uses `notificationEmailDelivery` for batch sends.

**Verify**: `bun test convex/crm/notificationEmailDelivery.test.ts` → pass

### Step 4: Stage and commit (if operator requested)

Follow repo commit message style from `git log --oneline -5`.

## Test plan

- Rely on existing suite; no new tests required for land-only work.

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun test` exits 0
- [ ] No file exists at both `src/lib/portal/spreadsheetImports.js` and `.ts`
- [ ] `plans/README.md` status row for 001 updated to DONE

## STOP conditions

- typecheck fails after import fixes — report failing paths
- Test failures in `portalWorkspaceContract.test.js` — do not merge until green

## Maintenance notes

- Vercel/CI runs `bunx convex codegen` before build — ensure Convex changes codegen cleanly.
