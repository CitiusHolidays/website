import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const FIXED_NOW = new Date("2026-08-30T12:00:00.000Z").getTime();
const ACTOR = "auth_palette_search";

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

describe("command palette authorized record search", () => {
  test("finds authorized indexed records beyond the twelve-row recent shortcut window", async () => {
    const t = createHarness();
    const fixture = await t.run(async (ctx) => {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `https://auth.citius.test|${ACTOR}`,
        createdAt: FIXED_NOW,
        legacyAuthUserId: ACTOR,
        status: "linked",
        updatedAt: FIXED_NOW,
      });
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: ACTOR,
        createdAt: FIXED_NOW,
        email: "palette-search@citius-e2e.test",
        emailNormalized: "palette-search@citius-e2e.test",
        name: "Palette Search Director",
        roles: ["Directors"],
        updatedAt: FIXED_NOW,
      });
      for (const table of ["queries", "jobCards"] as const) {
        await ctx.db.insert("crmListSearchReadiness", {
          generation: 1,
          ready: true,
          reconciling: false,
          table,
          updatedAt: FIXED_NOW,
          version: 2,
        });
      }
      for (let index = 0; index < 40; index += 1) {
        await ctx.db.insert("queries", {
          clientName: `Recent distractor ${index}`,
          contractingStatus: "Proposal in progress",
          createdAt: FIXED_NOW + index,
          createdBy: ACTOR,
          leadStage: "Proposal",
          listSearchText: `recent distractor ${index}`,
          paxCount: 2,
          queryCode: `Q-DISTRACTOR-${index}`,
          queryType: "FIT",
          salesStatus: "Proposal in discussion",
          travelType: "Domestic Travel",
          updatedAt: FIXED_NOW + index,
        });
        await ctx.db.insert("jobCards", {
          clientName: `Recent job distractor ${index}`,
          confirmedPax: 2,
          createdAt: FIXED_NOW + index,
          createdBy: ACTOR,
          jobCode: `JC-DISTRACTOR-${index}`,
          listSearchText: `recent job distractor ${index}`,
          status: "Open",
          updatedAt: FIXED_NOW + index,
        });
      }
      const queryId = await ctx.db.insert("queries", {
        clientName: "Needle Heritage Client",
        contractingStatus: "Proposal in progress",
        createdAt: FIXED_NOW - 10_000,
        createdBy: ACTOR,
        destination: "Kōyasan",
        leadStage: "Proposal",
        listSearchText: "needle heritage client koyasan",
        paxCount: 4,
        queryCode: "Q-NEEDLE-OLDER",
        queryType: "FIT",
        salesStatus: "Proposal in discussion",
        travelType: "International Travel",
        updatedAt: FIXED_NOW - 10_000,
      });
      const jobCardId = await ctx.db.insert("jobCards", {
        clientName: "Needle Heritage Traveller",
        confirmedPax: 4,
        createdAt: FIXED_NOW - 10_000,
        createdBy: ACTOR,
        destination: "Kyoto",
        jobCode: "JC-NEEDLE-OLDER",
        listSearchText: "needle heritage traveller kyoto",
        status: "Open",
        updatedAt: FIXED_NOW - 10_000,
      });
      return { jobCardId, queryId };
    });
    const asDirector = t.withIdentity({
      email: "palette-search@citius-e2e.test",
      issuer: "https://auth.citius.test",
      subject: ACTOR,
      tokenIdentifier: `https://auth.citius.test|${ACTOR}`,
    });

    const [queries, jobCards] = await Promise.all([
      asDirector.query(api.crm.queries.listPage, {
        paginationOpts: { cursor: null, numItems: 12 },
        search: "needle",
      }),
      asDirector.query(api.crm.jobCards.listPage, {
        paginationOpts: { cursor: null, numItems: 12 },
        search: "needle",
      }),
    ]);

    expect(queries.page.map((row) => row.id)).toEqual([fixture.queryId]);
    expect(jobCards.page.map((row) => row.id)).toEqual([fixture.jobCardId]);
    expect(queries.page[0]?.clientName).toBe("Needle Heritage Client");
    expect(jobCards.page[0]?.clientName).toBe("Needle Heritage Traveller");
  });
});
