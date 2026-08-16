import { describe, expect, test } from "bun:test";
import type { Id } from "../_generated/dataModel";
import {
  buildProposalAttachmentPreview,
  compareProposalAttachmentsDescending,
} from "./proposalAttachmentSummary";

function attachment(id: string, createdAt: number) {
  return {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    _id: id as Id<"proposalAttachments">,
    createdAt,
    fileName: `${id}.pdf`,
    fileSize: 10,
    mimeType: "application/pdf",
  };
}

describe("Proposal attachment summary ordering", () => {
  test("orders by createdAt descending and id descending for equal timestamps", () => {
    const rows = [
      attachment("attachment-a", 100),
      attachment("attachment-c", 100),
      attachment("attachment-b", 100),
      attachment("attachment-newer", 101),
    ];

    expect(rows.sort(compareProposalAttachmentsDescending).map((row) => row._id)).toEqual([
      "attachment-newer",
      "attachment-c",
      "attachment-b",
      "attachment-a",
    ]);
  });

  test("deduplicates accumulated pages and keeps only the canonical newest three", () => {
    const preview = buildProposalAttachmentPreview([
      attachment("attachment-a", 100),
      attachment("attachment-d", 100),
      attachment("attachment-c", 100),
      attachment("attachment-b", 100),
      attachment("attachment-d", 100),
      attachment("attachment-older", 99),
    ]);

    expect(preview.map((row) => row.id)).toEqual(["attachment-d", "attachment-c", "attachment-b"]);
  });
});
