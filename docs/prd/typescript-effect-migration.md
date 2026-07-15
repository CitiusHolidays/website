# PRD: TypeScript & Effect Migration (Portal, Payments, Notifications)

**Status:** Ready for agent  
**Branch:** main  
**Design doc:** `~/.gstack/projects/citius-travel-website/sharm1-main-design-20260708-024800.md`  
**CEO review:** HOLD SCOPE, Approach B approved  
**Generated:** 2026-07-08

## Problem Statement

Citius Connect portal and payment integration code is mid-migration from JavaScript to TypeScript. A large in-flight branch deletes legacy JS modules (including a 1,300-line workspace state hook) and introduces typed replacements for portal workspace orchestration, Razorpay payment API routes, webhook handling, and Convex notification email delivery with Effect-based retry/throttle for Resend rate limits.

Without a deliberate landing strategy, engineering risks shipping `AnyRecord` escape hatches, spreading Effect beyond integration seams, leaving JS/TS duplicates, and regressing payment or notification behavior that staff depend on daily.

## Solution

Land the migration using **Approach B — Guardrailed Completion**: commit TS replacements with characterization tests frozen at module boundaries, harden payment/webhook error semantics, document Effect adoption per AGENTS.md guardrails, and phase portal workspace typing without blocking the branch. Verification gates: `bun run typecheck`, `bun test`, `bun run lint`, and `bunx convex codegen` when Convex APIs change.

## User Stories

### Migration (in scope)

1. As an engineer, I want payment API routes in TypeScript with shared verification helpers, so that Razorpay logic is not duplicated across create-order, verify-payment, and webhook handlers.
2. As an engineer, I want the Razorpay webhook to return correct HTTP status on transient failures, so that Razorpay retries and booking payment state stays in sync.
3. As an engineer, I want notification batch email delivery to retry on Resend 429 with stagger, so that notification emails are not silently dropped under rate limits.
4. As an engineer, I want `usePortalWorkspaceState` split into data, filters, rows, and mutations modules, so that future portal refactors touch smaller files.
5. As an engineer, I want workspace contract tests to pass before tightening types, so that list views and filters do not regress during typing work.
6. As an engineer, I want Effect used only where `evaluateEffectAdoption` reports ≥2 orchestration pressures, so that simple React state stays plain TypeScript.
7. As an engineer, I want no duplicate `.js` + `.ts` pairs for migrated modules, so that imports resolve unambiguously in CI and production builds.
8. As an Accounts team member, I want payment verification to behave identically after migration, so that confirmed bookings and job cards are not blocked by a refactor.
9. As a staff user, I want in-app and email notifications to continue delivering on query/proposal/job-card events, so that sales and contracting workflows are uninterrupted.
10. As an engineer, I want `bun run check` green on the merged branch, so that Vercel/CI deploys confidently.

### Direction (future — out of this PRD’s implementation scope)

11. As a sales user, I want portal list views to paginate large query/proposal/job-card lists, so that the workspace stays responsive as CRM data grows.
12. As an engineer, I want entity modal linking typed end-to-end, so that autofill of dependent fields (job card, traveller, PNR, query, visa) is compile-time safe.
13. As an Operations head, I want a payment reconciliation view comparing Razorpay events to Convex booking state, so that webhook gaps are visible without reading logs.
14. As an HR user, I want notification delivery status (sent, retried, failed) visible on high-volume alert batches, so that missed emails are actionable.
15. As a Director, I want role-based dashboard KPIs (per `dashboardPersona`) expanded with drill-down links, so that portal home is actionable rather than three duplicate query grids.

## Implementation Decisions

- **Approach:** Guardrailed Completion (B). Do not bulk-migrate ~356 remaining `src/**/*.js` files in this release.
- **Effect boundaries:** Payment routes, `razorpayWebhook`, `notificationEmailDelivery`, and spreadsheet import orchestration only when adoption checklist passes. No Effect in React workspace hooks.
- **TypeScript scope:** Root `tsconfig.json` covers `src/**/*.ts(x)` with `strict: true`, `allowJs: true`. Convex remains on `convex/tsconfig.json` + `bunx convex codegen`.
- **Workspace decomposition:** `usePortalWorkspaceState.ts` delegates to `usePortalWorkspaceData`, `portalWorkspaceFilters`, `portalWorkspaceRows`, `usePortalWorkspaceMutations`, and `workspaceStateTypes`.
- **Payment seam:** Shared `paymentVerification.ts` and `razorpayWebhook.ts`; Next.js routes are thin wrappers.
- **Notification seam:** `notificationEmails.ts` calls `notificationEmailDelivery.ts` for sequential send with retry/throttle.
- **Webhook error semantics:** Invalid signature → 400. Transient processing failures → 5xx so Razorpay retries. Do not return 200 with `received: true` on unhandled processing errors (CEO review condition).
- **Typing phase 1:** Replace `AnyRecord` in workspace row/filter modules with Convex `Doc<>` shapes incrementally after contract tests extend coverage.
- **Plans execution:** Follow `plans/001`–`plans/005` in `plans/README.md`. Do not edit `plans/` files during execution except status rows.

## Testing Decisions

- **Principle:** Test external behavior and module contracts, not implementation details. Prefer pure functions (`portalWorkspaceFilters`, `portalWorkspaceRows`, `razorpayWebhook`, `effectAdoption`) for unit tests.
- **Seams (highest first):**
  1. **Payment/webhook:** `razorpayWebhook.test.ts` — signature validation, event routing, error classification.
  2. **Notification delivery:** `notificationEmailDelivery.test.ts` — 429 retry, stagger, batch sequential send.
  3. **Workspace contract:** `portalWorkspaceContract.test.js` — filter/row shapes, mutation call contract, lazy import integrity.
  4. **Effect adoption:** `effectAdoption.test.ts` — pressure checklist gates.
- **Route-level:** Add or extend API route tests where existing patterns exist; otherwise rely on lib-level tests + manual dev walkthrough per design doc assignment.
- **Verification gate for every slice:** `bun run typecheck` && `bun test` && `bun run lint`.

## Out of Scope

- Migrating all remaining `src/**/*.js` portal components in one release.
- Adding Effect to React component state or simple Convex validators.
- Portal list pagination implementation (direction item; separate PRD).
- Entity modal linking TS migration (direction item; follows workspace typing).
- Payment reconciliation UI (direction item).
- Folding Convex into root `tsconfig.json`.
- GitHub issue publish (blocked until `gh auth login` restores token).

## Further Notes

- Interactive skill-chain gates confirmed: intrapreneurship goal + Approach B + 7-issue vertical slice breakdown.
- User also requested **new feature ideation** during office-hours; direction user stories above capture post-migration opportunities surfaced by improve audit and AGENTS.md backlog (`docs/backlog/portal-crm-revisit.md`).
- Design doc status remains DRAFT until explicitly marked APPROVED in gstack artifact.
