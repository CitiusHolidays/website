# Job Card external tour manager logins

> Status: source only. Nothing in this note has run on any deployment.

External tour manager logins (PR #307) put the login's `staffId` on its profile's assignment rows,
so those rows carry both `externalProfileId` and `staffId`. The derived Job Card fields now split
them:

- `jobCards.assignedTourManagerStaffIds` lists employees only: active rows with a `staffId` and
  **no** `externalProfileId`. This is what it meant before the PR, because external rows never had
  a `staffId` until then. It also still decides whether the legacy name route applies, so an
  external login never switches that route off for a name-only employee.
- `jobCards.externalTourManagerStaffIds` (additive, optional) lists the external logins: active
  rows with both. `ownsTourManagerJobCard` reads only this list for an external login. A missing
  field means none.

`syncJobCardTourManagerVisibility` writes all three derived fields (with
`legacyTourManagerNames`) after every assignment write and when a login is granted. The writer and
this backfill share `staleTourManagerVisibilityPatch` in `convex/crm/jobCardVisibility.ts`, which
treats a missing `externalTourManagerStaffIds` as empty, so Job Cards without an external login are
not stale on its account. The patch does not change `updatedAt`, metrics or list search text.

## Why a new pass

The [legacy-names backfill](job-card-tour-manager-legacy-names.md) and the
[assigned staff-ids backfill](job-card-assigned-tour-manager-staff-ids.md) are already verified on
deployments, and a verified key re-runs as a no-op. This pass uses its own key so every Job Card is
checked once more against the split fields. Before this revision is deployed no external login
exists, so the expected result on every deployment is zero stale Job Cards: the pass is a
verification. It only writes where a deployment ran an earlier build of PR #307 (for example a
preview or rehearsal) that stored an external login in `assignedTourManagerStaffIds`.

## Source capabilities

The internal capabilities in `convex/crm/tourManagerExternalLoginsMigration.ts` require
`MIGRATION_SECRET` and use the `dataMigrationRegistry` key
`job-card-tour-manager-external-logins-v1`. They share the bounded page, verification and status
implementation of `convex/crm/tourManagerLegacyNamesMigration.ts`:

- `migrateTourManagerExternalLogins({ dryRun: true, ... })`: bounded inventory in a dedicated
  dry-run registry row; patches nothing. `legacyRemaining` counts Job Cards whose stored fields are
  missing or differ from the derived ones.
- `migrateTourManagerExternalLogins({ dryRun: false, ... })`: bounded apply pass that resumes from
  the server-owned cursor and patches only the derived fields.
- `verifyTourManagerExternalLogins(...)`: independent bounded rescan; any residual fails the gate.
- `getTourManagerExternalLoginsMigrationStatus(...)`: content-free status.

Pages default to 25 Job Cards and cap at 50, because each Job Card reads up to 500 assignment rows.
Re-running after verification is a no-op.

## Target procedure

Target execution is not part of local source verification. For each explicitly authorized
deployment:

1. Record the deployment identity and deploy the revision that adds the field and writer first.
2. Read status, run dry-run pages to completion and record the content-free counters (expected:
   `legacyRemaining: 0` where no earlier build of PR #307 ran).
3. Run apply pages until the stage becomes `verify`, then the verifier until `verified` with zero
   residuals, then re-read status.
4. Confirm with least-privilege accounts: a name-only staff Tour Manager keeps their Job Card after
   an external login on the same Job Card is granted, and the external login sees only its own
   series.

Production needs separate explicit authority even after a non-production rehearsal passes.

## Rollback

Keep the optional schema field once any Job Card stores it. Reverting the scope check makes the
stored list unused; external logins then reach no Job Card through assignments.
