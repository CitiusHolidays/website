# CRM search and metric readiness

Portal list search and dashboard totals use bounded Convex projections. They are versioned, generation-scoped, idempotent, and safe to retry. An older worker cannot publish over a newer generation.

Portal workflow nudges use the same bounded-operation discipline. One daily generation advances through 50-row Query, Job Card, Traveller, Ticket, and Invoice pages with a stable reference clock and continuation token. Traveller paging makes visa, ticket, and canonical passport-expiry checks complete without a per-Job-Card row cap.

The portal bell also has explicit projection readiness. Notification and receipt totals are
backfilled in 50-row pages, then independently rescanned. Before all four stages complete, unread
coverage is partial; the shell never labels the bounded legacy fallback as exact.

Workflow email has a separate privacy-safe origin row. When an operational control disables the
bell but leaves email enabled, the CRM stores the event label, entity link, and authorized staff
identities without storing recipient addresses. Department heads and other staff with delivery
status permission can therefore inspect the email outcome even though no bell row exists. The
publisher writes that origin in the same transaction that queues the email, so an email-only event
cannot become an unauditable provider side effect.

Outstanding invoices use `hasOutstandingBalance = balanceAmount > 0` as a writer-maintained
projection. Finance reads retain the bounded legacy filter until version 1 readiness is complete
with zero residuals; only then do they use `by_hasOutstandingBalance_and_createdAt`.

## Inbound enquiry index rollout

Inbound-list requests apply the shared server ceiling immediately and the default Pending branch
starts from the existing `by_status` index. The more selective status/date, status/source/date, and
direct handoff-event indexes are staged in source. Readers must not depend on those staged indexes
until each named deployment reports them ready.

For every approved non-production target, keep the rollout evidence separate:

1. Deploy the widened optional terminal fields and staged indexes.
2. Verify `by_status_createdAt`, `by_status_source_createdAt`, and
   `by_inboundIntentId_createdAt` are backfilled and ready on that exact deployment.
3. Inventory legacy handoff events for duplicate inbound-intent IDs and record the deterministic
   newest-event rule before reader cutover.
4. Switch filtered list branches and the legacy handoff fallback to the ready indexes, then run
   sparse-match pagination and duplicate-event fixtures against that deployment.

New intents store their direct handoff event ID, so conversion does not scan the event table. Rows
created before that field was introduced retain the bounded compatibility lookup until the direct
index cutover. Production activation is a separate later decision; local schema serialization is
not target readiness proof.

## Outstanding invoice rollout

Treat schema/index installation, reconciliation, and reader cutover as distinct evidence gates for
each named deployment:

1. Deploy the widened optional invoice field, readiness table, and compound index without making
   the reader depend on the projection.
2. Confirm that exact deployment's index is ready. Start the internal
   `crm/invoiceOutstandingProjection:startProjectionReconciliation` operation through the approved
   target-aware Convex workflow.
3. Poll the internal `getProjectionStatus` result. It pages legacy invoices, writes the projection,
   and then independently rescans every page. Do not claim readiness unless the result is
   `status: complete`, `stage: complete`, `ready: true`, and `residuals: 0` for version 1.
4. Release the reader cutover. During a mixed-version rollout, source retains the legacy bounded
   query until the verified readiness row exists, so unprojected invoices are not hidden.

Every invoice create/update writes the derived boolean in the same transaction as `balanceAmount`.
A verification mismatch fails closed and requires investigating the missing writer before starting
a new generation. Development, Preview, and Production evidence are separate; never reuse one
deployment's readiness row as proof for another.

## Workflow nudge policy and recovery

- `thresholdHours` is the detection boundary for the selected rule. It must be finite and between 0 and 720 hours. Saving a different threshold changes the Query or Job Card age comparison and its notification copy.
- Repeat quieting is a separate fixed 24-hour policy. Lowering a detection threshold never shortens the replay-deduplication window.
- Only `expired` or `critical` canonical passport urgency blocks departure; warning, ok, and unknown states do not alert. Notification text contains the Job Card code, never Traveller names or passport values.
- One active generation rejects overlap and stale continuation tokens. Transient page failures retry after bounded one-, two-, and four-minute delays; the fourth failed attempt is terminal and remains inspectable.
- A deterministic or retry-exhausted failure does not restart again on the same daily cadence. The next daily boundary starts a fresh generation, retaining a compact prior failure code, kind, and timestamp.
- Two consecutive failed or stale daily generations expose a `degraded` health state to authorized workflow operators. A complete generation clears the consecutive-failure count.
- Authorized manual retry resumes the stored stage and cursor and cannot exceed three retries for one generation. Successful notification receipts preserve the 24-hour rule/entity quiet period across retry and fresh generations.

## Deployment behavior

`convex/crons.ts` starts metric reconciliation every 15 minutes and list-search reconciliation
hourly. List-search writers also coalesce durable dirty units by table and source ID. The hourly
entry checks the indexed dirty queue and four readiness rows; when every table is current and the
queue is empty, it traverses no source rows and schedules no page worker. Dirty workers process at
most 50 units per transaction, retain the unit if a transaction fails, and consume a missing source
as a deletion tombstone.

After the dirty table and indexes are installed on an identified target, a first deployment or
projection-version change still runs the serialized full repair. Do not interpret an empty search
result as authoritative until all four readiness rows are current. An operator may request an
explicit integrity repair with the internal `crm/listSearch:reconcileAll` entrypoint and
`{ "force": true }`; this keeps the last complete publication readable while all four source tables
are traversed in bounded pages. Ordinary cron calls omit `force`.

Before release, run `bun run test -- convex/crons.test.ts` for the exact local twelve-job registry and
IST boundary contract. Local serialization does not prove installation. After an authorized
deployment, confirm the names, internal targets, arguments, and schedules in that deployment's
Convex dashboard. Operators may then invoke the internal reconciliation entrypoints through the
approved Convex operational workflow; do not expose them as public mutations. Re-running them is
safe: an active current generation is reused, an interrupted/stale generation is replaced, and old
pages abort.

## User-visible states

- List search fails closed while its table projection is not current and preserves the entered filter with actionable preparing copy.
- The dashboard shows a persistent partial/stale notice until a complete current aggregate exists. It includes the last full completion when available.
- List-search readiness exposes a privacy-safe dirty-queue signal and oldest pending timestamp, not
  source IDs, row contents, or an unbounded count.
- Readiness exposes only version, generation, completed sources/tables, timestamps, state, and a safe error summary. It never exposes row contents, secrets, or worker stack traces.
- Bell unread state remains click-only and per staff identity. Role changes alter which exact target
  counters are summed without rewriting history, and auth relink continues to use the staff key.

## Exact-Admin runtime health composition

Operational Controls includes a lazy `Runtime health` tab for authenticated exact Admin staff. Its
query runs only while that tab is active, accepts a client reference time for deterministic
classification, and composes bounded indexed reads over the existing five projection-readiness
owners, twelve scheduled-job controls/latest receipts, and the scheduled workflow-nudge row. It is
read-only and offers navigation to Feature controls, Activity, and Test Lab; it cannot retry,
reconcile, pause, schedule, or self-heal anything.

The same query reads at most 501 retained AI telemetry rows and returns aggregate categories for at
most 500 events. Each experience reports sample size, complete/truncated coverage, observed/Unknown
state, closed outcome counts, closed latency buckets, and canonical-tool/Unknown grounding counts.
Historical rows without the newer category fields remain Unknown instead of being inferred healthy.
The aggregate does not return conversation text, provider bodies, model identifiers, token counts,
contact details, or record identifiers.

The response vocabulary is closed: `ready`, `reconciling`, `stale`, `degraded`, `paused`,
`suppressed`, and `not_observed`. Missing rows are always `not_observed`. Pending projection work
becomes stale after one hour, a running workflow-nudge generation after fifteen minutes, fifteen-
minute jobs after one hour, hourly jobs after three hours, and daily jobs after thirty-six hours.
Current completed projection markers do not age merely because their checkpoint is old; their
owning incremental writer/readiness contract remains authoritative.

The composition exposes only stable labels, closed status, static summary copy, and timestamps. It
does not return effect or record IDs, fingerprints, raw failure codes/messages, stacks, provider
payloads, source data, platform logs, or performance baselines. It is application-owned evidence,
not Convex platform health or monitoring-provider status. The existing target banner remains the
target identity boundary, and bootstrap-only Admin identity is insufficient because exact Admin
requires a current staff record.

## Verification

Use `bun run test -- convex/crm/listSearch.test.ts convex/crm/metricAggregates.test.ts convex/crm/dashboard.test.ts src/components/portal/dashboard/dashboardCoverageNotice.test.js` for search and metric readiness. Use `bun run test -- convex/crm/workflowNudges.test.ts convex/crm/passportExpiry.test.ts src/lib/portal/passportExpiry.parity.test.js convex/crons.test.ts` for nudge thresholds, complete Traveller paging, privacy-safe passport detection, retry exhaustion, next-cadence restart, quiet-period replay, and cron registration. Run `bun test convex/crm/financeOverviewReads.test.ts` plus the registered Convex integration suite for invoice writer, multi-page backfill, residual verification, and indexed-read parity.

These are target-neutral source checks. Cron installation and an actual daily restart require a separately identified non-production Convex deployment; do not infer them from local registry serialization.
