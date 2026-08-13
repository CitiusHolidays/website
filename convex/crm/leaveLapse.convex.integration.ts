import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

const ACTOR = "auth_leave_lapse_integration";
const FISCAL_YEAR = "2025-2026";
const FIXED_NOW = new Date("2026-03-30T18:30:00.000Z");

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function seedStaffAndBalances(
  t: ReturnType<typeof createHarness>,
  total: number,
  options: { includeDirector?: boolean } = {}
) {
  return await t.run(async (ctx) => {
    if (options.includeDirector) {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `https://auth.citius.test|${ACTOR}`,
        createdAt: FIXED_NOW.getTime(),
        legacyAuthUserId: ACTOR,
        status: "linked",
        updatedAt: FIXED_NOW.getTime(),
      });
    }
    const staffIds: Id<"staffUsers">[] = [];
    for (let index = 0; index < total; index += 1) {
      const isDirector = options.includeDirector && index === 0;
      const staffId = await ctx.db.insert("staffUsers", {
        active: true,
        ...(isDirector ? { authUserId: ACTOR } : {}),
        createdAt: FIXED_NOW.getTime() - total + index,
        email: `leave-lapse-${index}@citius.test`,
        emailNormalized: `leave-lapse-${index}@citius.test`,
        name: `Leave Lapse ${index}`,
        roles: isDirector ? ["Directors"] : ["Sales"],
        updatedAt: FIXED_NOW.getTime(),
      });
      staffIds.push(staffId);
      await ctx.db.insert("staffLeaveBalances", {
        accruedDays: 0,
        availableDays: index === total - 1 ? 0 : 2,
        carriedForwardDays: 0,
        encashableDays: 0,
        fiscalYear: FISCAL_YEAR,
        leaveType: "Casual",
        openingDays: 2,
        staffId,
        updatedAt: FIXED_NOW.getTime(),
        usedDays: 0,
      });
      if (index % 2 === 0) {
        await ctx.db.insert("staffLeaveBalances", {
          accruedDays: 0,
          availableDays: 1,
          carriedForwardDays: 0,
          encashableDays: 0,
          fiscalYear: FISCAL_YEAR,
          leaveType: "Sick",
          openingDays: 1,
          staffId,
          updatedAt: FIXED_NOW.getTime(),
          usedDays: 0,
        });
      }
    }
    return staffIds;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered CL/SL lapse operation", () => {
  test("completes multiple bounded pages with positive balances exactly once", async () => {
    const t = createHarness();
    const staffIds = await seedStaffAndBalances(t, 45);
    const started = await t.mutation(internal.crm.leaveLapse.startClSlLapseRun, {
      fiscalYear: FISCAL_YEAR,
      initiatedBy: "integration",
      trigger: "manual",
    });
    expect(started).toMatchObject({ generation: 1, scheduled: true, status: "queued" });
    expect(
      await t.mutation(internal.crm.leaveLapse.startClSlLapseRun, {
        fiscalYear: FISCAL_YEAR,
        initiatedBy: "overlap",
        trigger: "automatic",
      })
    ).toMatchObject({ generation: 1, runId: started.runId, scheduled: true });

    const firstPage = await t.mutation(internal.crm.leaveLapse.applyClSlLapsePage, {
      continuation: 0,
      generation: 1,
      runId: started.runId,
    });
    expect(firstPage).toMatchObject({
      continuation: 1,
      processedStaff: 20,
      scheduled: true,
      status: "running",
    });
    const staleReplay = await t.mutation(internal.crm.leaveLapse.applyClSlLapsePage, {
      continuation: 0,
      generation: 1,
      runId: started.runId,
    });
    expect(staleReplay).toMatchObject({ continuation: 1, processedStaff: 20, scheduled: false });

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await t.run(async (ctx) => {
      const run = await ctx.db.get("staffLeaveLapseRuns", started.runId);
      expect(run).toMatchObject({
        continuation: 3,
        lapsedRows: 67,
        processedStaff: 45,
        status: "completed",
      });
      const ledgers = await ctx.db.query("staffLeaveLedger").collect();
      expect(ledgers).toHaveLength(67);
      expect(ledgers.every((row) => row.entryType === "lapse" && row.createdBy === "system")).toBe(
        true
      );
      for (const staffId of staffIds) {
        const rows = ledgers.filter((row) => row.staffId === staffId);
        expect(new Set(rows.map((row) => row.leaveType)).size).toBe(rows.length);
      }
      const balances = await ctx.db.query("staffLeaveBalances").collect();
      expect(balances.every((row) => row.availableDays === 0)).toBe(true);
    });

    const completedReplay = await t.mutation(internal.crm.leaveLapse.startClSlLapseRun, {
      fiscalYear: FISCAL_YEAR,
      initiatedBy: "replay",
      trigger: "manual",
    });
    expect(completedReplay).toMatchObject({
      lapsedRows: 67,
      processedStaff: 45,
      runId: started.runId,
      scheduled: false,
      status: "completed",
    });
  });

  test("requires an explicit valid fiscal year for an authorized manual start", async () => {
    const t = createHarness();
    await seedStaffAndBalances(t, 1, { includeDirector: true });
    const asDirector = t.withIdentity({
      email: "leave-lapse-0@citius.test",
      issuer: "https://auth.citius.test",
      subject: ACTOR,
      tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
    });

    await expect(
      asDirector.mutation(api.crm.leaveLapse.runClSlLapse, {} as { fiscalYear: string })
    ).rejects.toThrow();
    await expect(
      asDirector.mutation(api.crm.leaveLapse.runClSlLapse, { fiscalYear: "2025-2027" })
    ).rejects.toThrow("Fiscal year must use");
    const started = await asDirector.mutation(api.crm.leaveLapse.runClSlLapse, {
      fiscalYear: FISCAL_YEAR,
    });
    expect(started).toMatchObject({ fiscalYear: FISCAL_YEAR, status: "queued" });
    expect(
      await asDirector.query(api.crm.leaveLapse.getClSlLapseStatus, {
        fiscalYear: FISCAL_YEAR,
      })
    ).toMatchObject({ runId: started.runId, scheduled: true, status: "queued" });
  });

  test("records a fenced failure and permits a new generation to resume safely", async () => {
    const t = createHarness();
    await seedStaffAndBalances(t, 1);
    const started = await t.mutation(internal.crm.leaveLapse.startClSlLapseRun, {
      fiscalYear: FISCAL_YEAR,
      initiatedBy: "integration",
      trigger: "manual",
    });
    const failed = await t.mutation(internal.crm.leaveLapse.recordClSlLapseFailure, {
      continuation: 0,
      failureCode: "InjectedFailure",
      generation: 1,
      runId: started.runId,
    });
    expect(failed).toMatchObject({ scheduled: false, status: "failed" });

    const resumed = await t.mutation(internal.crm.leaveLapse.startClSlLapseRun, {
      fiscalYear: FISCAL_YEAR,
      initiatedBy: "retry",
      trigger: "manual",
    });
    expect(resumed).toMatchObject({ generation: 2, scheduled: true, status: "queued" });
    expect(resumed.runId).not.toBe(started.runId);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await t.run(async (ctx) => {
      expect(await ctx.db.get("staffLeaveLapseRuns", resumed.runId)).toMatchObject({
        lapsedRows: 1,
        processedStaff: 1,
        status: "completed",
      });
      expect(await ctx.db.query("staffLeaveLedger").collect()).toHaveLength(1);
    });
  });
});
