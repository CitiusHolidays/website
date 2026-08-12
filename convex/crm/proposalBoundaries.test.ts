import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const lineCount = (source: string) => source.trimEnd().split("\n").length;

describe("Proposal entry and focused module boundaries", () => {
  test("keeps the public Proposal facade under 400 lines", () => {
    expect(lineCount(read("./proposals.ts"))).toBeLessThanOrEqual(400);
  });

  test("keeps every focused Proposal domain module under 500 lines", () => {
    for (const path of [
      "./proposalDocumentState.ts",
      "./proposalHandoffCommands.ts",
      "./proposalLinkProjection.ts",
      "./proposalReads.ts",
      "./proposalRelationSummary.ts",
      "./proposalRelations.ts",
      "./proposalVisibility.ts",
      "./proposalWriteCommands.ts",
      "./queryCommercialProjection.ts",
    ]) {
      expect(lineCount(read(path)), path).toBeLessThanOrEqual(500);
    }
  });

  test("keeps stable public registrations in the Proposal facade", () => {
    const source = read("./proposals.ts");
    for (const name of [
      "listPage",
      "getListRow",
      "getDetail",
      "listLinkedQueriesPage",
      "create",
      "update",
      "markSent",
      "sendToSales",
      "markAccepted",
      "remove",
      "addCollaborator",
      "removeCollaborator",
      "saveFinalizedPdf",
      "clearFinalizedPdf",
      "getFinalizedPdfRecord",
    ]) {
      expect(source, name).toContain(`export const ${name} =`);
    }
  });
});
