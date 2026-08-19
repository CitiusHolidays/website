"use client";

import { PortalTooltip } from "@/components/portal/PortalTooltip";
import { requestDocumentPreview } from "@/lib/portal/documentPreview";
import { isRuntimeObject, isRuntimeString } from "../../../lib/runtimeValues";

interface PortalGridRow {
  approxMargin?: number | null;
  contractingStatus?: string;
  salesStatus?: string;
}

const MAX_QUERY_NOTES_WORDS = 30;
const SERVER_ERROR_PATTERN = /server error called by client/i;
const WHITESPACE_PATTERN = /\s+/;

export function strong(value: any) {
  return <strong className="font-semibold">{value}</strong>;
}

export function money(value: any) {
  return `INR ${Number(value || 0).toLocaleString("en-IN")}`;
}

export function countWords(value: any) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(WHITESPACE_PATTERN).length;
}

export function truncateToMaxWords(value: any, maxWords: any) {
  const words = String(value || "")
    .trim()
    .split(WHITESPACE_PATTERN)
    .filter(Boolean);
  if (words.length <= maxWords) {
    return value;
  }
  return words.slice(0, maxWords).join(" ");
}

export function formatNotesPreview(value: any, maxWords: any = MAX_QUERY_NOTES_WORDS) {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }
  const words = text.split(WHITESPACE_PATTERN).filter(Boolean);
  const display = words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : text;
  return (
    <PortalTooltip content={text}>
      <span className="block max-w-[220px] whitespace-normal break-words text-brand-muted text-xs leading-snug">
        {display}
      </span>
    </PortalTooltip>
  );
}

export function notesPreview(value: any) {
  return formatNotesPreview(value);
}

export function isQueryConfirmed(rowOrForm: any) {
  return (
    rowOrForm?.salesStatus === "Order Confirmed" ||
    rowOrForm?.contractingStatus === "Order Confirmed"
  );
}

export function approximateMarginLabel(row: PortalGridRow) {
  if (!isQueryConfirmed(row) || row.approxMargin === null) {
    return "-";
  }
  return money(row.approxMargin);
}

export function openPortalFile(url: any) {
  return requestDocumentPreview({ sourceUrl: String(url) });
}

export function openQueryAttachment(
  attachmentId: any,
  _getQueryAttachmentUrl: any,
  kind: any = "query"
) {
  let routeKind = "query";
  if (kind === "proposal") {
    routeKind = "proposal";
  } else if (kind === "expense") {
    routeKind = "expense";
  }
  return Promise.resolve().then(() => {
    openPortalFile(`/api/portal/files/${routeKind}/${encodeURIComponent(attachmentId)}`);
  });
}

export function openFinalizedProposalPdf(proposalId: any, _getFinalizedPdfUrl: any) {
  return Promise.resolve().then(() => {
    openPortalFile(`/api/portal/files/proposal-finalized/${encodeURIComponent(proposalId)}`);
  });
}

export function formatConvexError(cause: unknown, fallback: string) {
  if (!(cause && isRuntimeObject(cause))) {
    return fallback;
  }
  const data = "data" in cause ? cause.data : undefined;
  const message = "message" in cause ? cause.message : undefined;
  if (isRuntimeString(data) && data.trim()) {
    return data;
  }
  if (isRuntimeString(message) && !SERVER_ERROR_PATTERN.test(message)) {
    return message;
  }
  return fallback;
}
