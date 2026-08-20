import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { RuntimeObject } from "../lib/runtimeValues";
import { createConfirmedOfferSnapshot } from "./confirmedOffer";

function makeConfirmedOfferCtx(existingOffer: RuntimeObject | null = null) {
  let inserted: RuntimeObject | null = null;
  const proposal = {
    _id: "proposals_1",
    proposalRevision: 3,
    queryId: "queries_1",
    status: "Sent",
    taxRate: 5,
  };
  const link = {
    _id: "proposalQueryLinks_1",
    handedOffRevision: 3,
    proposalId: "proposals_1",
    queryId: "queries_1",
  };
  const handoff = {
    _id: "proposalQueryHandoffs_1",
    airfarePerPax: 20_000,
    landCostPerPax: 45_000,
    proposalId: "proposals_1",
    proposalRevision: 3,
    queryId: "queries_1",
    sellingPrice: 80_000,
    taxRate: 5,
    visaCostPerPax: 3000,
  };
  const ctx = {
    db: {
      get: async (_table: string, id: string) => (id === "proposals_1" ? proposal : null),
      insert: (_table: string, doc: RuntimeObject) => {
        inserted = doc;
        return Promise.resolve("confirmedOffers_1");
      },
      normalizeId: (_table: string, id: string) => id,
      query: (table: string) => ({
        first: async () => (table === "confirmedOffers" ? existingOffer : null),
        unique: () => {
          if (table === "proposalQueryLinks") {
            return Promise.resolve(link);
          }
          if (table === "proposalQueryHandoffs") {
            return Promise.resolve(handoff);
          }
          return Promise.resolve(null);
        },
        withIndex() {
          return this;
        },
      }),
    },
  };
  return { ctx, inserted: () => inserted };
}

describe("Confirmed Offer snapshot", () => {
  test("Persists finalized per-person values and calculated profit without inventing margin", async () => {
    const { ctx, inserted } = makeConfirmedOfferCtx();

    const result = await createConfirmedOfferSnapshot(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      { authUserId: "auth_sales" },
      {
        confirmedAt: 1_786_123_456_000,
        confirmedPax: 18,
        destination: "Baku",
        proposalId: "proposals_1",
        proposalRevision: 3,
        queryId: "queries_1",
        source: "Citius Concierge",
        sourceConsentAt: 1_786_123_456_000,
        sourceInboundIntentId: "inboundQueryIntents_1",
        travelEndDate: "2026-10-08",
        travelStartDate: "2026-10-02",
      }
    );

    expect(result).toMatchObject({ offerId: "confirmedOffers_1", profitPerPax: 12_000 });
    expect(inserted()).toMatchObject({
      airfarePerPax: 20_000,
      confirmedPax: 18,
      landCostPerPax: 45_000,
      profitPerPax: 12_000,
      proposalQueryHandoffId: "proposalQueryHandoffs_1",
      proposalRevision: 3,
      sellingPricePerPax: 80_000,
      source: "Citius Concierge",
      sourceConsentAt: 1_786_123_456_000,
      sourceInboundIntentId: "inboundQueryIntents_1",
      visaCostPerPax: 3000,
    });
    expect(inserted()?.approxMargin).toBeUndefined();
  });

  test("Refuses to replace an existing immutable snapshot", async () => {
    const { ctx } = makeConfirmedOfferCtx({ _id: "confirmedOffers_existing" });

    await expect(
      createConfirmedOfferSnapshot(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        fromAny<never, unknown>(ctx),
        { authUserId: "auth_sales" },
        {
          confirmedAt: 1_786_123_456_000,
          confirmedPax: 18,
          proposalId: "proposals_1",
          proposalRevision: 3,
          queryId: "queries_1",
          travelStartDate: "2026-10-02",
        }
      )
    ).rejects.toThrow("This query already has a confirmed offer snapshot.");
  });

  test("Preserves Sacred Bharat attribution on the immutable snapshot", async () => {
    const { ctx, inserted } = makeConfirmedOfferCtx();

    await createConfirmedOfferSnapshot(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      { authUserId: "auth_sales" },
      {
        confirmedAt: 1_786_123_456_000,
        confirmedPax: 4,
        destination: "Shiva Trail",
        proposalId: "proposals_1",
        proposalRevision: 3,
        queryId: "queries_1",
        source: "Sacred Bharat",
        sourceConsentAt: 1_786_123_400_000,
        sourceInboundIntentId: "inboundQueryIntents_1",
        travelStartDate: "2026-11-01",
      }
    );

    expect(inserted()).toMatchObject({
      source: "Sacred Bharat",
      sourceConsentAt: 1_786_123_400_000,
      sourceInboundIntentId: "inboundQueryIntents_1",
    });
  });
});
