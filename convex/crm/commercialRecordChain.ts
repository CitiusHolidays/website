import type { Id } from "../_generated/dataModel";

export type CommercialFileSourceType = "query" | "proposal";

export interface CommercialChainFile {
  attachmentId: string;
  createdAt: number;
  fileKind: "attachment" | "proposalDoc";
  fileName: string;
  fileSize: number;
  mimeType: string;
  readOnly: boolean;
  sourceCode: string;
  sourceId: string;
  sourceLabel: string;
  sourceType: CommercialFileSourceType;
  storageId: string;
}

const SENSITIVE_ATTACHMENT_ENTITY_TYPES = new Set([
  "expense",
  "finance",
  "hr",
  "leave",
  "passport",
  "visa",
]);

export function isSensitiveCommercialAttachmentEntity(entityType?: string | null) {
  return SENSITIVE_ATTACHMENT_ENTITY_TYPES.has(
    String(entityType ?? "")
      .trim()
      .toLowerCase()
  );
}

export function dedupeCommercialChainFiles(files: CommercialChainFile[]) {
  const seen = new Set<string>();
  const unique: CommercialChainFile[] = [];
  for (const file of files) {
    const key = file.storageId;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(file);
  }
  return unique.sort((left, right) => right.createdAt - left.createdAt);
}

interface QueryAttachmentRow {
  _id: Id<"queryAttachments">;
  createdAt: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageId: Id<"_storage">;
}

interface ProposalAttachmentRow {
  _id: Id<"proposalAttachments">;
  createdAt: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageId: Id<"_storage">;
}

interface ProposalRow {
  _id: Id<"proposals">;
  finalizedPdfFileName?: string;
  finalizedPdfStorageId?: Id<"_storage">;
  finalizedPdfUploadedAt?: number;
  proposalCode: string;
}

interface QueryRow {
  _id: Id<"queries">;
  queryCode: string;
}

export function mapQueryCommercialFiles(
  query: QueryRow,
  attachments: QueryAttachmentRow[],
  readOnly: boolean
): CommercialChainFile[] {
  return attachments.map((attachment) => ({
    attachmentId: String(attachment._id),
    createdAt: attachment.createdAt,
    fileKind: "attachment",
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
    readOnly,
    sourceCode: query.queryCode,
    sourceId: String(query._id),
    sourceLabel: `Query ${query.queryCode}`,
    sourceType: "query",
    storageId: String(attachment.storageId),
  }));
}

export function mapProposalCommercialFiles(
  proposal: ProposalRow,
  attachments: ProposalAttachmentRow[],
  readOnly: boolean
): CommercialChainFile[] {
  const rows: CommercialChainFile[] = attachments.map((attachment) => ({
    attachmentId: String(attachment._id),
    createdAt: attachment.createdAt,
    fileKind: "attachment",
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
    readOnly,
    sourceCode: proposal.proposalCode,
    sourceId: String(proposal._id),
    sourceLabel: `Proposal ${proposal.proposalCode}`,
    sourceType: "proposal",
    storageId: String(attachment.storageId),
  }));

  if (proposal.finalizedPdfStorageId && proposal.finalizedPdfFileName) {
    rows.push({
      attachmentId: `proposal-doc:${proposal._id}`,
      createdAt: proposal.finalizedPdfUploadedAt ?? 0,
      fileKind: "proposalDoc",
      fileName: proposal.finalizedPdfFileName,
      fileSize: 0,
      mimeType: "application/pdf",
      readOnly,
      sourceCode: proposal.proposalCode,
      sourceId: String(proposal._id),
      sourceLabel: `Proposal ${proposal.proposalCode}`,
      sourceType: "proposal",
      storageId: String(proposal.finalizedPdfStorageId),
    });
  }

  return rows;
}

export function budgetOpportunityValue(budgetPerPerson: number, paxCount: number) {
  const budget = Math.max(Number(budgetPerPerson) || 0, 0);
  const pax = Math.max(Number(paxCount) || 0, 0);
  return budget * pax;
}

export function profitPerPerson({
  sellingPricePerPax,
  landCostPerPax,
  airfarePerPax,
  visaCostPerPax,
}: {
  sellingPricePerPax: number;
  landCostPerPax: number;
  airfarePerPax: number;
  visaCostPerPax: number;
}) {
  const selling = Math.max(Number(sellingPricePerPax) || 0, 0);
  const costs =
    Math.max(Number(landCostPerPax) || 0, 0) +
    Math.max(Number(airfarePerPax) || 0, 0) +
    Math.max(Number(visaCostPerPax) || 0, 0);
  return selling - costs;
}
