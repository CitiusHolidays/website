# CRM search and metric readiness

Portal list search and dashboard totals use bounded Convex projections. They are versioned, generation-scoped, idempotent, and safe to retry. An older worker cannot publish over a newer generation.

## Deployment behavior

`convex/crons.ts` starts metric reconciliation every 15 minutes and list-search reconciliation hourly. After a first deployment or projection-version change, do not interpret an empty search result or sampled dashboard detail as authoritative until readiness is current.

Before release, confirm the cron registrations are present and run the focused readiness tests. After an authorized deployment, operators may invoke the internal reconciliation entrypoints through the approved Convex operational workflow; do not expose them as public mutations. Re-running them is safe: an active current generation is reused, an interrupted/stale generation is replaced, and old pages abort.

## User-visible states

- List search fails closed while its table projection is not current and preserves the entered filter with actionable preparing copy.
- The dashboard shows a persistent partial/stale notice until a complete current aggregate exists. It includes the last full completion when available.
- Readiness exposes only version, generation, completed sources/tables, timestamps, state, and a safe error summary. It never exposes row contents, secrets, or worker stack traces.

## Verification

Use `bun test convex/crm/listSearch.test.ts convex/crm/metricAggregates.test.ts convex/crm/dashboard.test.ts src/components/portal/dashboard/dashboardCoverageNotice.test.js`. Tests cover first deployment, interrupted/stale generations, retries, version changes, bounded repair, complete publication, search fail-closed behavior, and partial/stale dashboard presentation.
