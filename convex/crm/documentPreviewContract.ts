import { type Infer, v } from "convex/values";

export const DOCUMENT_PREVIEW_SOURCE_TYPES = [
  "commercialFile",
  "expenseAttachment",
  "passport",
  "proposalAttachment",
  "proposalDocument",
  "queryAttachment",
] as const;

export type DocumentPreviewSourceType = (typeof DOCUMENT_PREVIEW_SOURCE_TYPES)[number];

export const documentPreviewSourceTypeValidator = v.union(
  v.literal(DOCUMENT_PREVIEW_SOURCE_TYPES[0]),
  v.literal(DOCUMENT_PREVIEW_SOURCE_TYPES[1]),
  v.literal(DOCUMENT_PREVIEW_SOURCE_TYPES[2]),
  v.literal(DOCUMENT_PREVIEW_SOURCE_TYPES[3]),
  v.literal(DOCUMENT_PREVIEW_SOURCE_TYPES[4]),
  v.literal(DOCUMENT_PREVIEW_SOURCE_TYPES[5])
);

export const documentPreviewKindValidator = v.union(
  v.literal("image"),
  v.literal("pdf"),
  v.literal("presentation"),
  v.literal("spreadsheet"),
  v.literal("text"),
  v.literal("unsupported"),
  v.literal("word")
);
export type DocumentPreviewKind = Infer<typeof documentPreviewKindValidator>;

export const documentPreviewOperationKindValidator = v.union(
  v.literal("presentation"),
  v.literal("spreadsheet"),
  v.literal("word")
);
export type DocumentPreviewOperationKind = Infer<typeof documentPreviewOperationKindValidator>;

export const documentPreviewErrorCodeValidator = v.union(
  v.literal("conversion_failed"),
  v.literal("corrupt"),
  v.literal("encrypted"),
  v.literal("expansion_limit"),
  v.literal("processing_timeout"),
  v.literal("resource_limit"),
  v.literal("signature_mismatch"),
  v.literal("unsafe_content"),
  v.literal("unsupported_format"),
  v.literal("worker_unavailable")
);
export type DocumentPreviewErrorCode = Infer<typeof documentPreviewErrorCodeValidator>;

export const documentPreviewStatusResultValidator = v.object({
  canRetry: v.boolean(),
  errorCode: v.union(documentPreviewErrorCodeValidator, v.null()),
  fileName: v.string(),
  generation: v.number(),
  mimeType: v.string(),
  pageCount: v.union(v.number(), v.null()),
  previewKind: documentPreviewKindValidator,
  sheetCount: v.union(v.number(), v.null()),
  sourceId: v.string(),
  sourceType: documentPreviewSourceTypeValidator,
  status: v.union(v.literal("preparing"), v.literal("ready"), v.literal("unavailable")),
  warningCodes: v.array(v.string()),
});
export type DocumentPreviewStatusResult = Infer<typeof documentPreviewStatusResultValidator>;

export const documentPreviewFileResultValidator = v.union(
  v.object({
    deliveryToken: v.string(),
    expiresAt: v.number(),
    fileName: v.string(),
    generation: v.number(),
    mimeType: v.string(),
    previewKind: documentPreviewKindValidator,
    status: v.literal("ready"),
    warningCodes: v.array(v.string()),
  }),
  v.object({
    generation: v.number(),
    previewKind: documentPreviewKindValidator,
    status: v.literal("preparing"),
  }),
  v.object({
    canRetry: v.boolean(),
    errorCode: documentPreviewErrorCodeValidator,
    generation: v.number(),
    previewKind: documentPreviewKindValidator,
    status: v.literal("unavailable"),
  })
);
export type DocumentPreviewFileResult = Infer<typeof documentPreviewFileResultValidator>;

export const DOCUMENT_PREVIEW_WARNING_CODES = new Set([
  "embedded_content_omitted",
  "external_content_omitted",
  "formula_not_recalculated",
  "unsupported_content_omitted",
]);

const RETRYABLE_ERRORS = new Set<DocumentPreviewErrorCode>([
  "conversion_failed",
  "processing_timeout",
  "worker_unavailable",
]);

export function canRetryDocumentPreview(errorCode?: DocumentPreviewErrorCode) {
  return Boolean(errorCode && RETRYABLE_ERRORS.has(errorCode));
}

function normalizedExtension(fileName: string) {
  return fileName.trim().toLowerCase().split(".").pop() ?? "";
}

export function classifyDocumentPreview(fileName: string, mimeType: string): DocumentPreviewKind {
  const [mime] = mimeType.trim().toLowerCase().split(";", 1);
  const extension = normalizedExtension(fileName);
  if (mime === "application/pdf" || extension === "pdf") {
    return "pdf";
  }
  if (
    ["image/gif", "image/jpeg", "image/png", "image/webp"].includes(mime) ||
    ["gif", "jpeg", "jpg", "png", "webp"].includes(extension)
  ) {
    return "image";
  }
  if (mime === "text/plain" || extension === "txt") {
    return "text";
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    return "word";
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    extension === "pptx"
  ) {
    return "presentation";
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    extension === "xlsx"
  ) {
    return "spreadsheet";
  }
  return "unsupported";
}

export function isNativeDocumentPreview(kind: DocumentPreviewKind) {
  return kind === "pdf" || kind === "image" || kind === "text";
}

export function isOfficeDocumentPreview(
  kind: DocumentPreviewKind
): kind is DocumentPreviewOperationKind {
  return kind === "word" || kind === "presentation" || kind === "spreadsheet";
}

export function normalizeDocumentPreviewWarnings(warnings: string[]) {
  return Array.from(
    new Set(warnings.filter((warning) => DOCUMENT_PREVIEW_WARNING_CODES.has(warning)))
  ).slice(0, 16);
}

export function documentPreviewSizeBand(size: number) {
  const megabyte = 1024 * 1024;
  if (size < megabyte) {
    return "under_1mb" as const;
  }
  if (size < 5 * megabyte) {
    return "1mb_to_5mb" as const;
  }
  if (size < 10 * megabyte) {
    return "5mb_to_10mb" as const;
  }
  if (size <= 15 * megabyte) {
    return "10mb_to_15mb" as const;
  }
  return "over_15mb" as const;
}
