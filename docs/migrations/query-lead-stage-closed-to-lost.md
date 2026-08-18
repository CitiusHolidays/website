# Query lead-stage Closed to Lost

This migration removes the legacy Query lead stage `Closed`. The canonical value is `Lost`.
Storage stays widened until every target reports a verified zero-residual result; public writers
already reject `Closed`, and public reads normalize it to `Lost`.

## Source capabilities

The internal capabilities in `convex/crm/closedLeadStageMigration.ts` are:

- `migrateClosedLeadStages({ dryRun: true, ... })`: bounded inventory only; it records progress in a
  dedicated dry-run registry row and does not patch Queries.
- `migrateClosedLeadStages({ dryRun: false, ... })`: bounded apply pass; it resumes exclusively from
  the server-owned `dataMigrationRegistry` cursor.
- `verifyClosedLeadStages(...)`: independent bounded rescan; any residual `Closed` Query fails the
  gate.
- `getClosedLeadStageMigrationStatus(...)`: content-free status. Narrowing requires
  `verified: true`, `stage: complete`, and `legacyRemaining: 0`.

The migration queries only the `queries` table and patches only `leadStage` plus the Query update
clock. A Job Card or any other entity containing a `Closed` status is out of scope and unchanged.

## Target procedure

Target execution is not part of local source verification. For each explicitly authorized
non-production deployment:

1. Record the exact deployment identity and widen revision.
2. Read migration status before mutation.
3. Run bounded dry-run pages to completion and record content-free counters.
4. Run bounded apply pages until the stage becomes `verify`.
5. Run the independent verifier until status is `verified` with zero residuals.
6. Re-read status and run the Query writer/read compatibility tests on that deployment.
7. Narrow storage only in a later reviewed revision after every required target has passed.

Never substitute Production for a Preview rehearsal. Production execution needs separate explicit
authority even when a non-production rehearsal has passed.
