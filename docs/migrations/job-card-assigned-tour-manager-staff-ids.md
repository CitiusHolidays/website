# Job Card assigned Tour Manager staff IDs

> Status: source only. Nothing in this note has run on any deployment.

Generic Job Card scope for a Tour Manager used to come only from a case-insensitive match between
the staff member's display name and `jobCards.tourManagerName`. Each Tour Manager assignment write
overwrites that single field, so on a multi-batch Job Card every earlier-assigned staff Tour
Manager lost access. A colliding display name also granted access.

`jobCards.assignedTourManagerStaffIds` is an additive optional array derived from
`tourManagerAssignments`: every row on the Job Card with `status: "Assigned"` and a `staffId`,
deduplicated and sorted. `canSeeJobCardRecord` (and the Tour Manager Commercial Files area) grants
scope when the actor has the Tour Manager role and their staff ID is in that array. The legacy
name match remains as a fallback until this backfill is verified on every deployment.

## Live writers

`syncJobCardTourManagerVisibility` in `convex/crm/jobCardVisibility.ts` recomputes the array from
the `by_jobCardId` assignment index. It runs after `createTourManager`, after `updateTourManager`
(for the previous Job Card when an assignment moves, and for the current one), after
`removeTourManager`, and once per affected Job Card after `removeManyTourManagers`. Job Card
deletion removes the Job Card first, so its cascade needs no sync. External-profile and name-only
assignments have no `staffId` and add nothing.

The derived patch does not change `updatedAt`, metrics, or list search text.

## Source capabilities

The internal capabilities in `convex/crm/tourManagerVisibilityMigration.ts` require
`MIGRATION_SECRET`:

- `migrateAssignedTourManagerStaffIds({ dryRun: true, ... })`: bounded inventory only. It records
  progress in a dedicated dry-run registry row and patches no Job Card. `legacyRemaining` counts
  Job Cards whose stored array differs from the derived one.
- `migrateAssignedTourManagerStaffIds({ dryRun: false, ... })`: bounded apply pass that resumes
  from the server-owned `dataMigrationRegistry` cursor and patches only
  `assignedTourManagerStaffIds`.
- `verifyAssignedTourManagerStaffIds(...)`: independent bounded rescan. Any Job Card whose array
  still differs fails the gate.
- `getAssignedTourManagerStaffIdsMigrationStatus(...)`: content-free status. The fallback may be
  removed only after `verified: true`, `stage: complete`, and `legacyRemaining: 0`.

Pages default to 25 Job Cards and cap at 50, because each Job Card reads up to 500 assignment rows.
A Job Card with more than 500 assignments stops the pass with an error rather than writing a
partial set.

## Target procedure

Target execution is not part of local source verification. For each explicitly authorized
deployment:

1. Record the exact deployment identity and the revision that adds the field and writers. Deploy
   it first, so new assignment writes keep the array current while the backfill runs.
2. Read migration status before mutation.
3. Run bounded dry-run pages to completion and record content-free counters.
4. Run bounded apply pages until the stage becomes `verify`.
5. Run the verifier until status is `verified` with zero residuals, then re-read status.
6. Confirm, with a least-privilege staff Tour Manager on a multi-batch Job Card, that every
   assigned Tour Manager sees the Job Card and an unassigned one does not.
7. Only in a later reviewed revision, after every required deployment has passed, consider
   removing the `tourManagerName` fallback. That change also needs a decision for Job Cards whose
   Tour Manager was typed by name with no assignment row.

Production needs separate explicit authority even after a non-production rehearsal passes. The
backfill only adds grants that an active staff assignment already justifies.

## Rollback

Once any Job Card stores the field, a revision whose schema lacks `assignedTourManagerStaffIds`
will fail schema validation on deploy. To roll back the behaviour, revert the scope check and
writers but keep the optional schema field. To drop the field, first clear it from every Job Card
in a reviewed bounded pass.
