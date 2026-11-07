import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const NOW = Date.parse("2026-11-07T06:00:00Z");
const SECRET = "synthetic-external-logins-secret";

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Tour Manager external-logins backfill", () => {
  test("splits an external login out of the employee list, verifies, and re-runs are no-ops", async () => {
    vi.stubEnv("MIGRATION_SECRET", SECRET);
    const t = harness();
    const ids = await t.run(async (ctx) => {
      const loginId = await ctx.db.insert("staffUsers", {
        active: true,
        createdAt: NOW,
        email: "ext@external-logins.test",
        emailNormalized: "ext@external-logins.test",
        name: "Synthetic External",
        roles: ["Tour Manager"],
        updatedAt: NOW,
      });
      const profileId = await ctx.db.insert("externalTourManagerProfiles", {
        active: true,
        createdAt: NOW,
        createdBy: "ops-head",
        destinations: [],
        email: "ext@external-logins.test",
        emailNormalized: "ext@external-logins.test",
        experienceSummary: "",
        experienceYears: null,
        name: "Synthetic External",
        phone: "",
        phoneNormalized: "",
        reportedPastTours: null,
        reportedPastToursNote: "",
        reportedPastToursSource: "staff_recorded",
        staffId: loginId,
        updatedAt: NOW,
        updatedBy: "ops-head",
      });
      await ctx.db.patch("staffUsers", loginId, { externalTourManagerProfileId: profileId });
      // Written by the first version of this PR: the external login sat in the employee list,
      // which switched off a name-only employee's legacy route.
      const stale = await ctx.db.insert("jobCards", {
        assignedTourManagerStaffIds: [loginId],
        clientName: "Synthetic group",
        confirmedPax: 1,
        createdAt: NOW,
        createdBy: "accounts-owner",
        jobCode: "JC-EXT-STALE",
        legacyTourManagerNames: ["asha rao"],
        queryType: "MICE",
        status: "Open",
        updatedAt: NOW,
      });
      // Already current: no external login, fields derived.
      const current = await ctx.db.insert("jobCards", {
        assignedTourManagerStaffIds: [],
        clientName: "Synthetic other group",
        confirmedPax: 1,
        createdAt: NOW + 1,
        createdBy: "accounts-owner",
        jobCode: "JC-EXT-CURRENT",
        legacyTourManagerNames: [],
        queryType: "MICE",
        status: "Open",
        updatedAt: NOW + 1,
      });
      for (const [name, staffId, externalProfileId] of [
        ["Asha Rao", undefined, undefined],
        ["Synthetic External", loginId, profileId],
      ] as const) {
        await ctx.db.insert("tourManagerAssignments", {
          callingStatus: "Pending",
          createdAt: NOW,
          createdBy: "ops-head",
          externalProfileId,
          jobCardId: stale,
          name,
          staffId,
          status: "Assigned",
          updatedAt: NOW,
        });
      }
      return { current, loginId, stale };
    });
    const run = (dryRun: boolean) =>
      t.mutation(internal.crm.tourManagerExternalLoginsMigration.migrateTourManagerExternalLogins, {
        dryRun,
        limit: 50,
        secret: SECRET,
      });

    const dry = await run(true);
    expect(dry).toMatchObject({ legacyRemaining: 1, stage: "complete", status: "failed" });
    const applied = await run(false);
    expect(applied).toMatchObject({ converted: 1, stage: "verify", status: "running" });
    const verified = await t.mutation(
      internal.crm.tourManagerExternalLoginsMigration.verifyTourManagerExternalLogins,
      { limit: 50, secret: SECRET }
    );
    expect(verified).toMatchObject({ legacyRemaining: 0, status: "verified" });
    const job = await t.run((ctx) => ctx.db.get("jobCards", ids.stale));
    expect(job?.assignedTourManagerStaffIds).toEqual([]);
    expect(job?.externalTourManagerStaffIds).toEqual([ids.loginId]);
    expect(job?.legacyTourManagerNames).toEqual(["asha rao"]);
    // The current Job Card was not stale on account of the missing external list.
    const current = await t.run((ctx) => ctx.db.get("jobCards", ids.current));
    expect(current?.externalTourManagerStaffIds).toBeUndefined();
    expect(await run(false)).toMatchObject({ processed: 0, status: "verified" });
    const status = await t.query(
      internal.crm.tourManagerExternalLoginsMigration.getTourManagerExternalLoginsMigrationStatus,
      { secret: SECRET }
    );
    expect(status).toMatchObject({ verified: true });
    await expect(
      t.query(
        internal.crm.tourManagerExternalLoginsMigration.getTourManagerExternalLoginsMigrationStatus,
        { secret: "wrong" }
      )
    ).rejects.toThrow("Invalid migration secret");
  });
});
