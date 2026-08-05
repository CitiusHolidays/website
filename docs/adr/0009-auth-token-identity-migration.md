# ADR 0009: Canonical auth identity migration boundary

## Decision

New identity-aware code should use Convex's issuer-qualified
`tokenIdentifier` as the canonical `authUserId`. The existing `subject` value
is retained only as a compatibility fallback while stored rows are migrated.
`convex/lib/authIdentity.ts` is the small dual-read seam and its tests lock the
precedence and fallback behavior.

## Migration sequence

1. **Dual read (current slice):** accept a token identifier when present and
   fall back to `subject` for legacy sessions/fixtures. Do not silently match
   staff by email.
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

The full data migration is intentionally deferred. This slice does not rewrite
customer, staff, Sacred Bharat, booking, notification, or CRM audit rows, and
it does not claim production identity coverage. Any deployment that enables
the canonical writer must first run the bounded inventory and preserve the
exact per-table evidence.
