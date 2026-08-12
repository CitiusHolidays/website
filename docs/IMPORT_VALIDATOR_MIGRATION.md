# Import and Travel Batch validator migration

This change replaces the targeted broad Convex values with explicit transitional contracts. It does not cap workbook row counts: public actions still split all submitted rows into batches of 50 and process those batches with bounded concurrency.

## Inventoried shapes

Repository writers and tests currently produce:

- import failures: `id`, `message`, optional source sheet/row, and canonical `retryable` or `terminal` kind;
- legacy import failures: the same identity/message fields without `kind`;
- room summaries: a string-keyed count record, including canonical room labels and any already-stored legacy room-code keys;
- Travel Batch summaries: canonical `batchCode` projections/full rows, plus the historical `code`, `reference`, and `pax` aliases;
- public spreadsheet rows for passenger, traveller, rooming, passport, and visa imports; flight groups use their separate explicit group/segment validators.

Public rows accept legacy `SGL`, `TPL`, and `DBL` room codes and `M`/`F` gender aliases. The Node action canonicalizes them before the stricter internal row validator. Canonical room values remain Single, Twin, Double, Triple, Child with Bed, and Family Room; canonical gender remains Male or Female. Passport expiry and Travel Batch absent/blank/present semantics are unchanged.

The internal `access` argument now matches `PortalAccess` explicitly instead of accepting arbitrary data.

## Widen, migrate, narrow

`travelBatchSummaryTransitionValidator` is the expand-phase schema: it accepts canonical summaries and the inventoried legacy aliases. The legacy reviewed-ID commands remain available for compatibility, but the cutover authority is the registry-backed `backfillTravelBatchSummaries` and `verifyTravelBatchSummaries` pair. They own a server cursor, process at most 100 Job Cards per call, preserve the larger existing counter, reject unreviewed summary fields, and independently rescan the entire table before readiness can become true. `getTravelBatchSummaryMigrationStatus` is the only readiness projection.

For each deployment:

1. Deploy the transitional validator and audit/migration functions.
2. Run `backfillTravelBatchSummaries` repeatedly until it reports `stage: verify`. The cursor is server-owned; callers cannot skip rows.
3. Stop if an unlisted shape appears; widen the transition validator only after reviewing that shape.
4. Run `verifyTravelBatchSummaries` repeatedly until `getTravelBatchSummaryMigrationStatus` reports `verified: true`, `stage: complete`, and `legacyRemaining: 0`.
5. Read that status a second time and retain the target, revision, timestamp, and counters as release evidence.
6. Verify Job Card creation still advances from `travelBatchCount` and run import preview/commit tests.

Only after every intended deployment returns a fresh verified status should a later contract change remove `travelBatchSummaries` and its transition validator. Reverting code does not restore removed summary arrays or undo the monotonic scalar rewrite. This local implementation does not claim that any target migration has run.

Room types use the same authority ladder through `migrateRoomTypes`, `verifyRoomTypes`, and `getRoomTypeMigrationStatus`. Legacy spreadsheet aliases remain accepted at the import edge and canonicalized before storage. The schema must stay widened to `roomTypeMigrationValidator` until every intended deployment has revision-bound evidence with `verified: true`, `stage: complete`, and `legacyRemaining: 0`; local tests or one development registry row are not sufficient narrowing evidence.
