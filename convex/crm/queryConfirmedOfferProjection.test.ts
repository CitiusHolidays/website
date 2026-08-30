import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { Doc } from "../_generated/dataModel";
import { projectConfirmedOfferForJobCardOpening } from "./queryReads";

const OFFER = fromAny<Doc<"confirmedOffers">, unknown>({
  _creationTime: 1,
  _id: "confirmedOffers_1",
  airfarePerPax: 20_000,
  confirmedPax: 18,
  createdAt: 1,
  createdBy: "auth_sales",
  destination: "Baku",
  landCostPerPax: 45_000,
  profitPerPax: 12_000,
  proposalId: "proposals_1",
  proposalQueryHandoffId: "proposalQueryHandoffs_1",
  proposalRevision: 2,
  queryId: "queries_1",
  sellingPricePerPax: 80_000,
  travelEndDate: "2026-10-08",
  travelStartDate: "2026-10-02",
  updatedAt: 1,
  visaCostPerPax: 3000,
});

function handoff(overrides: Partial<Doc<"proposalQueryHandoffs">> = {}) {
  return fromAny<Doc<"proposalQueryHandoffs">, unknown>({
    _creationTime: 1,
    _id: "proposalQueryHandoffs_1",
    airfarePerPax: 20_000,
    clientName: " Acme Snapshot ",
    commandId: "command",
    costPrice: 68_000,
    handedOffAt: 1,
    handedOffBy: "auth_contracting",
    itinerarySummary: "",
    landCostPerPax: 45_000,
    proposalCode: "P-0001",
    proposalId: "proposals_1",
    proposalRevision: 2,
    queryId: "queries_1",
    sellingPrice: 80_000,
    visaCostPerPax: 3000,
    ...overrides,
  });
}

describe("Confirmed Offer Job Card opening projection", () => {
  test("advertises ready authority only for the exact nonblank handoff", () => {
    expect(projectConfirmedOfferForJobCardOpening(OFFER, handoff(), "queries_1")).toMatchObject({
      clientName: "Acme Snapshot",
      proposalQueryHandoffId: "proposalQueryHandoffs_1",
      proposalRevision: 2,
    });
  });

  test("fails closed when handoff identity, revision, query, or client evidence is inexact", () => {
    for (const candidate of [
      null,
      handoff({ _id: "proposalQueryHandoffs_other" }),
      handoff({ proposalId: "proposals_other" }),
      handoff({ proposalRevision: 3 }),
      handoff({ queryId: "queries_other" }),
      handoff({ clientName: "   " }),
    ]) {
      expect(projectConfirmedOfferForJobCardOpening(OFFER, candidate, "queries_1")).toMatchObject({
        clientName: "",
        proposalQueryHandoffId: null,
        proposalRevision: null,
      });
    }
  });
});
