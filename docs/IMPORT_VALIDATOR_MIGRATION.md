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

`travelBatchSummaryTransitionValidator` is the expand-phase schema: it accepts canonical summaries and the inventoried legacy aliases. `migrations.auditTravelBatchSummaries` reports variants and derived counters one bounded page at a time. `migrations.migrateTravelBatchSummaries` accepts at most 100 reviewed Job Card IDs, preserves the larger existing counter, writes the derived counter, and removes the obsolete summary array. Re-running it is safe and reports already-migrated rows as skipped.

For each deployment:

1. Deploy the transitional validator and audit/migration functions.
2. Page through `auditTravelBatchSummaries` using the deployment migration secret.
3. Stop if an unlisted shape appears; widen the transition validator before proceeding.
4. Run `migrateTravelBatchSummaries` in reviewed batches of at most 100 IDs.
5. Re-run the audit until it returns no summary rows.
6. Verify Job Card creation still advances from `travelBatchCount` and run import preview/commit tests.

Only after preview and production both return no legacy rows should a later contract change remove `travelBatchSummaries` and its transition validator. This local implementation does not claim that production migration has run.
