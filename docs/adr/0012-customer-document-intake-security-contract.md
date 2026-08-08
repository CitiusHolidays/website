# ADR 0012: Customer Document Intake security contract

- Status: Accepted
- Accepted: 2026-08-07
- Scope: future Customer Travel Account document intake only

## Decision

Customer Document Intake may be implemented only as a narrowly scoped capability for one
Traveller and an explicit list of requested Sensitive Travel Documents. An Intake Link never
grants Customer Travel Account, Job Card, staff, or sibling-Traveller access.

This ADR is a prerequisite, not an implementation. No upload endpoint, table, or UI should be
introduced until every control below has an executable acceptance test and an assigned operator.

## Scope and authority

- Staff with the existing passport or visa authority selects exactly one Traveller and the
  requested document kinds. The link cannot accept unrequested kinds.
- The server resolves the Traveller and Job Card from the stored grant. Browser-supplied entity IDs
  are never authority.
- The recipient can create candidate uploads and view the status of their own candidates only.
  They cannot list, read, replace, or delete another Traveller's records.
- An accepted candidate can update only the document slot named by its grant. It cannot change
  confirmed offers, payments, bookings, queries, proposals, job cards, passport or visa facts, or
  any Staff Workspace workflow state directly.

## Intake Link identity and lifecycle

- Store only a keyed digest of a cryptographically random token. The raw token appears once in the
  HTTPS link and is never logged, persisted, or included in analytics.
- Bind the grant to one Traveller, requested document kinds, issuer, creation time, absolute expiry,
  use limit, and revocation state. Default expiry is 24 hours and maximum expiry is 72 hours.
- Require a second factor derived from a staff-verified contact channel before upload. A bearer link
  alone is insufficient.
- A grant is single-use for final submission. Retries may resume the same incomplete upload session
  until expiry, but successful submission atomically consumes the grant.
- Rate-limit token checks and verification attempts by grant and privacy-preserving network key.
  Revoke after repeated failures and provide only a generic public error.

## Storage, encryption, and malware handling

- Upload into quarantine with a server-issued one-use upload session. Enforce an allow-list of PDF,
  JPEG, and PNG using signature detection, not filename or browser MIME alone.
- Enforce per-file and per-grant size/count limits before durable acceptance. Reject archives,
  executables, polyglots, password-protected files, and active content.
- Encrypt in transit and at rest. Application metadata must not contain document contents, raw
  passport numbers, or unencrypted extracted identity facts.
- Quarantined objects are unavailable to customers and staff. An asynchronous malware scan and
  content-validation result is required before promotion to protected storage.
- Promotion is an atomic state transition. Scan failure, timeout, or unavailable scanning keeps the
  object quarantined; it never fails open.

## Access, retention, and deletion

- Customer reads use the authenticated account identity plus the consumed grant; staff reads use
  the existing document permissions and Traveller/Job Card scope.
- Generate short-lived download URLs only after each authorization check. Never expose permanent
  storage URLs or storage IDs to the browser.
- Purge rejected, abandoned, and expired quarantine objects within 24 hours. Purge security event
  metadata after 90 days unless an incident hold applies.
- Accepted-document retention follows the documented passport/visa retention schedule. If no
  schedule is configured, launch is blocked; indefinite retention is not the default.
- Revocation prevents new reads and submissions immediately. Deletion is idempotent and records the
  actor, reason, affected digest, and completion state without retaining document content.

## Audit and privacy

- Record grant creation, delivery channel, verification, upload start, content digest, scan outcome,
  promotion, read, replacement, revocation, expiry, and deletion with timestamp and stable actor.
- Audit records never contain the raw token, file bytes, passport number, full address, or extracted
  document text. Security logs use correlation IDs and document digests.
- Do not send document content, filenames containing identity data, or Intake Links to product
  analytics, AI systems, email templates, or notification bodies.

## Failure and recovery

- Interrupted uploads can resume only inside the same unexpired session and must revalidate size,
  digest, grant state, and requested kind before finalization.
- Duplicate finalization returns the first result without creating a second accepted record.
- Staff replacement preserves the prior accepted record as protected history according to the
  retention policy; customers cannot overwrite it by retrying an old link.
- Recovery creates a new grant after staff re-verifies the Traveller's contact. Tokens are never
  extended, reactivated, or disclosed by support.
- Scanning, storage, or audit unavailability blocks promotion and returns a recoverable generic
  status. Operators receive a correlation ID and a bounded retry procedure.

## Required launch evidence

- Authenticated tests prove one-Traveller and requested-kind isolation, including guessed IDs,
  sibling Travellers, expired/revoked/consumed grants, and role boundaries.
- Tests prove token digests, single-use atomicity, retry idempotency, quarantine, signature/size
  checks, scan fail-closed behavior, protected downloads, retention cleanup, and audit redaction.
- A threat-model review covers token leakage, replay, enumeration, CSRF, XSS, malware/polyglots,
  storage URL leakage, staff misuse, notification leakage, and backup/restore behavior.
- A privacy owner accepts the retention schedule and a security owner accepts the scanner,
  encryption, incident, and recovery runbooks before production enablement.

## Consequences

This contract deliberately adds friction and operational dependencies. It also prevents a simple
upload form from becoming broad Customer access to the Commercial Record Chain or a path for
unscanned Sensitive Travel Documents into staff workflows.
