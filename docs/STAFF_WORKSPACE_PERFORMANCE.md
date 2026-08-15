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
Cold and warm navigation use separate route-ready and resource-transfer ceilings:

| Route | Application payload | Logical subscriptions | Route ready (cold / warm) | First content | Resource transfer (cold / warm) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Queries | 60,000 bytes | 5 | 1,250 / 750 ms | 2,500 ms | 225,000 / 35,000 bytes |
| Proposals | 100,000 bytes | 6 | 1,250 / 750 ms | 2,500 ms | 225,000 / 35,000 bytes |
| Job Cards | 30,000 bytes | 6 | 1,250 / 750 ms | 2,500 ms | 225,000 / 35,000 bytes |
| Contracting | 100,000 bytes | 6 | 1,250 / 750 ms | 2,500 ms | 225,000 / 35,000 bytes |
| Finance | 180,000 bytes | 10 | 1,250 / 750 ms | 2,500 ms | 225,000 / 35,000 bytes |
| Tickets | 120,000 bytes | 6 | 1,250 / 750 ms | 2,500 ms | 225,000 / 35,000 bytes |
| Hotels / Rooming | 180,000 bytes | 9 | 1,250 / 750 ms | 2,500 ms | 225,000 / 35,000 bytes |
| Visa Tracking | 180,000 bytes | 9 | 1,250 / 750 ms | 2,500 ms | 225,000 / 35,000 bytes |

Every route has a duplicate-subscription limit of zero.

Candidate replacements are also compared with the last accepted baseline. Payload may increase by
15% or 2,000 bytes, first content by 25% or 250 ms, logical subscriptions by 10% or one,
route-ready time by 25% or 450 ms, and transfer by 20% or 10,000 bytes, whichever allowance is
larger. Duplicate subscriptions receive no relative allowance. Repeated unchanged-runtime captures
showed roughly 400 ms of typical route-ready movement and 8–12 KB of transfer movement. Six
consecutive five-trial Preview rehearsals then supplied 240 cold and 240 warm samples for each
browser-timing metric. Cold route-ready measured 683 ms at p95 and 719 ms at p98, with one 1,116 ms
extreme; warm route-ready remained below 425 ms. First content measured 1,745 ms at cold p95 and
1,643 ms at warm p95, with 2,213 ms cold and 2,062 ms warm maxima. The rounded hard tail ceilings
are therefore 1,250 ms for cold route-ready, 750 ms for warm route-ready, 2,500 ms for first
content, and 35,000 warm-transfer bytes. Medians remain bounded by the tighter
accepted-baseline-relative rules, while every median and p95 also has to pass those hard ceilings.
Cold transfer retains its 225,000 byte ceiling. Collection runs
five isolated browser trials and records both the median and p95 for each route/mode/metric. Both
aggregations must pass every fixed gate, and every aggregation with a matching accepted predecessor
must pass its relative gate, before evidence is written. Schema-v5 evidence
also records the exact Chromium version, cache model, fixture cardinality, accepted-baseline digest
and source identity, and a target-wide zero-residual cleanup audit. Route order rotates between
trials so the post-setup infrastructure cold-start slot is distributed across routes.

The first schema-v5 replacement cannot truthfully compare p95 with a schema-v4 median. Its
provenance therefore records `p95RelativeComparison: not_available`: p95 must pass fixed budgets,
while medians compare with the accepted baseline. Every later schema-v5 replacement records
`included` and compares both median and p95 relatively.

Measurement version 2 moves the warm resource-timing reset before preload, so transfer now includes
both preload and navigation bytes, and replaces a single order-biased timing draw with rotated
repeated-trial medians. During the explicit version-1 to version-2 transition, transfer and browser
timings are ineligible for relative comparison because their definitions or aggregation changed;
payload and subscription metrics still compare with the last accepted baseline and all six fixed
ceilings remain enforced. Once a version-2 baseline is accepted, every metric is again compared
relatively.

The authenticated non-production browser baseline is stored in
[`config/release/staff-workspace-performance-baseline.json`](../config/release/staff-workspace-performance-baseline.json).
The current schema-v5 baseline was collected over five trials on 2026-08-15 from exact revision
`98404438073ac9a82279d6d0626eba7aa727d5d0`. The approved binding paired the dedicated Vercel
Preview alias with Convex Preview `elegant-bullfrog-454`; it is synthetic non-production evidence,
not a Production latency claim.

| Route | First content cold / warm | Route ready cold / warm | Transfer cold / warm | Payload bytes | Subscriptions | Duplicates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Queries | 1,418 / 1,519 ms | 23 / 12 ms | 39,392 / 14,396 bytes | 2,203 | 5 | 0 |
| Proposals | 1,491 / 1,421 ms | 35 / 13 ms | 21,842 / 2,303 bytes | 4,557 | 6 | 0 |
| Job Cards | 1,552 / 1,540 ms | 28 / 11 ms | 25,941 / 6,534 bytes | 753 | 5 | 0 |
| Contracting | 1,434 / 1,504 ms | 26 / 11 ms | 36,870 / 12,602 bytes | 5,243 | 6 | 0 |
| Finance | 1,420 / 1,506 ms | 32 / 12 ms | 36,201 / 16,143 bytes | 1,257 | 9 | 0 |
| Tickets | 1,426 / 1,422 ms | 29 / 12 ms | 37,088 / 19,622 bytes | 755 | 6 | 0 |
| Hotels / Rooming | 1,458 / 1,554 ms | 40 / 15 ms | 49,225 / 21,708 bytes | 1,034 | 8 | 0 |
| Visa Tracking | 1,449 / 1,572 ms | 48 / 12 ms | 41,191 / 19,639 bytes | 759 | 8 | 0 |

All sixteen medians and sixteen p95 aggregates passed the fixed gates; every eligible median also
passed its relative gate. The 80 raw cold/warm samples stayed within the fixed ceilings. Across the
p95 aggregates, first content peaked at 1,791 ms cold and 1,915 ms warm, route ready at 483 ms cold
and 544 ms warm, and resource transfer at 54,928 bytes cold and 26,777 bytes warm. Duplicate
subscriptions remained zero. Review confirmed that the
durable sample keys contain only route IDs and the six declared aggregate metrics. They contain no
query arguments, subscription names, CRM contents, credentials, trace data, or record identifiers.
The reviewed source closure contains 445 files with hash
`01c1200eacffb694c743bc0589bf17c23ae02b6179096362e830dcdf834fe3d5`. Post-run ownership audit
covered 138 ledgers and reported zero active actors, incomplete runs, owned or mutated records,
import/export operations, batches, chunks, storage references, and synthetic travellers without
exceeding the audit bound.

An admissible replacement contains all sixteen median and p95 cold/warm samples, a canonical
timestamp, the exact 40-character revision, browser/cache/fixture metadata, accepted-baseline
comparison provenance, a target-wide zero-residual cleanup audit, and the approved non-production
target binding. The parser validates every
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
read, billable database I/O read bytes, documents read, execution time, and OCC retries. The
calibrated cold ceilings are 64 KiB for each byte metric, 80 documents, 500 ms, and zero OCC retries;
warm ceilings are 4 KiB, four documents, 25 ms, and zero OCC retries. Candidate median and p95
samples must also remain within 50% of the accepted value, subject to small absolute noise floors of
8 KiB, ten documents, and 50 ms. These are ceilings to detect a regression, not permission to widen
a query. Convex documents index ranges as a transaction limit but does not expose a
per-execution range count in its supported completion/log-stream metrics, so the evidence contract
does not invent or proxy that value.

As with browser p95, the first schema-v3 backend replacement records
`p95RelativeComparison: not_available` and enforces fixed p95 ceilings plus median-relative limits.
Subsequent schema-v3 replacements record `included` and compare both aggregations relatively.

The checked-in schema-v3 backend baseline was measured over five provider-bound trials on the same
exact Preview binding and revision `98404438073ac9a82279d6d0626eba7aa727d5d0`. Cold medians read
between 6 and 34 documents and between 2,241 and 26,835 database I/O bytes; median execution time
ranged from 48.653 to 165.217 ms. Every warm median reported zero document and database reads, with
execution between 0.204 and 0.363 ms. All sixteen median and sixteen p95 aggregates had zero OCC
retries and passed the fixed gates; every eligible median also passed its relative gate. The
privacy-safe baseline shares the 445-file source closure and hash
`01c1200eacffb694c743bc0589bf17c23ae02b6179096362e830dcdf834fe3d5`; changing any covered UI data
owner or representative reader makes both Staff baselines stale.

| Route | Cold I/O bytes | Cold documents | Cold execution | Warm execution | OCC retries |
| --- | ---: | ---: | ---: | ---: | ---: |
| Queries | 18,274 | 24 | 88.103 ms | 0.204 ms | 0 |
| Proposals | 26,835 | 34 | 102.095 ms | 0.241 ms | 0 |
| Job Cards | 4,837 | 13 | 71.177 ms | 0.237 ms | 0 |
| Contracting | 5,557 | 16 | 56.842 ms | 0.233 ms | 0 |
| Finance | 9,266 | 25 | 165.217 ms | 0.359 ms | 0 |
| Tickets | 16,338 | 25 | 81.715 ms | 0.253 ms | 0 |
| Hotels / Rooming | 4,413 | 12 | 89.436 ms | 0.363 ms | 0 |
| Visa Tracking | 2,241 | 6 | 48.653 ms | 0.340 ms | 0 |

The p95 aggregates peaked at 26,835 database I/O bytes, 40 documents, 408.389 ms cold execution,
and 0.515 ms warm execution, with zero OCC retries. Collection used five separately owned provider
streams, each stopped immediately after its paired browser trial; raw provider events were not
persisted.

For a refresh, first run the five-trial strict authenticated performance collector. With a clean
checkout whose revision matches the approved deployed target, let the backend collector verify both
live identities and own five additional isolated browser trials. It starts a provider-native Convex
JSONL stream before each trial so the provider's finite history window cannot evict early route
completions before collection. Raw provider events remain in memory; only aggregated median and p95
values are written:

```bash
bun run performance:backend:collect
```

The browser lane waits for a non-empty privacy-safe subscription set before closing each observation
window. Backend observation starts before cold portal setup and before the warm return/preload so
shell and prefetched subscription completions remain inside the correlated window; route-ready
timing remains anchored to the navigation-start mark. The collector rejects missing route/function
completions, empty or malformed windows, revision drift, unsafe subscription names, and
unknown/Production targets. Each stream has a five-minute hard deadline, must produce JSON history,
and is stopped immediately after its browser trial; evidence records all five termination modes.
The collector emits only aggregated schema-v3 metrics below
`.scratch/performance/`. Review that file, then prepare the revision/source-bound baseline candidate:

```bash
bun run performance:backend:ingest -- .scratch/performance/<safe-metrics-export>.json
```

The collection command contacts only the exact manifest-approved Convex Preview after independent
frontend and Convex identity checks; ingestion then operates only on the privacy-safe aggregate.
Ingestion rejects unknown fields, missing cold/warm routes, Production-like target IDs, a target not
bound to the approved frontend/Convex origin pair, revision drift, a dirty tracked tree, or a fixed
or relative median/p95 finding. It writes a candidate below `.scratch/performance/`; review that
aggregate before replacing the checked-in baseline. Raw arguments, CRM contents, identities,
tokens, URLs, deployment credentials, and provider event streams are not valid export fields.

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
