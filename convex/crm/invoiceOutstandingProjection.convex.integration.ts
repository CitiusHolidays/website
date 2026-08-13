import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

interface ProjectionResult {
  generation: number;
  processed: number;
  ready: boolean;
  residuals: number;
  scheduled: boolean;
  stage: "backfill" | "verify" | "complete";
  status: "running" | "complete" | "failed";
}

const startProjection = makeFunctionReference<"mutation", Record<string, never>, ProjectionResult>(
  "crm/invoiceOutstandingProjection:startProjectionReconciliation"
);
const reconcileProjectionPage = makeFunctionReference<
  "mutation",
  {
    cursor: string | null;
    generation: number;
    stage: "backfill" | "verify" | "complete";
  },
  ProjectionResult
>("crm/invoiceOutstandingProjection:reconcileProjectionPage");

const ACTOR = "auth_invoice_projection_integration";
const FIXED_NOW = new Date("2026-08-12T17:00:00.000Z");

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function seedJobCard(t: ReturnType<typeof createHarness>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("jobCards", {
      clientName: "Invoice Projection Client",
      confirmedPax: 2,
      createdAt: FIXED_NOW.getTime(),
      createdBy: ACTOR,
      destination: "Goa",
      jobCode: "JC-INVOICE-PROJECTION",
      status: "Open",
      updatedAt: FIXED_NOW.getTime(),
    })
  );
}

async function seedLegacyInvoices(
  t: ReturnType<typeof createHarness>,
  jobCardId: Id<"jobCards">,
  total: number
) {
  return await t.run(async (ctx) => {
    const ids: Id<"invoices">[] = [];
    for (let index = 0; index < total; index += 1) {
      const balanceAmount = index % 3 === 0 ? 0 : index + 1;
      ids.push(
        await ctx.db.insert("invoices", {
          balanceAmount,
          createdAt: FIXED_NOW.getTime() - index,
          createdBy: "legacy",
          expectedAmount: balanceAmount,
          invoiceNumber: `INV-LEGACY-${index}`,
          jobCardId,
          receivedAmount: 0,
          status: balanceAmount > 0 ? "Generated" : "Paid",
          updatedAt: FIXED_NOW.getTime() - index,
        })
      );
    }
    return ids;
  });
}

async function seedDirector(t: ReturnType<typeof createHarness>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("authIdentityLinks", {
      canonicalAuthUserId: `https://auth.citius.test|${ACTOR}`,
      createdAt: FIXED_NOW.getTime(),
      legacyAuthUserId: ACTOR,
      status: "linked",
      updatedAt: FIXED_NOW.getTime(),
    });
    await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: ACTOR,
      createdAt: FIXED_NOW.getTime(),
      email: "invoice-projection@citius.test",
      emailNormalized: "invoice-projection@citius.test",
      name: "Invoice Projection Director",
      roles: ["Directors"],
      updatedAt: FIXED_NOW.getTime(),
    });
  });
  return t.withIdentity({
    email: "invoice-projection@citius.test",
    issuer: "https://auth.citius.test",
    subject: ACTOR,
    tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered invoice outstanding projection migration", () => {
  test("backfills, verifies, and serves all positive balances through the compound index", async () => {
    const t = createHarness();
    const jobCardId = await seedJobCard(t);
    await seedLegacyInvoices(t, jobCardId, 135);

    expect(await t.mutation(startProjection, {})).toMatchObject({
      generation: 1,
      scheduled: true,
      stage: "backfill",
      status: "running",
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const firstIndexedPage = await t.run(async (ctx) => {
      const readiness = await ctx.db
        .query("invoiceOutstandingProjectionReadiness")
        .withIndex("by_key", (q) => q.eq("key", "invoices.outstanding.v1"))
        .unique();
      expect(readiness).toMatchObject({
        processed: 270,
        ready: true,
        residuals: 0,
        stage: "complete",
        status: "complete",
        version: 1,
      });
      const allRows = await ctx.db.query("invoices").collect();
      expect(allRows).toHaveLength(135);
      expect(allRows.every((row) => row.hasOutstandingBalance === row.balanceAmount > 0)).toBe(
        true
      );

      return await ctx.db
        .query("invoices")
        .withIndex("by_hasOutstandingBalance_and_createdAt", (q) =>
          q.eq("hasOutstandingBalance", true)
        )
        .order("desc")
        .paginate({ cursor: null, numItems: 50 });
    });
    expect(firstIndexedPage.page).toHaveLength(50);
    const secondIndexedPage = await t.run(async (ctx) =>
      ctx.db
        .query("invoices")
        .withIndex("by_hasOutstandingBalance_and_createdAt", (q) =>
          q.eq("hasOutstandingBalance", true)
        )
        .order("desc")
        .paginate({ cursor: firstIndexedPage.continueCursor, numItems: 50 })
    );
    expect(secondIndexedPage.page).toHaveLength(40);
    const indexedRows = [...firstIndexedPage.page, ...secondIndexedPage.page];
    expect(indexedRows).toHaveLength(90);
    expect(indexedRows.every((row) => row.balanceAmount > 0)).toBe(true);

    const asDirector = await seedDirector(t);
    const firstPublicPage = await asDirector.query(api.crm.finance.listFinanceOutstanding, {
      paginationOpts: { cursor: null, numItems: 50 },
      referenceDate: "2026-08-13",
    });
    const secondPublicPage = await asDirector.query(api.crm.finance.listFinanceOutstanding, {
      paginationOpts: { cursor: firstPublicPage.continueCursor, numItems: 50 },
      referenceDate: "2026-08-13",
    });
    expect(firstPublicPage.page).toHaveLength(50);
    expect(secondPublicPage.page).toHaveLength(40);
    expect(
      [...firstPublicPage.page, ...secondPublicPage.page].every((row) => row.dueAmount > 0)
    ).toBe(true);

    expect(await t.mutation(startProjection, {})).toMatchObject({
      generation: 1,
      ready: true,
      scheduled: false,
      status: "complete",
    });
  });

  test("fails readiness when verification observes a projection mismatch", async () => {
    const t = createHarness();
    const jobCardId = await seedJobCard(t);
    const [invoiceId] = await seedLegacyInvoices(t, jobCardId, 1);
    await t.mutation(startProjection, {});
    expect(
      await t.mutation(reconcileProjectionPage, {
        cursor: null,
        generation: 1,
        stage: "backfill",
      })
    ).toMatchObject({ scheduled: true, stage: "verify" });
    await t.run(async (ctx) => {
      await ctx.db.patch("invoices", invoiceId, {
        balanceAmount: 10,
        hasOutstandingBalance: false,
      });
    });
    expect(
      await t.mutation(reconcileProjectionPage, {
        cursor: null,
        generation: 1,
        stage: "verify",
      })
    ).toMatchObject({
      ready: false,
      residuals: 1,
      scheduled: false,
      stage: "complete",
      status: "failed",
    });
  });

  test("projects create and update balance changes in the same finance mutation", async () => {
    const t = createHarness();
    const jobCardId = await seedJobCard(t);
    const asDirector = await seedDirector(t);
    const created = await asDirector.mutation(api.crm.finance.createInvoice, {
      expectedAmount: 100,
      invoiceNumber: "INV-PROJECTION-WRITER",
      jobCardId,
      receivedAmount: 25,
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("invoices", created.id)).toMatchObject({
        balanceAmount: 75,
        hasOutstandingBalance: true,
      });
    });
    await asDirector.mutation(api.crm.finance.updateInvoice, {
      invoiceId: created.id,
      receivedAmount: 100,
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("invoices", created.id)).toMatchObject({
        balanceAmount: 0,
        hasOutstandingBalance: false,
        status: "Paid",
      });
    });
  });
});
