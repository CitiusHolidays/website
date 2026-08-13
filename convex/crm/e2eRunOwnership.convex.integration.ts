import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

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

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
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

    await t.run(async (ctx) => {
      const expenses = await ctx.db.query("expenseEntries").collect();
      expect(expenses).toHaveLength(1);
      expect(expenses[0]?.category).toBe("Unrelated");
      expect(await ctx.db.query("activityLogs").collect()).toHaveLength(0);
      expect(await ctx.db.query("e2eOwnedRecords").collect()).toHaveLength(0);
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
    await asFinance.mutation(api.crm.finance.updateExpense, {
      category: "First patch",
      expenseId: persistedExpenseId,
    });
    await asFinance.mutation(api.crm.finance.updateExpense, {
      category: "Second patch",
      expenseId: persistedExpenseId,
    });
    await t.run(async (ctx) => {
      const run = await ctx.db
        .query("e2eRuns")
        .withIndex("by_runId", (q) => q.eq("runId", RUN_ID))
        .unique();
      expect(run).toMatchObject({ mutatedCount: 1, ownedCount: 2 });
      const expense = (await ctx.db.get(persistedExpenseId)) as Doc<"expenseEntries"> | null;
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
      const expense = (await ctx.db.get(persistedExpenseId)) as Doc<"expenseEntries"> | null;
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
      await ctx.db.delete(expenseId);
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
});
