import { describe, expect, test } from "bun:test";
import { createConfirmedOfferSnapshot } from "./confirmedOffer";

function makeConfirmedOfferCtx(existingOffer: Record<string, unknown> | null = null) {
  let inserted: Record<string, unknown> | null = null;
  const proposal = {
    _id: "proposals_1",
    queryId: "queries_1",
    status: "Sent",
    taxRate: 5,
  };
  const ctx = {
    db: {
      get: async (id: string) => (id === "proposals_1" ? proposal : null),
      insert: (_table: string, doc: Record<string, unknown>) => {
        inserted = doc;
        return Promise.resolve("confirmedOffers_1");
      },
      normalizeId: (_table: string, id: string) => id,
      query: (table: string) => ({
        first: async () => (table === "confirmedOffers" ? existingOffer : null),
        withIndex() {
          return this;
        },
      }),
    },
  };
  return { ctx, inserted: () => inserted };
}

describe("Confirmed Offer snapshot", () => {
  test("persists finalized per-person values and calculated profit without inventing margin", async () => {
    const { ctx, inserted } = makeConfirmedOfferCtx();

    const result = await createConfirmedOfferSnapshot(
      ctx as never,
      { authUserId: "auth_sales" },
      {
        airfarePerPax: 20_000,
        confirmedPax: 18,
        destination: "Baku",
        landCostPerPax: 45_000,
        proposalId: "proposals_1",
        queryId: "queries_1",
        sellingPricePerPax: 80_000,
        travelEndDate: "2026-10-08",
        travelStartDate: "2026-10-02",
        visaCostPerPax: 3000,
      }
    );

    expect(result).toMatchObject({ offerId: "confirmedOffers_1", profitPerPax: 12_000 });
    expect(inserted()).toMatchObject({
      airfarePerPax: 20_000,
      confirmedPax: 18,
      landCostPerPax: 45_000,
      profitPerPax: 12_000,
      sellingPricePerPax: 80_000,
      visaCostPerPax: 3000,
    });
    expect(inserted()?.approxMargin).toBeUndefined();
  });

  test("refuses to replace an existing immutable snapshot", async () => {
    const { ctx } = makeConfirmedOfferCtx({ _id: "confirmedOffers_existing" });

    await expect(
      createConfirmedOfferSnapshot(
        ctx as never,
        { authUserId: "auth_sales" },
        {
          airfarePerPax: 20_000,
          confirmedPax: 18,
          landCostPerPax: 45_000,
          proposalId: "proposals_1",
          queryId: "queries_1",
          sellingPricePerPax: 80_000,
          travelStartDate: "2026-10-02",
          visaCostPerPax: 3000,
        }
      )
    ).rejects.toThrow("This query already has a confirmed offer snapshot.");
  });
});
