# Production Test Lab and Live Feature Controls

Staff Workspace Settings gives the exact `Admin` role two separate operational tools. Directors
and every other role are denied both the browser queries and the Convex mutations.

- **Production Test Lab** checks major feature boundaries through recording substitutes. It does
  not send communications, create CRM or payment records, call providers, write files, publish
  content, or execute scheduled jobs.
- **Live Feature Controls** changes normal traffic. An Admin stages changes, reviews the complete
  set and target, supplies a reason, and applies the set immediately in one Convex transaction.

Every screen shows the environment, deployment identity, and source revision. A local result, a
Preview result, and a Production result are separate evidence.

## Live Feature Controls

The catalog contains 27 independently recoverable records: 26 available controls plus the
historical, unavailable Journey Planner record.

- public Sacred Bharat / 001 availability;
- inbound CRM intake, Sales bell, Sales email, and `info@citius.in` mailbox email;
- master CRM bell and workflow-email channels;
- consented Customer journey reminder requests through Sent;
- Auth verification, password-reset, and staff-setup emails;
- Citius Concierge provider requests plus the retained historical Journey Planner control record;
- Razorpay new-order creation (not verification, webhooks, or in-flight completion);
- document-preview preparation; and
- twelve individual scheduled jobs.

The catalog shows **Configured State** separately from **Blocked Capability**. A control can be
configured as Available while a paused dependency prevents the capability from running. The
switch always represents the configured state; the blocking feature is named separately. **Use
normal behavior** removes the explicit override and returns to the catalog behavior.

The historical Journey Planner key is unavailable and remains visible for audit compatibility, but the retired HTTP
route returns 410 before control resolution or provider work. Its presence is not an available
public capability and does not authorize deleting old control or telemetry rows.

The catalog is grouped by product area and supports search plus Paused, Temporary, Blocked, and
Staged filters. Technical keys, revisions, dependencies, and enforcement seams stay in expandable
details.

### Review and apply

An Admin may stage any number of changes. Review and Apply displays every before/after state, the
exact target, the restoration choice, and one required multiline reason. The reason has no product
character limit or client-side truncation. Apply uses optimistic revisions: if any row is stale or
invalid, the entire transaction fails and no control changes.

The staged set is also the bounded cutover queue. Before Apply becomes available, an exact-Admin
read-only query rehearses that set at one explicit reference time. The rehearsal names the target
environment, deployment and source revision; each expected control revision and dependency; the
resulting downstream effect; and the exact state that Undo or Automatic Restoration would restore.
It writes no queue row, audit, change set or scheduled function. The rendered rehearsal is not an
authorization token: Apply independently rechecks exact target identity, source revision, current
control revisions, readiness and rollback ownership in its own transaction. Source or schema
presence alone never certifies a target-bound staged index, projection or migration as ready.

A successful mutation records a Production Change Set and audit identity. The Settings surface
keeps the newest durable receipt visible with the actor, time, target, revision, reason,
before/after states, and restoration time.

### Automatic Restoration

A temporary Production Change Set schedules an internal Convex mutation for 30 minutes, 2 hours,
or 24 hours later. These are server-authoritative durations: Convex validates the selected duration
and calculates the restoration deadline from its own clock, so a browser cannot choose an arbitrary
deadline. The change set stores the complete state immediately preceding Apply. At the scheduled
time, every changed control is restored atomically to that exact snapshot.

Restoration succeeds only while every changed control still belongs to the change set at the
expected revision. A conflict changes nothing and records a dedicated failed-restoration audit.
Successful restoration records its own audit and is idempotent.

### Undo

Undo is offered only for the newest change set whose complete applied state is still current—even
when an older current change set controls a disjoint capability. It restores the complete preceding
state, cancels scheduled restoration, writes one audit, and marks the change set Undone. A repeated
click, historical change, rollback of an Undo, or superseded state is rejected. Historical entries
remain view-only.

Activity events, effect receipts, and Test Lab runs are immutable and paginated. Change-set cards
show the current resolution state and link to those separate activity event IDs.

## Production Test Lab

The Test Lab intentionally covers major operational boundaries rather than routine CRM CRUD that
already has automated test coverage. The initial recipes are:

- Inbound Leads;
- Auth email;
- CRM notifications;
- Citius Concierge;
- the retained historical Journey Planner recording recipe (no live planner request);
- Razorpay new-order creation;
- document-preview preparation;
- Sacred Bharat publication; and
- all twelve scheduled-job registrations.

Effect v4 owns recipe sequencing, typed probe failures, controlled service layers, independent
continuation, timeout/interruption, and cleanup. Each recipe checks the corresponding live gates,
validates its immutable input and domain preparation, reaches controlled recording boundaries,
records redacted descriptions of effects that would have occurred, and then runs cleanup. Results
include Passed, Failed, or Skipped steps, duration, cleanup status, target identity, source revision,
and an optional Admin note. A failed recipe does not prevent independent selected recipes from
producing evidence.

The Auth email and CRM notifications recipes also run a fixed communications rehearsal catalog:
success, 429 then success, provider 5xx through bounded exhaustion, and receipt-write failure before
provider invocation. Each scenario uses recording substitutes, checks the exact status sequence and
stable idempotency identity, and records only redacted categories and provider-call counts. No recipe
calls Resend or another provider, and passing rehearsal evidence must never be presented as provider
or inbox health. Typed recipe failures keep only bounded privacy-safe detail; unexpected causes,
stacks, recipient data, credentials, and provider bodies collapse to a generic failure description.

A run is persisted as Running before its Effect program starts. A second run that overlaps any
active recipe for the same Admin is rejected. Recipe choices and the note are immutable after start;
Staff Workspace locks those controls and offers Resume when a reload discovers active work. Reusing
the original command resumes the same run rather than creating duplicate evidence. If an overlapping
run remains Running for more than 15 minutes, the next start closes the interrupted run as Failed with
durable evidence before creating its replacement.

Production Test Lab evidence is stored only in `productionTestRuns`; it does not create synthetic
leads or ordinary business rows. A paused or blocked live control yields Skipped evidence instead
of temporarily overriding normal traffic.

## Runtime behavior and safety kernel

All runtime enforcement resolves on the server at the final effect boundary. A dependent effect
cannot bypass its master control. New Razorpay order creation can be paused, while verification,
webhooks, and already-started payment completion remain available. The exact-Admin authorization,
control reads and writes, audit/evidence storage, Automatic Restoration, and in-flight payment
completion are part of the Operational Safety Kernel and are not exposed as controls.

Pausing Customer journey reminders suppresses only new Sent WhatsApp requests and the authorized
RCS fallback requests that have not crossed the provider boundary. It never creates consent,
replays a suppressed attempt, cancels an already-started provider request, or blocks authenticated
Sent webhook reconciliation.

The activation marker remains only for release setup. Activation, status inspection, and catalog
migration are internal Convex functions and are not callable by Staff Workspace. Both activation
and `migrateOperationalControlCatalog` require the operator to pass the expected environment,
deployment identity, and source revision; a mismatch rejects the complete operation. During a
mixed-version rollout, the server temporarily accepts the four retired coarse keys and an old
gateway payload with `synthetic: false`. Fine-grained state takes precedence; otherwise the coarse
row supplies the compatible state. Catalog migration copies that row's state, expiry, reason,
revision, and actor provenance to its fine-grained replacements before deleting it. Legacy clients
may also submit an absolute restoration time only when it maps within five minutes of one of the
three supported durations. Synthetic overrides, test tokens/scopes, the retired per-row setter,
historical rollback, and synthetic override/session tables remain unavailable.

## Target configuration and release boundary

Non-development targets must provide:

- `OPERATIONAL_CONTROL_TARGET_ID`, a human-recognizable deployment identity; and
- `OPERATIONAL_CONTROL_SOURCE_REVISION`, the exact source revision.

`VERCEL_ENV` identifies Development, Preview, or Production. Missing or unsupported identity fails
closed on every target. The gateway secret used by runtime enforcement remains server-only. Main
Production builds validate Vercel's exact 40-character Git revision, deploy Convex, and then update
`OPERATIONAL_CONTROL_SOURCE_REVISION` plus `VERCEL_ENV=production` together on that selected Convex
deployment. `OPERATIONAL_CONTROL_TARGET_ID` remains one-time target configuration. Preview identity
remains separately configured and is not changed by the main Production release path.

Source implementation, local tests, and target-neutral builds do not authorize deployment,
catalog migration, activation, Preview mutation, Production mutation, or domain promotion. Each
hosted action requires fresh authority for the exact target, and its evidence must be recorded
separately.
