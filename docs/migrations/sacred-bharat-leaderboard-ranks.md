# Sacred Bharat ordered-rank migration

The global Sacred Bharat leaderboard uses the `@convex-dev/aggregate` component named
`sacredBharatLeaderboardRanks` to make top-N, exact player count, and current-yatri rank reads
bounded. Its ascending key is negative Soul Score, negative temple count, normalized display name,
display name, and authenticated identity ID. Opted-out and zero-visit summaries live in a separate
`hidden` namespace and are never included in public rank/count reads.

The existing `sacred-bharat-leaderboard-v1` summary migration remains the source prerequisite.
Until the ordered-rank registry is independently verified, all reads use the compatibility
summary/visit builder. Writers use idempotent aggregate operations during this migration window so
live score, trail, profile-name, passport, opt-out, and identity changes remain transactionally
aligned with the summary row.

## Source functions

- `sacredBharatLeaderboardRankMigration:backfillLeaderboardRanks`
- `sacredBharatLeaderboardRankMigration:verifyLeaderboardRanks`
- `sacredBharatLeaderboardRankMigration:getLeaderboardRankMigrationStatus`

The mutation functions require `MIGRATION_SECRET`, page at no more than 40 summaries per call, and
store cursor/counter state in `dataMigrationRegistry` under
`sacred-bharat-leaderboard-rank-v1`. Verification independently checks each source summary at its
exact aggregate position and compares both eligible and hidden source totals with aggregate totals.
Only zero residual mismatches can set `status: verified`, `stage: complete`, and
`legacyRemaining: 0`.

## Target-aware sequence

1. Identify and announce the exact non-production Convex target. Confirm it is not Production.
2. Confirm `sacred-bharat-leaderboard-v1` is already verified with zero residual participants.
3. Deploy the mounted component and idempotent dual-write source before starting backfill.
4. Read ordered-rank status, then run bounded backfill pages until the stage becomes `verify`.
5. Run bounded verification pages from a fresh cursor. Stop on any missing position or total-count
   mismatch; do not force readiness.
6. After verified zero residual, exercise top-100, opt-out/in, rename, equal-score/equal-temple ties,
   exact current rank/percentile, and public-passport rank on the named target.
7. Record deployment ID, revision, target identity, aggregate package version, page counts, and
   terminal registry state.

No component deployment, data backfill, verification, or read cutover is implied by local source
and test completion. Repeat the full sequence for every intended deployment; never copy a registry
row between targets.
