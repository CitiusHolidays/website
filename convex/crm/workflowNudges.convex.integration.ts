import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const FIXED_NOW = new Date("2026-08-21T03:30:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered workflow nudge operation", () => {
  test("records the repeat marker without notification content", async () => {
    const t = convexTest({ modules, schema, transactionLimits: true });
    const queryId = await t.run(async (ctx) => {
      await ctx.db.insert("staffUsers", {
        active: true,
        createdAt: FIXED_NOW.getTime(),
        email: "contracting-head@citius-e2e.test",
        emailAlertRoles: ["Contracting Head"],
        emailNormalized: "contracting-head@citius-e2e.test",
        name: "Contracting Head Fixture",
        roles: ["Contracting Head"],
        updatedAt: FIXED_NOW.getTime(),
      });
      return await ctx.db.insert("queries", {
        clientName: "Synthetic workflow nudge client",
        contractingStatus: "Query Received",
        createdAt: FIXED_NOW.getTime() - 25 * 60 * 60 * 1000,
        createdBy: "integration",
        paxCount: 1,
        queryCode: "Q-NUDGE-INTEGRATION",
        queryType: "FIT",
        salesStatus: "Proposal in discussion",
        travelType: "Domestic Travel",
        updatedAt: FIXED_NOW.getTime(),
      });
    });

    expect(await t.mutation(internal.crm.workflowNudges.runScheduledNudges, {})).toEqual({
      checked: 1,
      sent: 1,
      status: "running",
    });
    await t.run(async (ctx) => {
      const markers = await ctx.db.query("portalWorkflowRuleRuns").collect();
      expect(markers).toHaveLength(1);
      expect(markers[0]).toMatchObject({
        entityId: String(queryId),
        entityType: "query",
        lastTriggeredAt: FIXED_NOW.getTime(),
        ruleKey: "query_without_contracting_owner_after_24h",
      });
      expect(markers[0]).not.toHaveProperty("body");
      expect(markers[0]).not.toHaveProperty("title");
    });
  });
});
