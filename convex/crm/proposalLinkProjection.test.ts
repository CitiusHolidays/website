import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Doc, Id } from "../_generated/dataModel";
import { proposalLinkedQuerySummary } from "./proposalLinkProjection";

const NORMALIZED_OWNER_FIELDS = [
  "contractingOwnerNameNormalized",
  "salesOwnerNameNormalized",
  "ticketingOwnerNameNormalized",
] as const;

function queryFixture(): Doc<"queries"> {
  return {
    _creationTime: 1,
    // SAFETY: This test controls the asserted value at the framework boundary below.
    _id: "query_fixture" as Id<"queries">,
    clientName: "Example Client",
    contractingOwnerId: "contracting_staff",
    contractingOwnerName: "Example Contracting",
    contractingStatus: "Query Received",
    createdAt: 1,
    createdBy: "issuer|sales_staff",
    destination: "Example Destination",
    leadStage: "Proposal",
    listSearchText: "Example Client",
    paxCount: 2,
    queryCode: "Q-0001",
    queryType: "MICE",
    salesOwnerId: "sales_staff",
    salesOwnerName: "Example Sales",
    salesStatus: "Proposal in discussion",
    ticketingOwnerId: "ticketing_staff",
    ticketingOwnerName: "Example Ticketing",
    ticketingScope: "Both",
    travelEndDate: "2026-10-09",
    travelStartDate: "2026-10-03",
    travelType: "International Travel",
    updatedAt: 1,
  };
}

describe("Proposal linked-query projection schema", () => {
  test("accepts every normalized owner field written into linkedQueryPreview", () => {
    const preview = proposalLinkedQuerySummary([queryFixture()]).linkedQueryPreview[0];
    const schemaSource = readFileSync(new URL("../schema.ts", import.meta.url), "utf8");
    const previewValidator = schemaSource.match(
      /linkedQueryPreview:[\s\S]*?linkedQueryProjection:/
    )?.[0];

    expect(previewValidator).toBeDefined();
    for (const field of NORMALIZED_OWNER_FIELDS) {
      expect(preview[field]).toBeString();
      expect(previewValidator, field).toContain(`${field}: v.optional(v.string())`);
    }
  });
});
