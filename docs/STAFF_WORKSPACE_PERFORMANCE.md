# Staff Workspace performance and replay safety

The Staff Workspace keeps the high-volume Queries, Proposals, and Job Cards routes bounded as
CRM data grows. The release contract covers both what a staff member sees while navigating and
what happens when a browser or provider retries a command.

This document describes local evidence and release checks. It does not claim that a Vercel or
Convex deployment has been activated. Use [`RELEASE.md`](../RELEASE.md) for deployment ownership
and [`docs/E2E_TESTING.md`](E2E_TESTING.md) for authenticated browser setup.

## What is measured

The performance harness records a privacy-safe snapshot for each route in both cold and warm
conditions:

| Metric | Meaning |
| --- | --- |
| Application payload | JSON bytes for the active, ready Convex subscriptions |
| Logical subscriptions | Number of active list/detail subscriptions |
| Duplicate subscriptions | Repeated subscription names; the budget is zero |
| Route ready | Milliseconds from navigation start until the route lifecycle is ready |
| First content | Milliseconds until the first empty-state or row content is rendered |
| Resource transfer | Browser resource transfer bytes for the route navigation |

Subscription names are limited to safe module/function labels. The snapshot never records query
arguments, record IDs, URLs, email addresses, cookies, or provider payloads.

## Current budgets

The checked-in budgets live in
[`config/release/staff-workspace-performance-budgets.json`](../config/release/staff-workspace-performance-budgets.json).
The limits are the same for cold and warm navigation except for resource transfer:

| Route | Application payload | Logical subscriptions | Route ready | First content | Resource transfer (cold / warm) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Queries | 60,000 bytes | 1 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |
| Proposals | 100,000 bytes | 2 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |
| Job Cards | 30,000 bytes | 1 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |

Every route has a duplicate-subscription limit of zero.

The current authenticated non-production Preview baseline is stored in
[`config/release/staff-workspace-performance-baseline.json`](../config/release/staff-workspace-performance-baseline.json).
It records six samples from the latest source hash:

| Route | Cold first content | Warm first content | Cold transfer | Warm transfer |
| --- | ---: | ---: | ---: | ---: |
| Queries | 848 ms | 942 ms | 32,094 bytes | 18,939 bytes |
| Proposals | 982 ms | 1,093 ms | 25,474 bytes | 2,000 bytes |
| Job Cards | 1,191 ms | 1,097 ms | 30,944 bytes | 4,847 bytes |

These figures are an authenticated synthetic baseline from a protected Vercel Preview bound to a
dedicated Convex Preview, not a production latency promise.
The source hash is derived from a checked import closure rooted at the measured views, shell, lazy
registry, data readers, browser harness, dependency lockfile, and Next build configuration. The gate
fails closed when either the file identity or content changes; unrelated documentation does not
invalidate it. A stale baseline may be replaced only from a fresh authenticated run against an
explicit non-production target.

## Replay-safe commands

Commands that can create a durable side effect carry a UUID command ID. Convex stores the actor,
operation, target, and a canonical payload digest. A retry with the same input returns the original
result; reusing a command ID with a different target or payload is rejected.

The current UUID-guarded operations include:

- sending a proposal to Sales;
- confirming an order from the Sales Decision flow;
- starting a passenger export;

Passenger imports keep the user-facing workbook uncapped, while each backend request is processed
in 50-row batches. A durable import operation aggregates created, updated, failed, retryable, and
remaining rows. The browser digest only reattaches the UI; a server-computed prepared-content ID is
claimed at each operation/batch position before row writes. Each row has an isolated transaction,
so retries reconcile stable identities without retaining partial Traveller, Visa, Passport,
Ticketing, or metric state. Passenger exports create a durable operation, process rows in bounded
pages, and expose a download only after the workbook is complete.

The source chunk, cursor resume, external merge, streaming workbook, measured worker-memory budget,
private download, expiry, and cleanup contracts are maintained in
[`SPREADSHEET_OPERATIONS.md`](SPREADSHEET_OPERATIONS.md). Performance baselines may be refreshed only
from a fresh authenticated non-production run after source-file and privacy review; measurements do
not automatically justify increasing a budget.

## Notification delivery evidence

CRM email sends write a privacy-safe delivery ledger with monotonic statuses:
`queued`, `sending`, `retrying`, `sent`, `skipped`, and `exhausted`. A scheduled replay cannot move a
sent row back to an earlier state. Delivery summaries are available only to roles with
`view:emailDeliveryStatus` (department heads, Admin, Directors, and Director Cement) and contain counts plus a
permitted notification link, never recipient addresses or provider response bodies. See
[`docs/NOTIFICATION_EMAIL_DELIVERY.md`](NOTIFICATION_EMAIL_DELIVERY.md).

## How to run the checks

For the target-neutral release gate:

```bash
bun run verify:local
```

To check public asset/runtime budgets and the checked-in Staff Workspace baseline directly:

```bash
bun run performance:check
```

Credential-free public runtime collection is intentionally separate from authenticated Staff
Workspace measurement. Its six current scenarios, repeated-trial baseline, warning/failure policy,
and loopback-only collector are documented in
[`docs/PUBLIC_RUNTIME_PERFORMANCE.md`](PUBLIC_RUNTIME_PERFORMANCE.md).

To collect authenticated cold/warm browser evidence, complete the E2E setup in
[`docs/E2E_TESTING.md`](E2E_TESTING.md), then run the focused Playwright spec:

```bash
bunx playwright test e2e/specs/staff-workspace-performance.spec.ts
```

The spec covers Dashboard → All Sales Queries, Dashboard → Proposals, and Dashboard → Job Cards
for Sales, Contracting, and Operations profiles. It skips when `E2E_STAFF_PASSWORD` is absent.

When a monitored source changes, capture fresh authenticated samples, update the baseline source
hash and samples together, and run `bun run performance:check`. Do not widen a limit just to make a
failing navigation pass; first check for duplicate subscriptions, an unbounded detail read, or a
route preload that no longer resolves.

## Related documentation

- [Portal CRM workflows](PORTAL_CRM_WORKFLOWS.md)
- [CRM search and metric readiness](CRM_READINESS_OPERATIONS.md)
- [Convex return contracts](CONVEX_RETURN_CONTRACTS.md)
- [Release operations](../RELEASE.md)
