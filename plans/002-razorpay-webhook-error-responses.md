# Plan 002: Harden Razorpay webhook error responses

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/001-land-ts-migration-branch.md
- **Category**: correctness
- **Planned at**: commit `53e0e4b`, 2026-07-08

## Why this matters

CEO review flagged that `POST /api/webhooks/razorpay` returns HTTP 200 with `{ received: true }` even when processing throws. Razorpay will not retry, and booking payment state may desync from Razorpay events.

## Current state

`src/app/api/webhooks/razorpay/route.ts` (lines ~59-62):

```typescript
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Processing error logged", received: true });
  }
```

`src/lib/razorpayWebhook.ts` — `processRazorpayWebhookEvent` returns action enum; tests in `src/lib/razorpayWebhook.test.ts`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Tests | `bun test src/lib/razorpayWebhook.test.ts` | pass |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope:**
- `src/app/api/webhooks/razorpay/route.ts`
- `src/lib/razorpayWebhook.test.ts` (add route-level or handler tests if needed)

**Out of scope:**
- Changing Razorpay signature verification logic
- Convex booking mutation internals

## Steps

### Step 1: Classify errors

- Malformed JSON after signature verify → 400
- Transient Convex/network failure → 500 (allows Razorpay retry)
- Known business no-ops from `processRazorpayWebhookEvent` → 200

### Step 2: Update catch block

Return appropriate status; never return 200 for unhandled processing exceptions.

**Verify**: `bun test src/lib/razorpayWebhook.test.ts` → pass

### Step 3: Add test for error status policy

Model after existing webhook tests.

**Verify**: `bun test` → all pass

## Done criteria

- [ ] Unhandled processing error returns non-2xx (typically 500)
- [ ] Invalid JSON returns 400
- [ ] Valid signature + successful processing returns 200
- [ ] `bun run typecheck` exits 0

## STOP conditions

- Product owner requires 200 on all errors for idempotency — STOP and document Razorpay retry policy

## Maintenance notes

- Document webhook response contract in PR description for ops.
