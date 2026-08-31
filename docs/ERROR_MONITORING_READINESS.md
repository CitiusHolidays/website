# Error-monitoring readiness

The repository records `@sentry/nextjs@10.71.0` as the reviewed source-level provider choice, but
that application integration is not a direct dependency or activated. The authoritative state is
[`config/release/error-monitoring-readiness.json`](../config/release/error-monitoring-readiness.json),
which is `preview_configuration_ready`: the decision inputs are complete, while `previewEvidence`
remains `null`. No `@sentry/nextjs` package entry, DSN, Convex component, platform-log stream,
environment variable, source-map upload, alert, Preview monitor, or Production monitor is implied
by that state.

## Recorded source decision

The bounded first implementation, if separately authorized for an exact Preview target, uses:

- [Sentry's official Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
  package `@sentry/nextjs` at the pinned reviewed version `10.71.0`;
- the checked-in cost, privacy, operations, and incident-response roles;
- 30-day retention, full sampling of allowlisted error events, an 8 KiB event cap, and ten events
  per source per minute;
- disabled source-map upload and versioned `closed-error-v1` write-time redaction;
- provider-owned grouping, retention, and alert delivery only after an approved Preview setup.

This is an error-only decision. Performance tracing, session replay, raw console forwarding,
platform-log ingestion, browser incident enumeration, and application-owned incident storage are
outside the selected scope. Sentry's [current published plans](https://sentry.io/pricing/) provide a
30-day lookback or longer; before Preview activation, verify that the exact account can enforce the
checked-in 30-day bound, verify the pinned package against the exact source revision, approve the
target and credentials, and define alert destinations under the recorded incident owner. If the
account cannot enforce the bound, the integration remains inactive.

Do not install `@convex-dev/sentinel` by name unless an exact supported source and version is first
verified. Do not store the same incident in both an application-owned Convex table and an external
provider merely to satisfy two designs; that duplicates sensitive-data and retention ownership.

## Mandatory privacy boundary

Only allowlisted, bounded diagnostics may leave the process: schema version, environment,
revision, stable source category, normalized error category, safe request/correlation ID, bounded
occurrence counts, and timestamps. Raw messages and stacks require explicit normalization.
Secrets, tokens, cookies, signatures, request bodies, email addresses, phone numbers, CRM values,
passport or visa data, payment fields, document contents, provider response bodies, and
client-supplied identifiers are dropped before egress.

Browser capture must be narrow and bounded. A browser may submit a redacted event but may never
enumerate stored incidents. Existing Staff Workspace and Customer Account error boundaries retain
their separate recovery UI and authorization behavior.

## Preview verification gate

After separate authorization, configure only an explicitly approved Preview first. The checked-in
readiness parser refuses `preview_verified` unless evidence embeds the complete approved-target
binding: exact 40-character revision, frontend origin, Convex origin and source hash,
deployment-bound target ID, and an explicit Preview target class. It also requires one safe
synthetic check for each of:

- Next server failure;
- React error-boundary failure;
- `window.onerror`;
- unhandled Promise rejection;
- provider alert delivery.

The Preview exercise must also prove redaction, deduplication, sampling, volume caps, retention,
least-privilege reads, and source-map policy. Monitoring is observation only: it never authorizes a
code change, database mutation, deployment, self-healing action, or external message.

Production activation, a Production canary, bounded monitor reads, and proof that an error stopped
recurring remain separate approval and evidence gates.
