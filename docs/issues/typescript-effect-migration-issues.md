# Issues: TypeScript & Effect Migration

**Parent PRD:** `docs/prd/typescript-effect-migration.md`  
**Plans:** `plans/001`–`plans/005`  
**Publish status:** Markdown only — `gh` token invalid; run `gh auth login` then publish with `ready-for-agent` label.

---

## Issue 001 — Land migration branch cleanly

**Blocked by:** None — can start immediately

### What to build

Commit the TypeScript migration branch with all JS counterparts removed for migrated modules (portal workspace state, payment routes, portal lib utilities). Ensure `bun run typecheck`, `bun test`, and `bun run lint` pass. No duplicate `.js`/`.ts` pairs for deleted modules.

### Acceptance criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun test` exits 0 (439+ tests)
- [ ] `bun run lint` exits 0
- [ ] No duplicate module pairs for payment routes, `usePortalWorkspaceState`, migrated `src/lib/portal/*`
- [ ] `plans/README.md` row 001 marked DONE

**Maps to:** `plans/001-land-ts-migration-branch.md`

---

## Issue 002 — Payment routes TypeScript with shared verification

**Blocked by:** Issue 001

### What to build

End-to-end typed payment flow: `create-order`, `verify-payment` API routes using shared `paymentVerification.ts`. Behavior unchanged for staff and guest checkout paths.

### Acceptance criteria

- [ ] Create-order and verify-payment routes are `.ts` with typed request/response handling
- [ ] Shared verification logic lives in `paymentVerification.ts` (no duplicated Razorpay HMAC/signature code in routes)
- [ ] `paymentVerification.test.js` passes
- [ ] Manual or automated happy-path payment verification documented in PR notes

**Maps to:** Design doc P4; portion of Issue 001 land scope

---

## Issue 003 — Harden Razorpay webhook error responses

**Blocked by:** Issue 002

### What to build

Fix webhook route so transient processing failures return 5xx (Razorpay retries) instead of HTTP 200 with `{ received: true }`. Invalid signature stays 400. Processing logic remains in `razorpayWebhook.ts`.

### Acceptance criteria

- [ ] Invalid/missing signature → 400
- [ ] Transient processing error → 5xx (not 200)
- [ ] `razorpayWebhook.test.ts` covers error classification
- [ ] CEO review gap closed (see `ceo-plans/20260708-ts-effect-migration-review.md`)
- [ ] `plans/README.md` row 002 marked DONE

**Maps to:** `plans/002-razorpay-webhook-error-responses.md`

---

## Issue 004 — Notification email delivery with Effect retry/throttle

**Blocked by:** Issue 001

### What to build

Land `notificationEmailDelivery.ts` with sequential batch send, Resend 429 retry, and test-time dependency injection. Wire from `notificationEmails.ts` without changing recipient expansion rules in `lib.ts`.

### Acceptance criteria

- [ ] `notificationEmailDelivery.test.ts` passes (429 retry, stagger)
- [ ] Effect adoption documented per AGENTS.md (I/O + retry + throttle pressures)
- [ ] Dev walkthrough: simulated 429 shows retry in logs
- [ ] No bell/email channel behavior regression for portal notifications

**Maps to:** Design doc P3; `convex/crm/notificationEmailDelivery.ts`

---

## Issue 005 — Portal workspace contract characterization tests

**Blocked by:** Issue 001

### What to build

Extend `portalWorkspaceContract.test.js` to lock filter/row/mutation contracts for the split workspace modules before type tightening.

### Acceptance criteria

- [ ] Contract test covers workspace filter and row shaping for at least queries, proposals, job cards list views
- [ ] `runMutation(options, fn)` call-site contract still scanned
- [ ] Lazy import integrity test passes (`portalComponentImports.test.js`)
- [ ] `plans/README.md` row 005 marked DONE

**Maps to:** `plans/005-portal-workspace-contract-tests.md`

---

## Issue 006 — Workspace AnyRecord typing (phase 1)

**Blocked by:** Issue 005

### What to build

Replace `AnyRecord` / loose `Record<string, unknown>` in `portalWorkspaceRows.ts` and `portalWorkspaceFilters.ts` with Convex `Doc<>` types for primary list entities. JS callers may remain via `allowJs`.

### Acceptance criteria

- [ ] Phase-1 entities typed (queries, proposals, job cards minimum)
- [ ] `bun run typecheck` and contract tests pass
- [ ] No Effect added to workspace hooks
- [ ] `plans/README.md` row 003 marked DONE

**Maps to:** `plans/003-workspace-anyrecord-phase1.md`

---

## Issue 007 — Effect adoption audit on integration seams

**Blocked by:** Issues 003, 004

### What to build

Run `evaluateEffectAdoption` checklist across payment, webhook, notification, and spreadsheet import modules. Document pass/fail per module; remove or avoid Effect where <2 pressures.

### Acceptance criteria

- [ ] Audit table in PR or `src/lib/effectAdoption.ts` comments listing each integration seam
- [ ] `effectAdoption.test.ts` passes
- [ ] No new Effect usage in portal UI or simple Convex mutations
- [ ] `plans/README.md` row 004 marked DONE

**Maps to:** `plans/004-effect-adoption-audit.md`

---

## Dependency graph

```
001 Land
 ├── 002 Payments
 │    └── 003 Webhook
 ├── 004 Notifications
 └── 005 Contract tests
      └── 006 Typing phase 1

003 + 004 → 007 Effect audit
```

## Publishing to GitHub

When `gh auth login` is fixed:

```bash
# Publish in dependency order; link blockers as native blocking edges where supported
gh issue create --title "001: Land TS migration branch cleanly" --body-file ...
# Apply label: ready-for-agent
```
