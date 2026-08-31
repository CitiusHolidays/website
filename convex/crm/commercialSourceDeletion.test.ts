import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import {
  assertCommercialSourceHasNoFileCustody,
  COMMERCIAL_SOURCE_DELETION_BLOCKED_MESSAGE,
} from "./commercialSourceCustody";

function context({
  finalizedPdf = false,
  legacyProposal = false,
  legacyQuery = false,
  registry = false,
} = {}) {
  const firstByTable = {
    commercialFiles: registry ? { _id: "commercialFiles_1" } : null,
    proposalAttachments: legacyProposal ? { _id: "proposalAttachments_1" } : null,
    queryAttachments: legacyQuery ? { _id: "queryAttachments_1" } : null,
  };
  const indexes: string[] = [];
  const db = {
    get: () =>
      Promise.resolve(
        finalizedPdf ? { finalizedPdfStorageId: "storage_1" } : { _id: "proposal_1" }
      ),
    normalizeId: (_table, id) => id,
    query: (table) => ({
      withIndex: (index, apply) => {
        indexes.push(`${table}.${index}`);
        const builder = { eq: () => builder };
        apply(builder);
        return { first: () => Promise.resolve(firstByTable[table]) };
      },
    }),
  };
  return { ctx: fromAny({ db }), indexes };
}

describe("Commercial File source hard-delete custody", () => {
  test("allows a source only when every indexed custody owner is empty", async () => {
    const { ctx, indexes } = context();

    await expect(assertCommercialSourceHasNoFileCustody(ctx, "query", "queries_1")).resolves.toBe(
      undefined
    );
    await expect(
      assertCommercialSourceHasNoFileCustody(ctx, "proposal", "proposals_1")
    ).resolves.toBe(undefined);
    await expect(
      assertCommercialSourceHasNoFileCustody(ctx, "jobCard", "jobCards_1")
    ).resolves.toBe(undefined);
    expect(indexes).toEqual([
      "commercialFiles.by_source",
      "queryAttachments.by_queryId",
      "commercialFiles.by_source",
      "proposalAttachments.by_proposalId",
      "commercialFiles.by_source",
    ]);
  });

  test("blocks canonical, legacy, and finalized Proposal Doc custody fail-closed", async () => {
    await Promise.all(
      (
        [
          ["jobCard", { registry: true }],
          ["query", { legacyQuery: true }],
          ["proposal", { legacyProposal: true }],
          ["proposal", { finalizedPdf: true }],
        ] as const
      ).map(async ([sourceType, options]) => {
        const { ctx } = context(options);
        await expect(
          assertCommercialSourceHasNoFileCustody(ctx, sourceType, `${sourceType}_1`)
        ).rejects.toThrow(COMMERCIAL_SOURCE_DELETION_BLOCKED_MESSAGE);
      })
    );
  });
});
