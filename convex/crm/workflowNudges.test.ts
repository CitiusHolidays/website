import { describe, expect, test } from "bun:test";
import { collectRiskItemsPage } from "./workflowNudges";

const referenceNow = Date.parse("2026-08-01T12:00:00.000Z");

describe("bounded workflow nudge pages", () => {
  test("uses the supplied clock and only probes the page's linked Job Cards", async () => {
    const queried: string[] = [];
    const ctx = {
      db: {
        query(table: string) {
          queried.push(table);
          return {
            withIndex(_name: string, callback: (q: { eq: () => unknown }) => unknown) {
              const q = { eq: () => q };
              callback(q);
              return { first: async () => null };
            },
          };
        },
      },
    };

    const risks = await collectRiskItemsPage(
      ctx,
      "queries",
      [
        {
          _id: "query_1",
          clientName: "A Traveller",
          contractingOwnerId: undefined,
          createdAt: referenceNow - 25 * 60 * 60 * 1000,
          queryCode: "Q-001",
          salesStatus: "Proposal in discussion",
        },
      ],
      referenceNow
    );

    expect(risks).toEqual([
      {
        body: "Q-001 has no Contracting SPOC after 24 hours.",
        entityId: "query_1",
        entityType: "query",
        ruleKey: "query_without_contracting_owner_after_24h",
        title: "Query needs Contracting SPOC",
      },
    ]);
    expect(queried).toEqual(["jobCards"]);
  });

  test("does not collect the entire CRM tables in the page evaluator", async () => {
    const source = await Bun.file(new URL("./workflowNudges.ts", import.meta.url)).text();
    expect(source).not.toContain('query("queries").collect()');
    expect(source).not.toContain('query("jobCards").collect()');
    expect(source).not.toContain('query("travellers").collect()');
    expect(source).not.toContain('query("tickets").collect()');
    expect(source).not.toContain('query("invoices").collect()');
  });
});
