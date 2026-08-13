# CRM search and metric readiness

Portal list search and dashboard totals use bounded Convex projections. They are versioned, generation-scoped, idempotent, and safe to retry. An older worker cannot publish over a newer generation.

Portal workflow nudges use the same bounded-operation discipline. One daily generation advances through 50-row Query, Job Card, Traveller, Ticket, and Invoice pages with a stable reference clock and continuation token. Traveller paging makes visa, ticket, and canonical passport-expiry checks complete without a per-Job-Card row cap.

## Workflow nudge policy and recovery

- `thresholdHours` is the detection boundary for the selected rule. It must be finite and between 0 and 720 hours. Saving a different threshold changes the Query or Job Card age comparison and its notification copy.
- Repeat quieting is a separate fixed 24-hour policy. Lowering a detection threshold never shortens the replay-deduplication window.
- Only `expired` or `critical` canonical passport urgency blocks departure; warning, ok, and unknown states do not alert. Notification text contains the Job Card code, never Traveller names or passport values.
- One active generation rejects overlap and stale continuation tokens. Transient page failures retry after bounded one-, two-, and four-minute delays; the fourth failed attempt is terminal and remains inspectable.
- A deterministic or retry-exhausted failure does not restart again on the same daily cadence. The next daily boundary starts a fresh generation, retaining a compact prior failure code, kind, and timestamp.
- Two consecutive failed or stale daily generations expose a `degraded` health state to authorized workflow operators. A complete generation clears the consecutive-failure count.
- Authorized manual retry resumes the stored stage and cursor and cannot exceed three retries for one generation. Successful notification receipts preserve the 24-hour rule/entity quiet period across retry and fresh generations.

## Deployment behavior

`convex/crons.ts` starts metric reconciliation every 15 minutes and list-search reconciliation hourly. After a first deployment or projection-version change, do not interpret an empty search result or sampled dashboard detail as authoritative until readiness is current.

Before release, run `bun run test -- convex/crons.test.ts` for the exact local nine-job registry and
IST boundary contract. Local serialization does not prove installation. After an authorized
deployment, confirm the names, internal targets, arguments, and schedules in that deployment's
Convex dashboard. Operators may then invoke the internal reconciliation entrypoints through the
approved Convex operational workflow; do not expose them as public mutations. Re-running them is
safe: an active current generation is reused, an interrupted/stale generation is replaced, and old
pages abort.

## User-visible states

- List search fails closed while its table projection is not current and preserves the entered filter with actionable preparing copy.
- The dashboard shows a persistent partial/stale notice until a complete current aggregate exists. It includes the last full completion when available.
- Readiness exposes only version, generation, completed sources/tables, timestamps, state, and a safe error summary. It never exposes row contents, secrets, or worker stack traces.

## Verification

Use `bun run test -- convex/crm/listSearch.test.ts convex/crm/metricAggregates.test.ts convex/crm/dashboard.test.ts src/components/portal/dashboard/dashboardCoverageNotice.test.js` for search and metric readiness. Use `bun run test -- convex/crm/workflowNudges.test.ts convex/crm/passportExpiry.test.ts src/lib/portal/passportExpiry.parity.test.js convex/crons.test.ts` for nudge thresholds, complete Traveller paging, privacy-safe passport detection, retry exhaustion, next-cadence restart, quiet-period replay, and cron registration.

These are target-neutral source checks. Cron installation and an actual daily restart require a separately identified non-production Convex deployment; do not infer them from local registry serialization.
