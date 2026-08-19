import aggregateTest from "@convex-dev/aggregate/test";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { sacredBharatLeaderboardRanks } from "../lib/sacredBharatLeaderboardRank";
import schema from "../schema";
import { modules } from "../test.setup";
import { insertWithE2eOwnership } from "./lib/e2eOwnership";

const ACTOR = "auth_e2e_ownership";
const RUN_ID = "018fbe7a-62c8-7f35-9d2f-2d3f53f9e000";
const beginRun = makeFunctionReference<
  "mutation",
  { authUserIds: string[]; runId: string; targetId: string },
  { runId: string; target: "development" | "preview"; targetId: string }
>("crm/e2eRunOwnership:begin");
const cleanupPage = makeFunctionReference<
  "mutation",
  { pageSize: number; runId: string; targetId: string },
  { complete: boolean; deleted: number; residualCount: number; runId: string }
>("crm/e2eRunOwnership:cleanupPage");
const updateExpense = makeFunctionReference<
  "mutation",
  { category: string; expenseId: string },
  { id: Id<"expenseEntries"> }
>("crm/finance:updateExpense");
const auditTarget = makeFunctionReference<
  "query",
  { targetId: string },
  {
    activeActors: number;
    boundExceeded: boolean;
    exportSourceChunks: number;
    importOperationBatches: number;
    incompleteRuns: number;
    latestRun: {
      mutatedRecords: number;
      ownedRecords: number;
      runId: string;
      status: "active" | "cleaning" | "complete";
    } | null;
    mutatedRecords: number;
    ownedRecords: number;
    passengerExportOperations: number;
    passengerImportOperations: number;
    runsAudited: number;
    storageReferences: number;
    syntheticTravellers: number;
    targetId: string;
  }
>("crm/e2eRunOwnership:auditTarget");

function createHarness() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  aggregateTest.register(t, "sacredBharatLeaderboardRanks");
  return t;
}

async function seedActorIdentityLink(ctx: any) {
  await ctx.db.insert("authIdentityLinks", {
    canonicalAuthUserId: `https://auth.citius.test|${ACTOR}`,
    createdAt: 1,
    legacyAuthUserId: ACTOR,
    status: "linked",
    updatedAt: 1,
  });
}

beforeEach(() => {
  vi.stubEnv("E2E_PROVISIONING_TARGET", "development");
  vi.stubEnv("E2E_SEED_SECRET", "integration-secret");
  vi.stubEnv("E2E_TARGET_ID", "development-integration");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("durable E2E run ownership", () => {
  test("rejects run activation when the server is classified as production", async () => {
    const t = createHarness();
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(
      t.mutation(beginRun, {
        authUserIds: [ACTOR],
        runId: RUN_ID,
        targetId: "development-integration",
      })
    ).rejects.toThrow("E2E provisioning is not authorized");
  });

  test("attributes authenticated inserts and cleans only owned rows in resumable pages", async () => {
    const t = createHarness();
    await t.run(async (ctx) => {
      await seedActorIdentityLink(ctx);
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: ACTOR,
        createdAt: 1,
        email: "ownership@citius-e2e.test",
        emailNormalized: "ownership@citius-e2e.test",
        name: "Ownership Fixture",
        roles: ["Finance"],
        updatedAt: 1,
      });
      await ctx.db.insert("expenseEntries", {
        amount: 1,
        approvalStatus: "Pending",
        category: "Unrelated",
        createdAt: 1,
        createdBy: "developer",
        paidBy: "Developer",
        reimbursementStatus: "Not Submitted",
        updatedAt: 1,
      });
    });

    await t.mutation(beginRun, {
      authUserIds: [ACTOR],
      runId: RUN_ID,
      targetId: "development-integration",
    });
    const asFinance = t.withIdentity({
      email: "ownership@citius-e2e.test",
      issuer: "https://auth.citius.test",
      subject: ACTOR,
      tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
    });
    await asFinance.mutation(api.crm.finance.createExpense, {
      amount: 25,
      category: "Owned",
      paidBy: "E2E actor",
    });

    await t.run(async (ctx) => {
      const run = await ctx.db
        .query("e2eRuns")
        .withIndex("by_runId", (q) => q.eq("runId", RUN_ID))
        .unique();
      expect(run?.ownedCount).toBe(2);
      expect(run?.mutatedCount).toBe(0);
      expect(await ctx.db.query("e2eOwnedRecords").collect()).toHaveLength(2);
    });

    const first = await t.mutation(cleanupPage, {
      pageSize: 1,
      runId: RUN_ID,
      targetId: "development-integration",
    });
    expect(first).toMatchObject({ complete: false, deleted: 1, residualCount: 1 });
    const second = await t.mutation(cleanupPage, {
      pageSize: 1,
      runId: RUN_ID,
      targetId: "development-integration",
    });
    expect(second).toMatchObject({ complete: true, deleted: 1, residualCount: 0 });
    const replay = await t.mutation(cleanupPage, {
      pageSize: 1,
      runId: RUN_ID,
      targetId: "development-integration",
    });
    expect(replay).toMatchObject({ complete: true, deleted: 0, residualCount: 0 });
    await expect(
      t.query(auditTarget, { targetId: "development-integration" })
    ).resolves.toMatchObject({
      activeActors: 0,
      boundExceeded: false,
      exportSourceChunks: 0,
      importOperationBatches: 0,
      incompleteRuns: 0,
      latestRun: {
        mutatedRecords: 0,
        ownedRecords: 0,
        runId: RUN_ID,
        status: "complete",
      },
      mutatedRecords: 0,
      ownedRecords: 0,
      passengerExportOperations: 0,
      passengerImportOperations: 0,
      runsAudited: 1,
      storageReferences: 0,
      syntheticTravellers: 0,
    });

    await t.run(async (ctx) => {
      const expenses = await ctx.db.query("expenseEntries").collect();
      expect(expenses).toHaveLength(1);
      expect(expenses[0]?.category).toBe("Unrelated");
      expect(await ctx.db.query("activityLogs").collect()).toHaveLength(0);
      expect(await ctx.db.query("e2eOwnedRecords").collect()).toHaveLength(0);
    });
  });

  test("audits older completed-run ledgers and repairs counters before accepting cleanup", async () => {
    const t = createHarness();
    const olderRunId = "018fbe7a-62c8-7f35-9d2f-2d3f53f9e001";
    let expenseId: Id<"expenseEntries"> | null = null;
    await t.run(async (ctx) => {
      expenseId = await ctx.db.insert("expenseEntries", {
        amount: 1,
        approvalStatus: "Pending",
        category: "Dangling completed-run fixture",
        createdAt: 1,
        createdBy: ACTOR,
        paidBy: "E2E actor",
        reimbursementStatus: "Not Submitted",
        updatedAt: 1,
      });
      await ctx.db.insert("e2eRuns", {
        completedAt: 2,
        createdAt: 1,
        mutatedCount: 0,
        ownedCount: 0,
        runId: olderRunId,
        status: "complete",
        target: "development",
        targetId: "development-integration",
        updatedAt: 2,
      });
      await ctx.db.insert("e2eOwnedRecords", {
        cleanupOrder: 10,
        createdAt: 1,
        documentId: String(expenseId),
        runId: olderRunId,
        storageIds: [],
        tableName: "expenseEntries",
      });
    });

    await expect(
      t.query(auditTarget, { targetId: "development-integration" })
    ).resolves.toMatchObject({
      boundExceeded: false,
      incompleteRuns: 0,
      mutatedRecords: 0,
      ownedRecords: 1,
      runsAudited: 1,
    });

    await expect(
      t.mutation(cleanupPage, {
        pageSize: 10,
        runId: olderRunId,
        targetId: "development-integration",
      })
    ).resolves.toMatchObject({ complete: true, deleted: 1, residualCount: 0 });
    await expect(
      t.query(auditTarget, { targetId: "development-integration" })
    ).resolves.toMatchObject({ mutatedRecords: 0, ownedRecords: 0, runsAudited: 1 });
    if (!expenseId) {
      throw new Error("Dangling expense fixture was not created");
    }
    const danglingExpenseId = expenseId;
    await t.run(async (ctx) => {
      expect(await ctx.db.get("expenseEntries", danglingExpenseId)).toBeNull();
    });
  });

  test("restores the first snapshot of a reusable record after owned rows are removed", async () => {
    const t = createHarness();
    let expenseId: Id<"expenseEntries"> | null = null;
    await t.run(async (ctx) => {
      await seedActorIdentityLink(ctx);
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: ACTOR,
        createdAt: 1,
        email: "ownership@citius-e2e.test",
        emailNormalized: "ownership@citius-e2e.test",
        name: "Ownership Fixture",
        roles: ["Finance"],
        updatedAt: 1,
      });
      expenseId = await ctx.db.insert("expenseEntries", {
        amount: 10,
        approvalStatus: "Pending",
        category: "Original",
        createdAt: 1,
        createdBy: ACTOR,
        paidBy: "E2E actor",
        reimbursementStatus: "Not Submitted",
        updatedAt: 1,
      });
    });
    if (!expenseId) {
      throw new Error("Expense fixture was not created");
    }
    const persistedExpenseId = expenseId;
    await t.mutation(beginRun, {
      authUserIds: [ACTOR],
      runId: RUN_ID,
      targetId: "development-integration",
    });
    const asFinance = t.withIdentity({
      email: "ownership@citius-e2e.test",
      issuer: "https://auth.citius.test",
      subject: ACTOR,
      tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
    });
    await asFinance.mutation(updateExpense, {
      category: "First patch",
      expenseId: persistedExpenseId,
    });
    await asFinance.mutation(updateExpense, {
      category: "Second patch",
      expenseId: persistedExpenseId,
    });
    await t.run(async (ctx) => {
      const run = await ctx.db
        .query("e2eRuns")
        .withIndex("by_runId", (q) => q.eq("runId", RUN_ID))
        .unique();
      expect(run).toMatchObject({ mutatedCount: 1, ownedCount: 2 });
      const expense = await ctx.db.get("expenseEntries", persistedExpenseId);
      expect(expense?.category).toBe("Second patch");
    });

    let result = await t.mutation(cleanupPage, {
      pageSize: 1,
      runId: RUN_ID,
      targetId: "development-integration",
    });
    while (!result.complete) {
      result = await t.mutation(cleanupPage, {
        pageSize: 1,
        runId: RUN_ID,
        targetId: "development-integration",
      });
    }
    await t.run(async (ctx) => {
      const expense = await ctx.db.get("expenseEntries", persistedExpenseId);
      expect(expense?.category).toBe("Original");
      expect(await ctx.db.query("activityLogs").collect()).toEqual([]);
      expect(await ctx.db.query("e2eMutatedRecords").collect()).toEqual([]);
    });
  });

  test("cleans ledger rows for owned documents already deleted by the workflow", async () => {
    const t = createHarness();
    await t.run(async (ctx) => {
      await seedActorIdentityLink(ctx);
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: ACTOR,
        createdAt: 1,
        email: "ownership@citius-e2e.test",
        emailNormalized: "ownership@citius-e2e.test",
        name: "Ownership Fixture",
        roles: ["Finance"],
        updatedAt: 1,
      });
    });
    await t.mutation(beginRun, {
      authUserIds: [ACTOR],
      runId: RUN_ID,
      targetId: "development-integration",
    });
    const asFinance = t.withIdentity({
      email: "ownership@citius-e2e.test",
      issuer: "https://auth.citius.test",
      subject: ACTOR,
      tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
    });
    const { id: expenseId } = await asFinance.mutation(api.crm.finance.createExpense, {
      amount: 25,
      category: "Deleted before cleanup",
      paidBy: "E2E actor",
    });
    await t.run(async (ctx) => {
      await ctx.db.delete("expenseEntries", expenseId);
    });

    const result = await t.mutation(cleanupPage, {
      pageSize: 50,
      runId: RUN_ID,
      targetId: "development-integration",
    });

    expect(result).toMatchObject({ complete: true, residualCount: 0 });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("e2eOwnedRecords").collect()).toEqual([]);
    });
  });

  test("removes authenticated Sacred Bharat rows and their aggregate rank", async () => {
    const t = createHarness();
    await t.run(seedActorIdentityLink);
    await t.mutation(beginRun, {
      authUserIds: [ACTOR],
      runId: RUN_ID,
      targetId: "development-integration",
    });
    const asCustomer = t.withIdentity({
      email: "sacred-ownership@citius-e2e.test",
      issuer: "https://auth.citius.test",
      name: "Sacred Ownership Fixture",
      subject: ACTOR,
      tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
    });

    await asCustomer.mutation(api.sacredBharat.mergeGuestProgress, {
      templeIds: ["kedarnath"],
      wishlist: [{ itemId: "shiva-trail", itemType: "trail" }],
    });

    await t.run(async (ctx) => {
      expect(await ctx.db.query("sacredBharatVisits").collect()).toHaveLength(1);
      expect(await ctx.db.query("sacredBharatWishlist").collect()).toHaveLength(1);
      expect(await ctx.db.query("sacredBharatLeaderboardSummaries").collect()).toHaveLength(1);
      expect(await ctx.db.query("e2eOwnedRecords").collect()).toHaveLength(3);
      expect(await sacredBharatLeaderboardRanks.count(ctx, { namespace: "eligible" })).toBe(1);
    });

    const result = await t.mutation(cleanupPage, {
      pageSize: 50,
      runId: RUN_ID,
      targetId: "development-integration",
    });
    expect(result).toMatchObject({ complete: true, deleted: 3, residualCount: 0 });

    await t.run(async (ctx) => {
      expect(await ctx.db.query("sacredBharatVisits").collect()).toEqual([]);
      expect(await ctx.db.query("sacredBharatWishlist").collect()).toEqual([]);
      expect(await ctx.db.query("sacredBharatLeaderboardSummaries").collect()).toEqual([]);
      expect(await ctx.db.query("e2eOwnedRecords").collect()).toEqual([]);
      expect(await sacredBharatLeaderboardRanks.count(ctx, { namespace: "eligible" })).toBe(0);
    });
  });

  test("attributes authless internal-action writes to an explicit E2E actor", async () => {
    const t = createHarness();
    let jobCardId: Id<"jobCards"> | null = null;
    await t.run(async (ctx) => {
      jobCardId = await ctx.db.insert("jobCards", {
        clientName: "Import Ownership Fixture",
        confirmedPax: 1,
        createdAt: 1,
        createdBy: ACTOR,
        destination: "Test",
        jobCode: "JC-IMPORT-OWNERSHIP",
        status: "Open",
        updatedAt: 1,
      });
    });
    if (!jobCardId) {
      throw new Error("Import ownership Job Card was not created");
    }
    await t.mutation(beginRun, {
      authUserIds: [ACTOR],
      runId: RUN_ID,
      targetId: "development-integration",
    });
    const persistedJobCardId = jobCardId;
    await t.run(async (ctx) => {
      await insertWithE2eOwnership(
        ctx,
        "passengerImportOperations",
        {
          batchTotal: 1,
          completedBatches: 0,
          created: 0,
          errorSummary: { retryable: 0, terminal: 0 },
          failed: 0,
          importKinds: ["passenger"],
          initiatedBy: ACTOR,
          jobCardId: persistedJobCardId,
          processed: 0,
          remaining: 1,
          roomSummary: {},
          sourceDigest: "a".repeat(64),
          startedAt: 1,
          status: "running",
          terminalBatches: 0,
          total: 1,
          updated: 0,
          updatedAt: 1,
        },
        { authUserId: ACTOR }
      );
      expect(await ctx.db.query("e2eOwnedRecords").collect()).toHaveLength(1);
    });

    const result = await t.mutation(cleanupPage, {
      pageSize: 50,
      runId: RUN_ID,
      targetId: "development-integration",
    });
    expect(result).toMatchObject({ complete: true, deleted: 1, residualCount: 0 });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("passengerImportOperations").collect()).toEqual([]);
      expect(await ctx.db.get("jobCards", persistedJobCardId)).not.toBeNull();
    });
  });
});
