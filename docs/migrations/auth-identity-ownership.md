# Auth identity ownership migration

This runbook executes [ADR 0009](../adr/0009-auth-token-identity-migration.md). The source worker is
bounded and resumable; this document is not authority to run it on any deployment.

## Safety prerequisites

1. Identify the exact Convex deployment name and classify it as Development, Preview, or Production.
2. Record the source revision, deployment identity, current backup/restore evidence, and operator
   responsible for quarantine review.
3. Confirm `MIGRATION_SECRET` on that exact target without printing its value.
4. Do not run Production inventory, backfill, verification, or narrowing under Preview-only
   authority. Production requires a separate approval and a current read audit.
5. Keep issuer-qualified identifiers, emails, and raw subject values out of logs and evidence.

## Registry and sequence

`convex/lib/authIdentityMigration.ts` is the authoritative table/index inventory.
`convex/authIdentityMigration.ts` stores one `dataMigrationRegistry` row per table and dry-run mode
with processed, converted, quarantined, and legacy-remaining counts. Each call processes at most 50
rows.

For every inventory table, in listed order:

1. Run dry-run pages until the registry reaches `complete`. Record counts, not identities. A dry run
   with legacy rows is expected to finish `failed`; that is evidence that backfill is required.
2. Resolve missing authoritative links and assign an operator to every ambiguity. Do not use email
   to manufacture a link.
3. Run write pages until the worker advances from `backfill` to `verify`.
4. Continue verification pages until `complete`. Require `legacyRemaining: 0`; retain converted and
   quarantined counts.
5. If notification owners changed, the worker marks unread projections not ready. Run the existing
   notification unread projection rebuild and require its independent residual scan to complete
   before relying on projected counts.
6. Verify Booking conversion created one purchaser Journey Entitlement per converted Booking.

Retries resume from the registry cursor. Unique-key collisions create a privacy-safe quarantine row
instead of overwriting or merging records. A verified table may include quarantined rows only when
the conflicting legacy identity is fail-closed and assigned for operator resolution.

## Deployment stages

- **Expand:** deploy identity links, quarantine/index schema, entitlements, canonical writers, and
  this worker. Preserve linked legacy reads.
- **Backfill and verify:** execute the sequence above on one named target at a time. Record separate
  Development, Preview, and Production evidence.
- **Read audit:** prove Staff, Account, Sacred Bharat, notifications, payments, and guest merge keep
  their visibility and replay contracts. Preview requires at least two customer issuers/identities.
- **Narrow:** only after every table is verified, backup evidence is current, quarantines are
  resolved or explicitly isolated, and a separate deployment is approved. Remove legacy fallback
  in this later change; do not combine it with backfill.

Rollback keeps legacy fields and identity links for at least one release. Do not delete rollback
markers or narrow indexes while any target lacks zero-residual evidence.
