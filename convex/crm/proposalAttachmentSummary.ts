import type { Doc, Id } from "../_generated/dataModel";

export const PROPOSAL_ATTACHMENT_SUMMARY_VERSION = 1;
export const PROPOSAL_ATTACHMENT_PREVIEW_LIMIT = 3;

export type ProposalAttachmentPreview = NonNullable<Doc<"proposals">["attachmentPreview"]>[number];

export interface ProposalAttachmentSummarySource {
  _id?: Id<"proposalAttachments">;
  createdAt: number;
  fileName: string;
  fileSize: number;
  id?: Id<"proposalAttachments">;
  mimeType: string;
}

function attachmentId(row: ProposalAttachmentSummarySource) {
  const id = row._id ?? row.id;
  if (!id) {
    throw new Error("Proposal attachment summary source is missing its id");
  }
  return id;
}

export function compareProposalAttachmentsDescending(
  left: ProposalAttachmentSummarySource,
  right: ProposalAttachmentSummarySource
) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt - left.createdAt;
  }
  const leftId = String(attachmentId(left));
  const rightId = String(attachmentId(right));
  if (leftId === rightId) {
    return 0;
  }
  return leftId > rightId ? -1 : 1;
}

export function buildProposalAttachmentPreview(
  rows: readonly ProposalAttachmentSummarySource[]
): ProposalAttachmentPreview[] {
  const unique = new Map<string, ProposalAttachmentSummarySource>();
  for (const row of rows) {
    unique.set(String(attachmentId(row)), row);
  }
  return Array.from(unique.values())
    .sort(compareProposalAttachmentsDescending)
    .slice(0, PROPOSAL_ATTACHMENT_PREVIEW_LIMIT)
    .map((row) => ({
      createdAt: row.createdAt,
      fileName: row.fileName,
      fileSize: row.fileSize,
      id: attachmentId(row),
      mimeType: row.mimeType,
    }));
}

export function isProposalAttachmentSummaryReady(
  proposal:
    | Pick<
        Doc<"proposals">,
        | "attachmentCount"
        | "attachmentPreview"
        | "attachmentSummaryState"
        | "attachmentSummaryVersion"
      >
    | null
    | undefined
) {
  return Boolean(
    proposal &&
      proposal.attachmentSummaryState === "ready" &&
      proposal.attachmentSummaryVersion === PROPOSAL_ATTACHMENT_SUMMARY_VERSION &&
      proposal.attachmentCount !== undefined &&
      proposal.attachmentPreview !== undefined
  );
}
