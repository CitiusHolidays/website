# Job Card Tour Manager legacy names

> Status: source only. Nothing in this note has run on any deployment.

`jobCards.legacyTourManagerNames` is an additive optional array of normalized names (Unicode
NFKC, whitespace collapsed, case folded) of the Job Card's active name-only Tour Manager
assignments: rows with `status: "Assigned"`, no `staffId` and no `externalProfileId`. Once a Job
Card stores it, the legacy Tour Manager name route matches only that list, so the name of an
external profile, which `createTourManager` also copies into `tourManagerName`, never grants a
same-named staff Tour Manager scope.

Until a Job Card stores the list, `ownsTourManagerJobCard` still falls back to the Job Card-level
`tourManagerName` (role-gated, and only while no staff Tour Manager is assigned). That fallback
can hold an external profile's name, so untouched Job Cards can still give a staff namesake the
Job Card itself, though never its travellers or field passports.

## Live writer

`syncJobCardTourManagerVisibility` writes both derived fields, `assignedTourManagerStaffIds` and
`legacyTourManagerNames`, after every Tour Manager assignment write, even when they are empty. It
and this backfill share `staleTourManagerVisibilityPatch` in `convex/crm/jobCardVisibility.ts`.
The patch does not change `updatedAt`, metrics or list search text.

## Source capabilities

The internal capabilities in `convex/crm/tourManagerLegacyNamesMigration.ts` require
`MIGRATION_SECRET` and use the `dataMigrationRegistry` key
`job-card-tour-manager-legacy-names-v1`:

- `migrateTourManagerLegacyNames({ dryRun: true, ... })`: bounded inventory in a dedicated
  dry-run registry row; patches nothing. `legacyRemaining` counts Job Cards whose stored fields are
  missing or differ from the derived ones.
- `migrateTourManagerLegacyNames({ dryRun: false, ... })`: bounded apply pass that resumes from
  the server-owned cursor and patches only the two derived fields.
- `verifyTourManagerLegacyNames(...)`: independent bounded rescan; any residual fails the gate.
- `getTourManagerLegacyNamesMigrationStatus(...)`: content-free status.

Re-running after verification is a no-op. Pages default to 25 Job Cards and cap at 50, because
each Job Card reads up to 500 assignment rows; a Job Card with more stops the pass with an error.

External tour manager logins added a third derived field, `externalTourManagerStaffIds`, and
narrowed `assignedTourManagerStaffIds` to employees. Because this key is already verified on
deployments, that change has its own pass:
[external tour manager logins](job-card-external-tour-manager-logins.md).

This pass also writes `assignedTourManagerStaffIds` where it is missing or stale, so it covers
the [assigned Tour Manager backfill](job-card-assigned-tour-manager-staff-ids.md) too. Run that
one as well so its own registry records a verified state.

## Target procedure

Target execution is not part of local source verification. For each explicitly authorized
deployment:

1. Record the deployment identity and deploy the revision that adds the field and writer first.
2. Read status, run dry-run pages to completion, and record the content-free counters.
3. Run apply pages until the stage becomes `verify`, then the verifier until `verified` with
   zero residuals, then re-read status.
4. Confirm with least-privilege staff Tour Managers: a namesake of an external tour manager no
   longer sees that Job Card; a legacy name-only Tour Manager still does until a staff Tour Manager
   is assigned.

Production needs separate explicit authority even after a non-production rehearsal passes.

## Rollback

Keep the optional schema field once any Job Card stores it. To restore the old behaviour, revert
the scope check; the stored list is then ignored.
