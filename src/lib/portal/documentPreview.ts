export const DOCUMENT_PREVIEW_EVENT = "citius:document-preview";

declare global {
  interface WindowEventMap {
    "citius:document-preview": CustomEvent<DocumentPreviewRequest>;
  }
}

export type DocumentPreviewKind =
  | "pdf"
  | "image"
  | "text"
  | "docx"
  | "xlsx"
  | "pptx"
  | "unsupported";

export interface DocumentPreviewRequest {
  fileName?: string;
  historyMode?: "none" | "push" | "replace";
  mimeType?: string;
  navigation?: {
    currentIndex: number;
    items: Array<{
      fileName?: string;
      mimeType?: string;
      sourceUrl: string;
    }>;
  };
  sourceUrl: string;
}

const PORTAL_FILE_ROUTE_PREFIX = "/api/portal/files/";
const FILE_NAME_STAR_PATTERN = /filename\*=UTF-8''([^;]+)/i;
const FILE_NAME_PATTERN = /filename="?([^";]+)"?/i;
const FILE_EXTENSION_PATTERN = /\.[^.]+$/;
const SAFE_IMAGE_MIME_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);
const OFFICE_EXTENSIONS = new Set([".docx", ".pptx", ".xlsx"]);

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

function rolloutStage(): DocumentPreviewRolloutStage {
  const configured = process.env.NEXT_PUBLIC_DOCUMENT_PREVIEW_ROLLOUT_STAGE?.trim().toLowerCase();
  if (!configured) {
    return "all";
  }
  if (isDocumentPreviewRolloutStage(configured)) {
    return configured;
  }
  return "off";
}

function rolloutRank(stage = rolloutStage()) {
  return DOCUMENT_PREVIEW_ROLLOUT_STAGES.indexOf(stage);
}

function portalFileUrl(sourceUrl: string) {
  const raw = String(sourceUrl || "").trim();
  if (!(raw.startsWith(PORTAL_FILE_ROUTE_PREFIX) && !raw.startsWith("//"))) {
    throw new Error("Document preview only supports private portal file routes.");
  }
  return new URL(raw, "https://citius.invalid");
}

export function portalFilePreviewUrl(sourceUrl: string) {
  const url = portalFileUrl(sourceUrl);
  url.searchParams.set("mode", "preview");
  return `${url.pathname}${url.search}`;
}

export function portalFileDownloadUrl(sourceUrl: string) {
  const url = portalFileUrl(sourceUrl);
  url.searchParams.delete("mode");
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

export function isSensitivePortalFileUrl(sourceUrl: string) {
  try {
    const { pathname } = portalFileUrl(sourceUrl);
    return (
      pathname.startsWith(`${PORTAL_FILE_ROUTE_PREFIX}passport/`) ||
      pathname.startsWith(`${PORTAL_FILE_ROUTE_PREFIX}visa/`)
    );
  } catch {
    return false;
  }
}

export function documentPreviewRolloutAllows(request: DocumentPreviewRequest) {
  const rank = rolloutRank();
  if (rank < 1) {
    return false;
  }
  const { pathname } = portalFileUrl(request.sourceUrl);
  if (pathname.startsWith(`${PORTAL_FILE_ROUTE_PREFIX}commercial/`)) {
    const kind = classifyDocumentPreview(request);
    if (kind === "unsupported") {
      const hasFormatMetadata = Boolean(request.fileName || request.mimeType);
      return !hasFormatMetadata && rank >= 2;
    }
    const extension = extensionFor(request.fileName || "");
    return !OFFICE_EXTENSIONS.has(extension) || rank >= 2;
  }
  if (
    pathname.startsWith(`${PORTAL_FILE_ROUTE_PREFIX}query/`) ||
    pathname.startsWith(`${PORTAL_FILE_ROUTE_PREFIX}proposal/`) ||
    pathname.startsWith(`${PORTAL_FILE_ROUTE_PREFIX}proposal-finalized/`)
  ) {
    return rank >= 3;
  }
  if (
    pathname.startsWith(`${PORTAL_FILE_ROUTE_PREFIX}passport/`) ||
    pathname.startsWith(`${PORTAL_FILE_ROUTE_PREFIX}visa/`)
  ) {
    return rank >= 4;
  }
  if (pathname.startsWith(`${PORTAL_FILE_ROUTE_PREFIX}expense/`)) {
    return rank >= 5;
  }
  return false;
}

function extensionFor(fileName: string) {
  const match = FILE_EXTENSION_PATTERN.exec(fileName.trim().toLowerCase());
  return match?.[0] ?? "";
}

export function classifyDocumentPreview({
  fileName,
  mimeType,
}: {
  fileName?: string;
  mimeType?: string;
}): DocumentPreviewKind {
  const extension = extensionFor(fileName || "");
  const normalizedMime = String(mimeType || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (extension === ".pdf" || normalizedMime === "application/pdf") {
    return "pdf";
  }
  if (normalizedMime.startsWith("image/") && !SAFE_IMAGE_MIME_TYPES.has(normalizedMime)) {
    return "unsupported";
  }
  if (
    [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension) ||
    SAFE_IMAGE_MIME_TYPES.has(normalizedMime)
  ) {
    return "image";
  }
  if (extension === ".txt" || normalizedMime === "text/plain") {
    return "text";
  }
  if (extension === ".docx") {
    return "docx";
  }
  if (extension === ".xlsx") {
    return "xlsx";
  }
  if (extension === ".pptx") {
    return "pptx";
  }
  return "unsupported";
}

export function fileNameFromContentDisposition(header: string | null) {
  if (!header) {
    return null;
  }
  const encoded = FILE_NAME_STAR_PATTERN.exec(header)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim());
    } catch {
      // Fall through to the non-encoded filename.
    }
  }
  return FILE_NAME_PATTERN.exec(header)?.[1]?.trim() ?? null;
}

export function requestDocumentPreview(request: DocumentPreviewRequest) {
  portalFileUrl(request.sourceUrl);
  if (!documentPreviewRolloutAllows(request)) {
    window.location.assign(portalFileDownloadUrl(request.sourceUrl));
    return false;
  }
  return window.dispatchEvent(
    new CustomEvent<DocumentPreviewRequest>(DOCUMENT_PREVIEW_EVENT, { detail: request })
  );
}
