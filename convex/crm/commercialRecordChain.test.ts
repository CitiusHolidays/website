import { describe, expect, test } from "bun:test";
import {
  budgetOpportunityValue,
  dedupeCommercialChainFiles,
  isSensitiveCommercialAttachmentEntity,
  mapProposalCommercialFiles,
  mapQueryCommercialFiles,
  profitPerPerson,
} from "./commercialRecordChain";

describe("commercial record chain files", () => {
  test("maps query and proposal files with source metadata", () => {
    const queryFiles = mapQueryCommercialFiles(
      { _id: "queries_1" as never, queryCode: "Q-0001" },
      [
        {
          _id: "queryAttachments_1" as never,
          createdAt: 10,
          fileName: "itinerary.xlsx",
          fileSize: 1200,
          mimeType: "application/vnd.ms-excel",
          storageId: "storage_query" as never,
        },
      ],
      true
    );
    const proposalFiles = mapProposalCommercialFiles(
      {
        _id: "proposals_1" as never,
        finalizedPdfFileName: "proposal.pdf",
        finalizedPdfStorageId: "storage_pdf" as never,
        finalizedPdfUploadedAt: 20,
        proposalCode: "P-0001",
      },
      [
        {
          _id: "proposalAttachments_1" as never,
          createdAt: 15,
          fileName: "costing.xlsx",
          fileSize: 900,
          mimeType: "application/vnd.ms-excel",
          storageId: "storage_proposal" as never,
        },
      ],
      true
    );

    expect(queryFiles[0]).toMatchObject({
      fileName: "itinerary.xlsx",
      readOnly: true,
      sourceLabel: "Query Q-0001",
      sourceType: "query",
    });
    expect(proposalFiles).toHaveLength(2);
    expect(proposalFiles[1]).toMatchObject({
      fileKind: "proposalDoc",
      sourceLabel: "Proposal P-0001",
    });
  });

  test("dedupes one storage record across linked viewers", () => {
    const files = dedupeCommercialChainFiles([
      {
        attachmentId: "a1",
        createdAt: 1,
        fileKind: "attachment",
        fileName: "same.pdf",
        fileSize: 1,
        mimeType: "application/pdf",
        readOnly: true,
        sourceCode: "Q-0001",
        sourceId: "queries_1",
        sourceLabel: "Query Q-0001",
        sourceType: "query",
        storageId: "storage_1",
      },
      {
        attachmentId: "a2",
        createdAt: 2,
        fileKind: "attachment",
        fileName: "same.pdf",
        fileSize: 1,
        mimeType: "application/pdf",
        readOnly: true,
        sourceCode: "P-0001",
        sourceId: "proposals_1",
        sourceLabel: "Proposal P-0001",
        sourceType: "proposal",
        storageId: "storage_1",
      },
    ]);

    expect(files).toHaveLength(1);
  });

  test("flags sensitive attachment entity types", () => {
    expect(isSensitiveCommercialAttachmentEntity("passport")).toBe(true);
    expect(isSensitiveCommercialAttachmentEntity("visa")).toBe(true);
    expect(isSensitiveCommercialAttachmentEntity("query")).toBe(false);
  });
});

describe("commercial pricing helpers", () => {
  test("calculates opportunity value from budget per person and pax", () => {
    expect(budgetOpportunityValue(25_000, 10)).toBe(250_000);
  });

  test("calculates pre-tax profit per person", () => {
    expect(
      profitPerPerson({
        airfarePerPax: 8000,
        landCostPerPax: 12_000,
        sellingPricePerPax: 25_000,
        visaCostPerPax: 1500,
      })
    ).toBe(3500);
  });
});
