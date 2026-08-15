# Staff Workspace performance and replay safety

The Staff Workspace keeps eight representative commercial and operations routes bounded as CRM
data grows. The release contract covers both what a staff member sees while navigating and what
happens when a browser or provider retries a command.

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

Every active portal `useQuery` and `usePaginatedQuery` instance is registered at the shared wrapper.
The browser registry distinguishes exact argument sets with an in-memory SHA-256 digest, but
publishes only safe module/function labels and aggregate counts. Digests and arguments never enter
the performance snapshot. React Strict Mode re-registration of the same instance is idempotent;
two active instances of the same function and exact arguments increment the duplicate count.

The aggregate samples never record query arguments, digests, record IDs, URLs, email addresses,
cookies, or provider payloads. Baseline provenance intentionally retains only the approved frontend
and Convex origins plus their target ID, exact frontend revision, and code-baked Convex source
fingerprint; those target origins are not CRM sample content.

## Current budgets

The checked-in budgets live in
[`config/release/staff-workspace-performance-budgets.json`](../config/release/staff-workspace-performance-budgets.json).
The limits are the same for cold and warm navigation except for resource transfer:

| Route | Application payload | Logical subscriptions | Route ready | First content | Resource transfer (cold / warm) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Queries | 60,000 bytes | 5 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |
| Proposals | 100,000 bytes | 6 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |
| Job Cards | 30,000 bytes | 6 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |
| Contracting | 100,000 bytes | 6 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |
| Finance | 180,000 bytes | 10 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |
| Tickets | 120,000 bytes | 6 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |
| Hotels / Rooming | 180,000 bytes | 9 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |
| Visa Tracking | 180,000 bytes | 9 | 500 ms | 2,000 ms | 225,000 / 25,000 bytes |

Every route has a duplicate-subscription limit of zero.

Candidate replacements are also compared with the last accepted baseline. Payload may increase by
15% or 2,000 bytes, first content by 25% or 250 ms, logical subscriptions by 10% or one,
route-ready time by 50% or 100 ms, and transfer by 20% or 5,000 bytes, whichever allowance is
larger. Duplicate subscriptions receive no relative allowance. These noise floors do not widen the
fixed ceilings above; a candidate must pass both contracts. Collection runs three isolated browser
trials and promotes the median for each route/mode/metric. Raw-trial fixed-budget breaches are
reported as non-authoritative noise warnings; the three-trial median must pass every fixed and
relative gate before evidence is written. Schema-v4 evidence records both the trial count and
measurement version. Route order rotates between trials so the post-setup infrastructure cold-start
slot is not assigned to the same route three times.

Measurement version 2 moves the warm resource-timing reset before preload, so transfer now includes
both preload and navigation bytes, and replaces a single order-biased timing draw with rotated
three-trial medians. During the explicit version-1 to version-2 transition, transfer and browser
timings are ineligible for relative comparison because their definitions or aggregation changed;
payload and subscription metrics still compare with the last accepted baseline and all six fixed
ceilings remain enforced. Once a version-2 baseline is accepted, every metric is again compared
relatively.

The authenticated non-production browser baseline is stored in
[`config/release/staff-workspace-performance-baseline.json`](../config/release/staff-workspace-performance-baseline.json).
The current schema-v4 baseline was collected over three trials on 2026-08-15 from exact revision
`df8248f4888b510559fd8285d3b1a58ce4dcfcad`. The approved binding paired the dedicated Vercel
Preview alias with Convex Preview `elegant-bullfrog-454`; it is synthetic non-production evidence,
not a Production latency claim.

| Route | First content cold / warm | Route ready cold / warm | Transfer cold / warm | Payload bytes | Subscriptions | Duplicates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Queries | 1,421 / 1,444 ms | 32 / 12 ms | 37,870 / 14,334 bytes | 2,203 | 5 | 0 |
| Proposals | 1,469 / 1,419 ms | 35 / 13 ms | 21,838 / 2,301 bytes | 4,557 | 6 | 0 |
| Job Cards | 1,474 / 1,501 ms | 28 / 11 ms | 27,038 / 5,147 bytes | 753 | 5 | 0 |
| Contracting | 1,392 / 1,469 ms | 24 / 11 ms | 33,994 / 14,332 bytes | 5,243 | 6 | 0 |
| Finance | 1,296 / 1,447 ms | 22 / 11 ms | 35,728 / 13,360 bytes | 1,257 | 9 | 0 |
| Tickets | 1,426 / 1,488 ms | 46 / 13 ms | 37,724 / 24,624 bytes | 755 | 6 | 0 |
| Hotels / Rooming | 1,433 / 1,475 ms | 48 / 16 ms | 52,165 / 10,596 bytes | 1,034 | 8 | 0 |
| Visa Tracking | 1,216 / 1,440 ms | 30 / 13 ms | 39,732 / 20,845 bytes | 759 | 8 | 0 |

All sixteen medians passed the existing budgets; no limit was widened. One of the 48 raw cold/warm
samples crossed a fixed route-ready ceiling and was retained as a noise warning rather than used as
the authoritative median. The v1-to-v2 transition comparison also passed every comparable
deterministic payload and subscription budget. Review confirmed that the
durable sample keys contain only route IDs and the six declared aggregate metrics. They contain no
query arguments, subscription names, CRM contents, credentials, trace data, or record identifiers.
The reviewed source closure contains 440 files with hash
`86290a30c2c24107d27e478242193a7a893af06746917a109a2a9e8c9311493b`. Post-run ownership audit
reported zero active actors, incomplete runs, owned or mutated records, import/export artifacts,
storage references, and synthetic travellers.

An admissible replacement contains all sixteen cold/warm samples, a canonical timestamp, the exact
40-character revision, and the approved non-production target binding. The parser validates every
provenance field and rejects a target/revision mismatch; the collector requires a clean checkout
whose revision matches the frontend runtime and whose deployable Convex source fingerprint matches
the code-baked marker returned by the approved Convex Preview before Playwright setup or seed writes.
The source hash is derived from a checked import closure rooted at the measured views, shell, lazy
registry, data readers, browser harness, dependency lockfile, and Next build configuration. The gate
fails closed when either the file identity or content changes; unrelated documentation does not
invalidate it. A stale baseline may be replaced only from a fresh authenticated run against an
explicit non-production target.

## Backend Convex cost evidence

Browser subscription and transfer measurements do not prove backend transaction cost. The separate
backend manifest at
[`config/release/staff-workspace-backend-cost-budgets.json`](../config/release/staff-workspace-backend-cost-budgets.json)
budgets each route's cold and warm representative workload for provider-reported database bytes
read, billable database I/O read bytes, documents read, execution time, and OCC retries. The initial
safety ceilings are 5,000,000 bytes for each byte metric, 500 documents, 5,000 ms, and zero OCC
retries per sample. These are ceilings to detect a regression, not a measured claim or permission to
widen a query. Convex documents index ranges as a transaction limit but does not expose a
per-execution range count in its supported completion/log-stream metrics, so the evidence contract
does not invent or proxy that value.

The checked-in backend baseline is honestly `pending_target_measurement`. It contains no invented
sample, revision, target, or source hash, so `bun run performance:check` fails with an explicit
pending-evidence message. Changing any covered UI data owner or any of the Queries, Proposals, Job
Cards, Finance, Ticketing, Operations, Traveller, Import, or Visa readers also changes the shared
source closure and makes measured evidence stale.

For a refresh, stream Convex's provider-native JSONL completion events for the exact approved
non-production deployment while running one strict authenticated performance browser trial. The raw
browser evidence records content-free absolute cold/warm windows and privacy-safe function names.
With a clean checkout whose revision matches the deployed target, join those inputs offline:

```bash
bun run performance:backend:collect -- \
  .scratch/performance/<convex-logs>.jsonl \
  .scratch/staff-workspace-performance/<revision>/trial-<n>
```

The collector rejects missing route/function completions, malformed windows, revision drift, unsafe
subscription names, and unknown/Production targets. It emits only aggregated schema-v2 metrics below
`.scratch/performance/`. Review that file, then prepare the revision/source-bound baseline candidate:

```bash
bun run performance:backend:ingest -- .scratch/performance/<safe-metrics-export>.json
```

Both commands operate only on local files. Ingestion rejects unknown fields, missing cold/warm routes,
Production-like target IDs, a target not bound to the approved frontend/Convex origin pair, revision
drift, and a dirty tracked tree. It writes a candidate below `.scratch/performance/`; review that
aggregate before replacing the checked-in baseline. Raw arguments, CRM contents, identities,
tokens, URLs, and deployment credentials are not valid export fields.

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

The spec covers Dashboard navigation to All Sales Queries, Proposals, Job Cards, Contracting,
Finance, All Tickets, Hotel / Rooming, and Visa Tracking with a least-privilege Sales, Contracting,
Operations, Finance, or Ticketing profile. It skips when `E2E_STAFF_PASSWORD` is absent.

When a monitored source changes, capture fresh authenticated samples, update the baseline source
hash and samples together, and run `bun run performance:check`. Do not widen a limit just to make a
failing navigation pass; first check for duplicate subscriptions, an unbounded detail read, or a
route preload that no longer resolves.

## Related documentation

- [Portal CRM workflows](PORTAL_CRM_WORKFLOWS.md)
- [CRM search and metric readiness](CRM_READINESS_OPERATIONS.md)
- [Convex return contracts](CONVEX_RETURN_CONTRACTS.md)
- [Release operations](../RELEASE.md)
