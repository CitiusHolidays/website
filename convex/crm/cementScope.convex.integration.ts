import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const FIXED_NOW = new Date("2026-08-12T12:00:00.000Z").getTime();

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

describe("registered Cement query scope", () => {
  test("rejects direct non-Cement mutation for Sales and Contracting Cement identities", async () => {
    const t = createHarness();
    const fixture = await t.run(async (ctx) => {
      const salesStaffId = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: "auth_sales_cement",
        createdAt: FIXED_NOW,
        email: "sales-cement@citius-e2e.test",
        emailNormalized: "sales-cement@citius-e2e.test",
        name: "Sales Cement Fixture",
        roles: ["Sales Cement"],
        updatedAt: FIXED_NOW,
      });
      const contractingStaffId = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: "auth_contracting_cement",
        createdAt: FIXED_NOW,
        email: "contracting-cement@citius-e2e.test",
        emailNormalized: "contracting-cement@citius-e2e.test",
        name: "Contracting Cement Fixture",
        roles: ["Contracting Cement"],
        updatedAt: FIXED_NOW,
      });
      const queryId = await ctx.db.insert("queries", {
        batchingNotes: "",
        clientName: "Forbidden MICE client",
        contractingOwnerId: contractingStaffId,
        contractingOwnerName: "Contracting Cement Fixture",
        contractingStatus: "Proposal in progress",
        createdAt: FIXED_NOW,
        createdBy: "auth_sales_cement",
        destination: "Goa",
        leadStage: "Proposal",
        listSearchText: "forbidden mice client goa",
        paxCount: 2,
        queryCode: "Q-CEMENT-SCOPE-INTEGRATION",
        queryType: "MICE",
        salesOwnerId: "auth_sales_cement",
        salesOwnerName: "Sales Cement Fixture",
        salesStatus: "Proposal in discussion",
        source: "Client",
        ticketingScope: "Not required",
        travelEndDate: "2026-12-06",
        travelInBatches: false,
        travelStartDate: "2026-12-01",
        travelType: "Domestic Travel",
        updatedAt: FIXED_NOW,
      });
      return { contractingStaffId, queryId, salesStaffId };
    });

    for (const identity of [
      {
        email: "sales-cement@citius-e2e.test",
        subject: "auth_sales_cement",
      },
      {
        email: "contracting-cement@citius-e2e.test",
        subject: "auth_contracting_cement",
      },
    ]) {
      const authenticated = t.withIdentity({
        ...identity,
        issuer: "https://auth.citius.test",
        tokenIdentifier: `https://auth.citius.test|${identity.subject}`,
      });
      await expect(
        authenticated.mutation(api.crm.queries.update, {
          destination: "Forbidden mutation",
          queryId: fixture.queryId,
        })
      ).rejects.toThrow("FORBIDDEN");
    }

    await t.run(async (ctx) => {
      expect((await ctx.db.get("queries", fixture.queryId))?.destination).toBe("Goa");
      expect(await ctx.db.query("activityLogs").collect()).toEqual([]);
    });
  });
});
