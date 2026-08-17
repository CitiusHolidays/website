import { ConvexError } from "convex/values";
import type { DocumentPreviewKind, DocumentPreviewSourceType } from "./documentPreviewContract";

export const DOCUMENT_PREVIEW_ROLLOUT_STAGES = [
  "off",
  "commercial-native",
  "commercial-office",
  "commercial-chain",
  "sensitive",
  "all",
] as const;

export type DocumentPreviewRolloutStage = (typeof DOCUMENT_PREVIEW_ROLLOUT_STAGES)[number];

function isDocumentPreviewRolloutStage(value: string): value is DocumentPreviewRolloutStage {
  return DOCUMENT_PREVIEW_ROLLOUT_STAGES.some((stage) => stage === value);
}

export function documentPreviewRolloutStage(
  configured = process.env.DOCUMENT_PREVIEW_ROLLOUT_STAGE
): DocumentPreviewRolloutStage {
  const normalized = configured?.trim().toLowerCase();
  return normalized !== undefined && isDocumentPreviewRolloutStage(normalized) ? normalized : "off";
}

export function isDocumentPreviewRolloutAllowed(
  sourceType: DocumentPreviewSourceType,
  previewKind: DocumentPreviewKind,
  stage = documentPreviewRolloutStage()
) {
  if (stage === "off") {
    return false;
  }
  if (previewKind === "unsupported") {
    return false;
  }
  const native = previewKind === "pdf" || previewKind === "image" || previewKind === "text";
  if (stage === "commercial-native") {
    return sourceType === "commercialFile" && native;
  }
  if (stage === "commercial-office") {
    return sourceType === "commercialFile";
  }
  if (stage === "commercial-chain") {
    return (
      sourceType === "commercialFile" ||
      sourceType === "proposalAttachment" ||
      sourceType === "proposalDocument" ||
      sourceType === "queryAttachment"
    );
  }
  if (stage === "sensitive") {
    return sourceType !== "expenseAttachment";
  }
  return true;
}

export function assertDocumentPreviewRolloutAllowed(
  sourceType: DocumentPreviewSourceType,
  previewKind: DocumentPreviewKind
) {
  if (!isDocumentPreviewRolloutAllowed(sourceType, previewKind)) {
    throw new ConvexError("DOCUMENT_PREVIEW_DISABLED");
  }
}
