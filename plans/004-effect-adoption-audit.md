# Plan 004: Effect adoption audit on integration seams

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-land-ts-migration-branch.md
- **Category**: tech-debt
- **Planned at**: commit `53e0e4b`, 2026-07-08

## Why this matters

AGENTS.md requires Effect only when `evaluateEffectAdoption` reports ≥2 pressures. Auditing prevents Effect creep and documents justified usage for future contributors.

## Current state

Effect usage found in:
- `src/lib/effectAdoption.ts` — guardrail helper
- `convex/crm/notificationEmailDelivery.ts` — retry/throttle/I/O injection
- `src/lib/paymentVerification.ts`, `src/lib/razorpayWebhook.ts`, `src/app/api/create-order/route.ts`

`evaluateEffectAdoption` test in `src/lib/effectAdoption.test.ts`.

## Scope

**In scope:**
- Add `evaluateEffectAdoption` call sites or module-level comments documenting pressures for each Effect module
- Remove Effect from any module with <2 pressures (if found)

**Out of scope:**
- Adding Effect to new modules
- Refactoring Effect style beyond `effectAdoption.ts` patterns

## Steps

### Step 1: Inventory each Effect file

For each file, list matched pressures from `EFFECT_ADOPTION_PRESSURES`.

### Step 2: Document or remove

Add one-line header comment: `// Effect: external-io, retry-or-throttle (see effectAdoption.ts)` or refactor to plain async if inappropriate.

### Step 3: Extend effectAdoption.test.ts if new patterns added

**Verify**: `bun test src/lib/effectAdoption.test.ts` → pass

## Done criteria

- [ ] Every `Effect.` usage in `src/` and audited `convex/` files has documented ≥2 pressures or is removed
- [ ] `bun test` → pass

## STOP conditions

- Removing Effect breaks payment route tests — restore and document pressures instead

## Maintenance notes

- Copy patterns from `src/lib/effectAdoption.ts`; do not invent ad hoc Effect style per AGENTS.md.
