import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { TOUR_MANAGER_LEGACY_NAMES_MIGRATION_KEY } from "./tourManagerLegacyNamesMigration";

const NOW = Date.parse("2026-11-06T06:00:00Z");
const SECRET = "synthetic-legacy-names-secret";
const ISSUER = "https://legacy-names.test";

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

/**
 * Two Job Cards written before the derived name list existed: one names an external tour
 * manager in `tourManagerName`, one keeps a legacy name-only assignment.
 */
async function seedUntouched(t: ReturnType<typeof harness>) {
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("authIdentityLinks", {
      canonicalAuthUserId: `${ISSUER}|namesake`,
      createdAt: NOW,
      legacyAuthUserId: "namesake",
      status: "linked",
      updatedAt: NOW,
    });
    await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: "namesake",
      createdAt: NOW,
      email: "namesake@legacy-names.test",
      emailNormalized: "namesake@legacy-names.test",
      name: "Meera Iyer",
      roles: ["Tour Manager"],
      updatedAt: NOW,
    });
    const profileId = await ctx.db.insert("externalTourManagerProfiles", {
      active: true,
      createdAt: NOW,
      createdBy: "ops-head",
      destinations: [],
      email: "external@legacy-names.test",
      emailNormalized: "external@legacy-names.test",
      experienceSummary: "",
      experienceYears: null,
      name: "Meera Iyer",
      phone: "",
      phoneNormalized: "",
      reportedPastTours: null,
      reportedPastToursNote: "",
      reportedPastToursSource: "staff_recorded",
      updatedAt: NOW,
      updatedBy: "ops-head",
    });
    const job = (jobCode: string) =>
      ctx.db.insert("jobCards", {
        clientName: "Synthetic legacy group",
        confirmedPax: 2,
        createdAt: NOW,
        createdBy: "accounts-owner",
        jobCode,
        queryType: "MICE",
        status: "Open",
        tourManagerName: "Meera Iyer",
        updatedAt: NOW,
      });
    const externalJob = await job("JC-LEGACY-EXT");
    const nameOnlyJob = await job("JC-LEGACY-NAME");
    const assignment = (jobCardId: typeof externalJob, external: boolean) =>
      ctx.db.insert("tourManagerAssignments", {
        callingStatus: "Pending",
        createdAt: NOW,
        createdBy: "ops-head",
        externalProfileId: external ? profileId : undefined,
        jobCardId,
        name: "Meera Iyer",
        status: "Assigned",
        updatedAt: NOW,
      });
    await assignment(externalJob, true);
    await assignment(nameOnlyJob, false);
    return { externalJob, nameOnlyJob };
  });
  const namesake = t.withIdentity({
    email: "namesake@legacy-names.test",
    issuer: ISSUER,
    subject: "namesake",
    tokenIdentifier: `${ISSUER}|namesake`,
  });
  const canSee = async (jobCardId: typeof ids.externalJob) =>
    (await namesake.query(api.crm.jobCards.getDetail, { jobCardId })) !== null;
  return { ...ids, canSee };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Tour Manager legacy-names backfill", () => {
  test("dry run reports, apply writes both fields, verify confirms, and re-runs are no-ops", async () => {
    vi.stubEnv("MIGRATION_SECRET", SECRET);
    const t = harness();
    const f = await seedUntouched(t);
    // Before the backfill the external tour manager's name still opens the Job Card.
    expect(await f.canSee(f.externalJob)).toBe(true);
    expect(await f.canSee(f.nameOnlyJob)).toBe(true);

    const migrate = internal.crm.tourManagerLegacyNamesMigration.migrateTourManagerLegacyNames;
    const dryRun = await t.mutation(migrate, { dryRun: true, secret: SECRET });
    expect(dryRun).toMatchObject({ legacyRemaining: 2, stage: "complete", status: "failed" });
    expect(
      (await t.run((ctx) => ctx.db.get("jobCards", f.externalJob)))?.legacyTourManagerNames
    ).toBeUndefined();

    expect(await t.mutation(migrate, { dryRun: false, limit: 1, secret: SECRET })).toMatchObject({
      converted: 1,
      stage: "backfill",
    });
    expect(await t.mutation(migrate, { dryRun: false, limit: 1, secret: SECRET })).toMatchObject({
      converted: 1,
    });
    const final = await t.mutation(migrate, { dryRun: false, limit: 1, secret: SECRET });
    expect(final.stage).toBe("verify");

    const external = await t.run((ctx) => ctx.db.get("jobCards", f.externalJob));
    expect(external).toMatchObject({
      assignedTourManagerStaffIds: [],
      legacyTourManagerNames: [],
      updatedAt: NOW,
    });
    expect(
      (await t.run((ctx) => ctx.db.get("jobCards", f.nameOnlyJob)))?.legacyTourManagerNames
    ).toEqual(["meera iyer"]);

    const verify = await t.mutation(
      internal.crm.tourManagerLegacyNamesMigration.verifyTourManagerLegacyNames,
      { secret: SECRET }
    );
    expect(verify).toMatchObject({ legacyRemaining: 0, stage: "complete", status: "verified" });
    const status = await t.query(
      internal.crm.tourManagerLegacyNamesMigration.getTourManagerLegacyNamesMigrationStatus,
      { secret: SECRET }
    );
    expect(status).toMatchObject({
      key: TOUR_MANAGER_LEGACY_NAMES_MIGRATION_KEY,
      legacyRemaining: 0,
      verified: true,
    });

    // The external name no longer grants scope; the legacy name-only assignment still does.
    expect(await f.canSee(f.externalJob)).toBe(false);
    expect(await f.canSee(f.nameOnlyJob)).toBe(true);
    expect(await t.mutation(migrate, { dryRun: false, secret: SECRET })).toMatchObject({
      processed: 0,
      stage: "complete",
      status: "verified",
    });
  });

  test("requires the migration secret", async () => {
    vi.stubEnv("MIGRATION_SECRET", SECRET);
    const t = harness();
    await expect(
      t.mutation(internal.crm.tourManagerLegacyNamesMigration.migrateTourManagerLegacyNames, {
        dryRun: true,
        secret: "wrong",
      })
    ).rejects.toThrow("Invalid migration secret");
  });
});
