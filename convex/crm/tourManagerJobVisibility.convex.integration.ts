import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { syncJobCardTourManagerVisibility } from "./jobCardVisibility";
import { TOUR_MANAGER_VISIBILITY_MIGRATION_KEY } from "./tourManagerVisibilityMigration";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const SECRET = "synthetic-migration-secret";
const ISSUER = "https://tour-manager-visibility.test";

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

const identities = [
  { id: "ops-head", name: "Synthetic Ops Head", role: "Operations Head" as const },
  { id: "tm-first", name: "Asha Rao", role: "Tour Manager" as const },
  { id: "tm-second", name: "Vikram Singh", role: "Tour Manager" as const },
  { id: "tm-outsider", name: "Meera Iyer", role: "Tour Manager" as const },
];

async function seed(t: ReturnType<typeof harness>) {
  const staffIds = await t.run(async (ctx) => {
    const ids: Record<string, Id<"staffUsers">> = {};
    for (const identity of identities) {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `${ISSUER}|${identity.id}`,
        createdAt: NOW,
        legacyAuthUserId: identity.id,
        status: "linked",
        updatedAt: NOW,
      });
      ids[identity.id] = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: identity.id,
        createdAt: NOW,
        email: `${identity.id}@tour-manager-visibility.test`,
        emailNormalized: `${identity.id}@tour-manager-visibility.test`,
        name: identity.name,
        roles: [identity.role],
        updatedAt: NOW,
      });
    }
    return ids;
  });
  const insertJob = (jobCode: string) =>
    t.run((ctx) =>
      ctx.db.insert("jobCards", {
        clientName: "Synthetic multi-batch group",
        confirmedPax: 40,
        createdAt: NOW,
        createdBy: "accounts-owner",
        destination: "Jaipur",
        jobCode,
        queryType: "MICE",
        status: "Open",
        updatedAt: NOW,
      })
    );
  const jobCardId = await insertJob("JC-TMV-01");
  const otherJobCardId = await insertJob("JC-TMV-02");
  const actor = (id: string) =>
    t.withIdentity({
      email: `${id}@tour-manager-visibility.test`,
      issuer: ISSUER,
      subject: id,
      tokenIdentifier: `${ISSUER}|${id}`,
    });
  const opsHead = actor("ops-head");
  const assign = (staffKey: string, job: Id<"jobCards"> = jobCardId) =>
    opsHead.mutation(api.crm.ops.createTourManager, {
      jobCardId: job,
      name: "ignored for staff assignments",
      staffId: staffIds[staffKey],
    });
  const canSee = async (staffKey: string, job: Id<"jobCards"> = jobCardId) =>
    (await actor(staffKey).query(api.crm.jobCards.getDetail, { jobCardId: job })) !== null;
  const assignedSet = async (job: Id<"jobCards"> = jobCardId) =>
    (await t.run((ctx) => ctx.db.get("jobCards", job)))?.assignedTourManagerStaffIds ?? [];
  return { actor, assign, assignedSet, canSee, jobCardId, opsHead, otherJobCardId, staffIds };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Tour Manager Job Card visibility from assignments", () => {
  test("every assigned staff Tour Manager keeps scope on a multi-batch Job Card", async () => {
    const f = await seed(harness());
    await f.assign("tm-first");
    await f.assign("tm-second");

    const job = await f.opsHead.query(api.crm.jobCards.getDetail, { jobCardId: f.jobCardId });
    // The latest assignment owns the denormalised name; the first TM no longer matches it.
    expect(job?.tourManagerName).toBe("Vikram Singh");
    expect(await f.canSee("tm-first")).toBe(true);
    expect(await f.canSee("tm-second")).toBe(true);
    expect(await f.canSee("tm-outsider")).toBe(false);
    expect([...(await f.assignedSet())].sort()).toEqual(
      [f.staffIds["tm-first"], f.staffIds["tm-second"]].sort()
    );
  });

  test("deactivating, reactivating, and moving an assignment updates the grant", async () => {
    const f = await seed(harness());
    const { id: firstAssignment } = await f.assign("tm-first");
    await f.assign("tm-second");

    await f.opsHead.mutation(api.crm.ops.updateTourManager, {
      status: "Inactive",
      tourManagerId: firstAssignment,
    });
    expect(await f.canSee("tm-first")).toBe(false);
    expect(await f.assignedSet()).toEqual([f.staffIds["tm-second"]]);

    await f.opsHead.mutation(api.crm.ops.updateTourManager, {
      status: "Assigned",
      tourManagerId: firstAssignment,
    });
    expect(await f.canSee("tm-first")).toBe(true);

    await f.opsHead.mutation(api.crm.ops.updateTourManager, {
      jobCardId: f.otherJobCardId,
      status: "Assigned",
      tourManagerId: firstAssignment,
    });
    expect(await f.canSee("tm-first")).toBe(false);
    expect(await f.canSee("tm-first", f.otherJobCardId)).toBe(true);
    expect(await f.assignedSet()).toEqual([f.staffIds["tm-second"]]);
    expect(await f.assignedSet(f.otherJobCardId)).toEqual([f.staffIds["tm-first"]]);
  });

  test("deactivating the named Tour Manager hands the name to a remaining active assignment", async () => {
    const t = harness();
    const f = await seed(t);
    const { id: firstAssignment } = await f.assign("tm-first");
    const { id: secondAssignment } = await f.assign("tm-second");
    const named = async () => {
      const job = await f.opsHead.query(api.crm.jobCards.getDetail, { jobCardId: f.jobCardId });
      return job?.tourManagerName;
    };
    expect(await named()).toBe("Vikram Singh");

    await f.opsHead.mutation(api.crm.ops.updateTourManager, {
      status: "Inactive",
      tourManagerId: secondAssignment,
    });
    expect(await named()).toBe("Asha Rao");
    expect((await t.run((ctx) => ctx.db.get("jobCards", f.jobCardId)))?.tourManagerId).toBe(
      firstAssignment
    );
    expect(await f.canSee("tm-second")).toBe(false);
    expect(await f.canSee("tm-first")).toBe(true);

    await f.opsHead.mutation(api.crm.ops.updateTourManager, {
      status: "Available",
      tourManagerId: firstAssignment,
    });
    expect(await named()).toBe("");
    expect(await f.assignedSet()).toEqual([]);
    expect(await f.canSee("tm-first")).toBe(false);
  });

  test("unassigning to no Job Card revokes the grant", async () => {
    const f = await seed(harness());
    const { id: firstAssignment } = await f.assign("tm-first");
    await f.assign("tm-second");
    await f.opsHead.mutation(api.crm.ops.updateTourManager, {
      jobCardId: "",
      tourManagerId: firstAssignment,
    });
    expect(await f.canSee("tm-first")).toBe(false);
    expect(await f.canSee("tm-second")).toBe(true);
    expect(await f.assignedSet()).toEqual([f.staffIds["tm-second"]]);
  });

  test("losing the Tour Manager role removes the assignment grant", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assign("tm-first");
    await f.assign("tm-second");
    await t.run((ctx) =>
      ctx.db.patch("staffUsers", f.staffIds["tm-first"], { roles: ["Operations"] })
    );
    expect(await f.assignedSet()).toContain(f.staffIds["tm-first"]);
    expect(await f.canSee("tm-first")).toBe(false);
  });

  test("replacing the staff member on an assignment moves the grant", async () => {
    const f = await seed(harness());
    const { id: assignment } = await f.assign("tm-first");
    await f.opsHead.mutation(api.crm.ops.updateTourManager, {
      staffId: f.staffIds["tm-outsider"],
      tourManagerId: assignment,
    });
    expect(await f.canSee("tm-first")).toBe(false);
    expect(await f.canSee("tm-outsider")).toBe(true);
  });

  test("removing one assignment revokes only that Tour Manager", async () => {
    const f = await seed(harness());
    const { id: firstAssignment } = await f.assign("tm-first");
    await f.assign("tm-second");
    await f.opsHead.mutation(api.crm.ops.removeTourManager, { tourManagerId: firstAssignment });
    expect(await f.canSee("tm-first")).toBe(false);
    expect(await f.canSee("tm-second")).toBe(true);
    expect(await f.assignedSet()).toEqual([f.staffIds["tm-second"]]);
  });

  test("bulk removal recomputes each affected Job Card once", async () => {
    const f = await seed(harness());
    const { id: firstAssignment } = await f.assign("tm-first");
    const { id: secondAssignment } = await f.assign("tm-second");
    const { id: otherAssignment } = await f.assign("tm-outsider", f.otherJobCardId);
    await f.opsHead.mutation(api.crm.ops.removeManyTourManagers, {
      tourManagerIds: [firstAssignment, secondAssignment, otherAssignment],
    });
    expect(await f.canSee("tm-first")).toBe(false);
    expect(await f.canSee("tm-second")).toBe(false);
    expect(await f.canSee("tm-outsider", f.otherJobCardId)).toBe(false);
    expect(await f.assignedSet()).toEqual([]);
    expect(await f.assignedSet(f.otherJobCardId)).toEqual([]);
  });

  test("a name-only (external) assignment adds no staff identity", async () => {
    const f = await seed(harness());
    await f.opsHead.mutation(api.crm.ops.createTourManager, {
      jobCardId: f.jobCardId,
      name: "Asha Rao",
    });
    expect(await f.assignedSet()).toEqual([]);
    // The unchanged legacy name fallback is the only route; it is not widened.
    expect(await f.canSee("tm-first")).toBe(true);
    expect(await f.canSee("tm-outsider")).toBe(false);
  });

  test("syncing a deleted Job Card is a no-op", async () => {
    const t = harness();
    const f = await seed(t);
    await t.run((ctx) => ctx.db.delete("jobCards", f.otherJobCardId));
    await t.run((ctx) => syncJobCardTourManagerVisibility(ctx, f.otherJobCardId));
    expect(await t.run((ctx) => ctx.db.get("jobCards", f.otherJobCardId))).toBeNull();
  });
});

describe("assigned Tour Manager backfill", () => {
  async function seedLegacy(t: ReturnType<typeof harness>) {
    const f = await seed(t);
    // Assignments written before the derived field existed: the Job Card only
    // carries the latest-wins name, so the first Tour Manager is locked out.
    await t.run(async (ctx) => {
      for (const [staffKey, name] of [
        ["tm-first", "Asha Rao"],
        ["tm-second", "Vikram Singh"],
      ] as const) {
        await ctx.db.insert("tourManagerAssignments", {
          callingStatus: "Pending",
          createdAt: NOW,
          createdBy: "ops-head",
          jobCardId: f.jobCardId,
          name,
          staffId: f.staffIds[staffKey],
          status: "Assigned",
          updatedAt: NOW,
        });
      }
      await ctx.db.patch("jobCards", f.jobCardId, { tourManagerName: "Vikram Singh" });
    });
    return f;
  }

  test("dry run reports, apply backfills, verify confirms zero residuals", async () => {
    vi.stubEnv("MIGRATION_SECRET", SECRET);
    const t = harness();
    const f = await seedLegacy(t);
    expect(await f.canSee("tm-first")).toBe(false);

    const dryRun = await t.mutation(
      internal.crm.tourManagerVisibilityMigration.migrateAssignedTourManagerStaffIds,
      { dryRun: true, secret: SECRET }
    );
    expect(dryRun).toMatchObject({ legacyRemaining: 1, stage: "complete", status: "failed" });
    expect(await f.assignedSet()).toEqual([]);

    const apply = await t.mutation(
      internal.crm.tourManagerVisibilityMigration.migrateAssignedTourManagerStaffIds,
      { dryRun: false, secret: SECRET }
    );
    expect(apply).toMatchObject({ converted: 1, processed: 2, stage: "verify" });
    const before = await t.run((ctx) => ctx.db.get("jobCards", f.jobCardId));
    expect(before?.updatedAt).toBe(NOW);

    const verify = await t.mutation(
      internal.crm.tourManagerVisibilityMigration.verifyAssignedTourManagerStaffIds,
      { secret: SECRET }
    );
    expect(verify).toMatchObject({ legacyRemaining: 0, stage: "complete", status: "verified" });
    const status = await t.query(
      internal.crm.tourManagerVisibilityMigration.getAssignedTourManagerStaffIdsMigrationStatus,
      { secret: SECRET }
    );
    expect(status).toMatchObject({
      key: TOUR_MANAGER_VISIBILITY_MIGRATION_KEY,
      legacyRemaining: 0,
      verified: true,
    });
    expect(await f.canSee("tm-first")).toBe(true);
    expect(await f.canSee("tm-second")).toBe(true);

    // Re-running after verification is a stable no-op.
    expect(
      await t.mutation(
        internal.crm.tourManagerVisibilityMigration.migrateAssignedTourManagerStaffIds,
        { dryRun: false, secret: SECRET }
      )
    ).toMatchObject({ processed: 0, stage: "complete", status: "verified" });
  });

  test("pages through every Job Card when the limit is below the row count", async () => {
    vi.stubEnv("MIGRATION_SECRET", SECRET);
    const t = harness();
    const f = await seedLegacy(t);
    const migrate = (dryRun: boolean) =>
      t.mutation(internal.crm.tourManagerVisibilityMigration.migrateAssignedTourManagerStaffIds, {
        dryRun,
        limit: 1,
        secret: SECRET,
      });

    expect(await migrate(true)).toMatchObject({ processed: 1, stage: "backfill" });
    expect(await migrate(true)).toMatchObject({
      legacyRemaining: 1,
      processed: 1,
      stage: "complete",
      status: "failed",
    });
    expect(await f.assignedSet()).toEqual([]);

    expect(await migrate(false)).toMatchObject({ processed: 1, stage: "backfill" });
    expect(await migrate(false)).toMatchObject({ processed: 1, stage: "verify" });
    const verify = (limit: number) =>
      t.mutation(internal.crm.tourManagerVisibilityMigration.verifyAssignedTourManagerStaffIds, {
        limit,
        secret: SECRET,
      });
    expect(await verify(1)).toMatchObject({ stage: "verify", status: "running" });
    expect(await verify(1)).toMatchObject({ legacyRemaining: 0, status: "verified" });
    expect(await f.canSee("tm-first")).toBe(true);
  });

  test("verification fails closed when a Job Card drifts after the backfill pass", async () => {
    vi.stubEnv("MIGRATION_SECRET", SECRET);
    const t = harness();
    const f = await seedLegacy(t);
    await t.mutation(
      internal.crm.tourManagerVisibilityMigration.migrateAssignedTourManagerStaffIds,
      { dryRun: false, secret: SECRET }
    );
    await t.run((ctx) =>
      ctx.db.patch("jobCards", f.jobCardId, { assignedTourManagerStaffIds: [] })
    );
    const verify = await t.mutation(
      internal.crm.tourManagerVisibilityMigration.verifyAssignedTourManagerStaffIds,
      { secret: SECRET }
    );
    expect(verify).toMatchObject({ legacyRemaining: 1, status: "failed" });
  });

  test("rejects calls without the migration secret", async () => {
    vi.stubEnv("MIGRATION_SECRET", SECRET);
    const t = harness();
    await expect(
      t.mutation(internal.crm.tourManagerVisibilityMigration.migrateAssignedTourManagerStaffIds, {
        dryRun: true,
        secret: "wrong",
      })
    ).rejects.toThrow("Invalid migration secret");
  });
});
