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
three-trial medians. During the explicit version-1 to version-2 transition, transfer and browser
timings are ineligible for relative comparison because their definitions or aggregation changed;
payload and subscription metrics still compare with the last accepted baseline and all six fixed
ceilings remain enforced. Once a version-2 baseline is accepted, every metric is again compared
relatively.

The authenticated non-production browser baseline is stored in
[`config/release/staff-workspace-performance-baseline.json`](../config/release/staff-workspace-performance-baseline.json).
The current schema-v4 baseline was collected over three trials on 2026-08-15 from exact revision
`59e703531feb7e63887382801cef860badde9546`. The approved binding paired the dedicated Vercel
Preview alias with Convex Preview `elegant-bullfrog-454`; it is synthetic non-production evidence,
not a Production latency claim.

| Route | First content cold / warm | Route ready cold / warm | Transfer cold / warm | Payload bytes | Subscriptions | Duplicates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Queries | 1,480 / 1,310 ms | 433 / 12 ms | 41,386 / 19,503 bytes | 2,203 | 5 | 0 |
| Proposals | 1,476 / 1,437 ms | 34 / 13 ms | 21,841 / 3,292 bytes | 4,557 | 6 | 0 |
| Job Cards | 1,377 / 1,465 ms | 27 / 12 ms | 25,931 / 5,814 bytes | 753 | 5 | 0 |
| Contracting | 1,441 / 1,481 ms | 23 / 12 ms | 36,781 / 14,349 bytes | 5,243 | 6 | 0 |
| Finance | 1,439 / 1,287 ms | 31 / 12 ms | 39,272 / 13,384 bytes | 1,257 | 9 | 0 |
| Tickets | 1,415 / 1,570 ms | 20 / 11 ms | 37,061 / 21,604 bytes | 755 | 6 | 0 |
| Hotels / Rooming | 1,307 / 1,431 ms | 42 / 14 ms | 49,452 / 13,370 bytes | 1,034 | 8 | 0 |
| Visa Tracking | 1,401 / 1,299 ms | 24 / 12 ms | 39,462 / 18,900 bytes | 759 | 8 | 0 |

All sixteen medians passed the fixed and relative budgets. The final 48 raw cold/warm samples also
stayed within the fixed ceilings. Review confirmed that the
durable sample keys contain only route IDs and the six declared aggregate metrics. They contain no
query arguments, subscription names, CRM contents, credentials, trace data, or record identifiers.
The reviewed source closure contains 443 files with hash
`7c446bbdafc0256702bcc098df8d9bb83dbab6e8ffbf8a6c1acf2ff0df74176b`. Post-run ownership audit
reported zero active actors, incomplete runs, owned or mutated records, import/export artifacts,
storage references, and synthetic travellers.

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

The checked-in schema-v2 backend baseline was measured on the same exact Preview binding and revision
`59e703531feb7e63887382801cef860badde9546`. Cold samples read between 6 and 34 documents and between
2,241 and 26,835 database I/O bytes; provider execution time ranged from 28.935 to 173.517 ms. Every
warm sample reported zero document and database reads, with execution between 0.187 and 0.591 ms.
All sixteen samples had zero OCC retries and passed the fixed ceilings. The privacy-safe baseline
shares the 443-file source closure and hash
`7c446bbdafc0256702bcc098df8d9bb83dbab6e8ffbf8a6c1acf2ff0df74176b`; changing any covered UI data
owner or representative reader makes both Staff baselines stale.

| Route | Cold I/O bytes | Cold documents | Cold execution | Warm execution | OCC retries |
| --- | ---: | ---: | ---: | ---: | ---: |
| Queries | 18,274 | 24 | 173.517 ms | 0.191 ms | 0 |
| Proposals | 26,835 | 34 | 107.614 ms | 0.354 ms | 0 |
| Job Cards | 4,837 | 13 | 71.101 ms | 0.218 ms | 0 |
| Contracting | 5,557 | 16 | 28.935 ms | 0.591 ms | 0 |
| Finance | 9,266 | 25 | 139.174 ms | 0.294 ms | 0 |
| Tickets | 16,338 | 25 | 133.531 ms | 0.187 ms | 0 |
| Hotels / Rooming | 4,413 | 12 | 122.482 ms | 0.433 ms | 0 |
| Visa Tracking | 2,241 | 6 | 34.993 ms | 0.256 ms | 0 |

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
