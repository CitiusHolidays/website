import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  readTourManagerVisibilityMigrationStatus,
  runTourManagerVisibilityMigrationPage,
  runTourManagerVisibilityVerification,
  tourManagerVisibilityMigrationResultValidator,
  tourManagerVisibilityMigrationStatusValidator,
} from "./tourManagerLegacyNamesMigration";

/**
 * Re-derives the Tour Manager fields on every Job Card after external tour manager logins
 * (PR #307): `assignedTourManagerStaffIds` now lists employees only and the new
 * `externalTourManagerStaffIds` lists external logins. The writer and this pass share
 * `staleTourManagerVisibilityPatch`. The legacy-names key is already verified on deployments, so
 * this pass uses its own key. Runbook: docs/migrations/job-card-external-tour-manager-logins.md.
 */
export const TOUR_MANAGER_EXTERNAL_LOGINS_MIGRATION_KEY =
  "job-card-tour-manager-external-logins-v1";

export const migrateTourManagerExternalLogins = internalMutation({
  args: {
    dryRun: v.boolean(),
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) =>
    await runTourManagerVisibilityMigrationPage(
      ctx,
      args,
      TOUR_MANAGER_EXTERNAL_LOGINS_MIGRATION_KEY
    ),
  returns: tourManagerVisibilityMigrationResultValidator,
});

export const verifyTourManagerExternalLogins = internalMutation({
  args: { limit: v.optional(v.number()), secret: v.string() },
  handler: async (ctx, args) =>
    await runTourManagerVisibilityVerification(
      ctx,
      args,
      TOUR_MANAGER_EXTERNAL_LOGINS_MIGRATION_KEY
    ),
  returns: tourManagerVisibilityMigrationResultValidator,
});

export const getTourManagerExternalLoginsMigrationStatus = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, args) =>
    await readTourManagerVisibilityMigrationStatus(
      ctx,
      args,
      TOUR_MANAGER_EXTERNAL_LOGINS_MIGRATION_KEY
    ),
  returns: tourManagerVisibilityMigrationStatusValidator,
});
