import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const ACTOR = "auth_job_card_integration";
const FIXED_NOW = new Date("2026-08-12T12:00:00.000Z");

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function seedActorIdentityLink(ctx: any) {
  await ctx.db.insert("authIdentityLinks", {
    canonicalAuthUserId: `https://auth.citius.test|${ACTOR}`,
    createdAt: FIXED_NOW.getTime(),
    legacyAuthUserId: ACTOR,
    status: "linked",
    updatedAt: FIXED_NOW.getTime(),
  });
}

async function seedEditableJobCard(t: ReturnType<typeof createHarness>) {
  return await t.run(async (ctx) => {
    await seedActorIdentityLink(ctx);
    await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: ACTOR,
      createdAt: FIXED_NOW.getTime(),
      email: "job-card-integration@citius-e2e.test",
      emailNormalized: "job-card-integration@citius-e2e.test",
      name: "Job Card Integration",
      roles: ["Directors"],
      updatedAt: FIXED_NOW.getTime(),
    });
    return await ctx.db.insert("jobCards", {
      clientName: "Original client",
      confirmedPax: 10,
      createdAt: FIXED_NOW.getTime(),
      createdBy: ACTOR,
      destination: "Goa",
      jobCode: "JC-9001-JC",
      status: "Open",
      updatedAt: FIXED_NOW.getTime(),
    });
  });
}

async function seedDeletionGraph(t: ReturnType<typeof createHarness>) {
  return await t.run(async (ctx) => {
    await seedActorIdentityLink(ctx);
    const staffId = await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: ACTOR,
      createdAt: FIXED_NOW.getTime(),
      email: "job-card-integration@citius-e2e.test",
      emailNormalized: "job-card-integration@citius-e2e.test",
      name: "Job Card Integration",
      roles: ["Directors"],
      updatedAt: FIXED_NOW.getTime(),
    });
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Deletion graph client",
      confirmedPax: 1,
      createdAt: FIXED_NOW.getTime(),
      createdBy: ACTOR,
      destination: "Kolkata",
      jobCode: "JC-9002-JC",
      status: "Open",
      updatedAt: FIXED_NOW.getTime(),
    });
    const travellerId = await ctx.db.insert("travellers", {
      callingStatus: "Pending",
      createdAt: FIXED_NOW.getTime(),
      createdBy: ACTOR,
      foodPreference: "Veg",
      fullName: "Synthetic Traveller",
      guestType: "Client",
      jobCardId,
      paymentType: "Company Paid",
      roomType: "Single",
      ticketStatus: "Pending Issue",
      updatedAt: FIXED_NOW.getTime(),
      visaRequired: true,
      visaStatus: "Not Started",
    });
    for (let index = 0; index < 33; index += 1) {
      await ctx.db.insert("passportDetails", {
        createdAt: FIXED_NOW.getTime(),
        createdBy: ACTOR,
        encryptedPayload: `synthetic-${index}`,
        travellerId,
        updatedAt: FIXED_NOW.getTime(),
      });
    }
    const expenseId = await ctx.db.insert("expenseEntries", {
      amount: 100,
      approvalStatus: "Pending",
      category: "Meals",
      createdAt: FIXED_NOW.getTime(),
      createdBy: ACTOR,
      jobCardId,
      paidBy: "Synthetic owner",
      reimbursementStatus: "Pending",
      updatedAt: FIXED_NOW.getTime(),
    });
    const approvalId = await ctx.db.insert("approvalRequests", {
      createdAt: FIXED_NOW.getTime(),
      entityId: String(expenseId),
      entityType: "expense",
      requestCode: "APR-9001",
      requestedBy: ACTOR,
      status: "Pending",
      summary: "Synthetic expense approval",
      type: "expense",
      updatedAt: FIXED_NOW.getTime(),
    });
    const notificationId = await ctx.db.insert("notifications", {
      body: "Synthetic deletion notification",
      createdAt: FIXED_NOW.getTime(),
      entityId: String(travellerId),
      entityType: "traveller",
      recipientStaffId: staffId,
      title: "Synthetic notification",
    });
    await ctx.db.insert("notificationReads", {
      notificationId,
      readAt: FIXED_NOW.getTime(),
      staffId,
    });
    return { approvalId, expenseId, jobCardId, notificationId, travellerId };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered Job Card mutation boundary", () => {
  test("validates auth, args, return value, schema writes, and activity atomically", async () => {
    const t = createHarness();
    const jobCardId = await seedEditableJobCard(t);
    const asDirector = t.withIdentity({
      email: "job-card-integration@citius-e2e.test",
      issuer: "https://auth.citius.test",
      subject: ACTOR,
      tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
    });

    const result = await asDirector.mutation(api.crm.jobCards.update, {
      clientName: "Updated client",
      jobCardId,
    });

    expect(result).toEqual({ id: jobCardId });
    await t.run(async (ctx) => {
      expect((await ctx.db.get(jobCardId))?.clientName).toBe("Updated client");
      const activity = await ctx.db.query("activityLogs").collect();
      expect(activity).toHaveLength(1);
      expect(activity[0]).toMatchObject({
        action: "updated",
        actorId: `https://auth.citius.test|${ACTOR}`,
        entityId: jobCardId,
        entityType: "jobCard",
      });
    });

    await expect(
      t.mutation(api.crm.jobCards.update, { clientName: "Unauthorized", jobCardId })
    ).rejects.toThrow();
    await expect(
      asDirector.mutation(api.crm.jobCards.update, {
        clientName: "Invalid argument",
        confirmedPax: "ten",
        jobCardId,
      } as never)
    ).rejects.toThrow();
  });

  test("rejects missing rows through the registered mutation without committing activity", async () => {
    const t = createHarness();
    const jobCardId = await seedEditableJobCard(t);
    const asDirector = t.withIdentity({
      email: "job-card-integration@citius-e2e.test",
      issuer: "https://auth.citius.test",
      subject: ACTOR,
      tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
    });
    await t.run(async (ctx) => ctx.db.delete(jobCardId));

    await expect(
      asDirector.mutation(api.crm.jobCards.update, {
        clientName: "Stale update",
        jobCardId,
      })
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      expect(await ctx.db.query("activityLogs").collect()).toEqual([]);
    });
  });

  test("drains the real paged deletion scheduler graph to one replay-safe terminal operation", async () => {
    const t = createHarness();
    const fixture = await seedDeletionGraph(t);
    const asDirector = t.withIdentity({
      email: "job-card-integration@citius-e2e.test",
      issuer: "https://auth.citius.test",
      subject: ACTOR,
      tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
    });

    const started = await asDirector.mutation(api.crm.jobCards.remove, {
      jobCardId: fixture.jobCardId,
    });
    expect(started).toMatchObject({ id: fixture.jobCardId, status: "running" });
    await expect(
      t.mutation(internal.crm.jobCardDeletion.continueJobCardCascade, {
        jobCardId: fixture.jobCardId,
        operationId: started.operationId,
        stage: "not-a-stage",
      } as never)
    ).rejects.toThrow();

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await t.run(async (ctx) => {
      expect(await ctx.db.get(fixture.jobCardId)).toBeNull();
      expect(await ctx.db.get(fixture.travellerId)).toBeNull();
      expect(await ctx.db.get(fixture.expenseId)).toBeNull();
      expect(await ctx.db.get(fixture.approvalId)).toBeNull();
      expect(await ctx.db.get(fixture.notificationId)).toBeNull();
      expect(await ctx.db.query("passportDetails").collect()).toEqual([]);
      expect(await ctx.db.query("notificationReads").collect()).toEqual([]);
      const operation = await ctx.db.get(started.operationId);
      expect(operation).toMatchObject({
        deletedCount: 2,
        stage: "complete",
        status: "complete",
      });
      expect(operation?.stageCounts).toEqual(
        expect.arrayContaining([
          { count: 1, stage: "expenseEntries" },
          { count: 1, stage: "travellers" },
        ])
      );
      const workers = await ctx.db.query("jobCardDeletionWorkers").collect();
      expect(workers).toHaveLength(2);
      expect(workers.every((worker) => worker.status === "complete")).toBe(true);
      expect(await ctx.db.query("activityLogs").collect()).toHaveLength(1);
    });

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const replay = await asDirector.mutation(api.crm.jobCards.remove, {
      jobCardId: fixture.jobCardId,
    });
    expect(replay).toEqual({
      id: fixture.jobCardId,
      operationId: started.operationId,
      status: "complete",
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("jobCardDeletionOperations").collect()).toHaveLength(1);
      expect(await ctx.db.query("jobCardDeletionWorkers").collect()).toHaveLength(2);
    });
  });
});
