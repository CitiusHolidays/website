# ADR 0009: Canonical auth identity migration boundary

## Decision

New identity-aware code should use Convex's issuer-qualified
`tokenIdentifier` as the canonical `authUserId`. The existing `subject` value
is retained only as a compatibility fallback while stored rows are migrated.
`convex/lib/authIdentity.ts` is the small dual-read seam and its tests lock the
precedence and fallback behavior.

## Migration sequence

1. **Expand (implemented in source):** select the token identifier for new
   ownership writes. Legacy reads require one explicit, non-conflicting
   `authIdentityLinks` mapping; Staff and customer authority never falls back
   through email.
2. **Bounded inventory:** enumerate each auth-owned table with a cursor and
   record `{table, cursor, processed, converted, remaining}` in the existing
   migration registry. A row is converted only when its ownership is
   unambiguous; ambiguous rows are quarantined for an operator review.
3. **Dual write:** after every in-scope table has a zero-legacy proof, write
   only `tokenIdentifier`, while retaining the old field for one release as a
   rollback marker.
4. **Narrow:** add/verify canonical indexes, remove subject fallback from
   authorization, and delete the compatibility field only in a separate
   deployment after a backup and a production read audit.

The per-table inventory and backfill worker now exists in
`convex/authIdentityMigration.ts`; its authoritative table/index list is
`convex/lib/authIdentityMigration.ts`. Actual target execution, backup/read
audit, quarantine resolution, and the later narrow deployment remain deferred.
Source and local tests do not claim Development, Preview, or Production data
coverage. Follow the [target-aware runbook](../migrations/auth-identity-ownership.md)
and preserve exact per-table evidence before removing any legacy fallback.
