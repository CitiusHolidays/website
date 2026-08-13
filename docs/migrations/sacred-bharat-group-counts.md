# Sacred Bharat private-group count migration

This migration widens `sacredBharatGroups` with an optional `memberCount`, backfills one exact
count per private group, and independently verifies every group before `listMyGroups` trusts the
projection. It does not change group privacy or invite authorization.

Private groups have a product limit of 100 members. New joins are rejected at that exact limit;
replayed joins remain idempotent. A legacy group over the limit fails closed with
`GROUP_MEMBER_LIMIT_REPAIR_REQUIRED` and must be reviewed before the projection can become ready.
The private leaderboard reads at most 101 membership rows, rejects an oversized legacy group, and
sorts the bounded result by Soul Score descending, temple count descending, display name, then
authenticated identity ID.

## Source functions

- `sacredBharatGroupMembershipMigration:backfillGroupMemberCounts`
- `sacredBharatGroupMembershipMigration:verifyGroupMemberCounts`
- `sacredBharatGroupMembershipMigration:getGroupMemberCountMigrationStatus`

The mutation functions require `MIGRATION_SECRET`. They page at no more than 20 groups per call and
store only cursor/counter state in `dataMigrationRegistry` under
`sacred-bharat-group-count-v1`. Backfill completion changes the registry to `verify`; only a separate
full verification scan with zero mismatches can set `status: verified`, `stage: complete`, and
`legacyRemaining: 0`.

## Target-aware sequence

1. Identify and announce the exact non-production Convex target. Confirm it is not Production.
2. Deploy the widened optional schema and dual-writing create/join/leave mutations.
3. Read migration status. Run bounded backfill pages until the stage becomes `verify`.
4. Stop on any oversized group or failed status; repair only with separately reviewed authority.
5. Run bounded verification pages from a fresh cursor until the status is `verified` with zero
   remaining mismatches.
6. Exercise two groups with different sizes, replay a join, leave once, and verify the private
   leaderboard authorization and deterministic ordering.
7. Record deployment ID, revision, target identity, page counts, and terminal registry state.

No target migration or deployment is implied by the source implementation or local tests. Repeat
the complete sequence independently for every intended environment; never copy readiness rows
between deployments.
