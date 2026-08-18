# Error-monitoring readiness

The repository is ready to make an error-monitoring provider decision, but no provider is selected
or activated. The authoritative state is
[`config/release/error-monitoring-readiness.json`](../config/release/error-monitoring-readiness.json),
which currently remains `provider_selection_required`. No package, Convex component, log stream,
environment variable, source-map upload, alert, or Production monitor is implied by that state.

## Decision required before implementation

The product, privacy, cost, incident, and operations owners must jointly record:

- the supported provider and exact package or integration version;
- one owner each for cost, privacy, operations, and incident response;
- retention duration, sampling rate, event-size cap, and per-source volume cap;
- whether source maps remain disabled or are uploaded privately to the provider;
- a versioned write-time redaction policy;
- which system owns retry, grouping, retention, and alerting for each event class.

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

After the decision is recorded, configure only an explicitly approved Preview first. The checked-in
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
