"use client";

import type { ReactNode } from "react";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import { requestDocumentPreview } from "@/lib/portal/documentPreview";
import { isRuntimeObject, isRuntimeString } from "../../../lib/runtimeValues";
import type { ExpensesViewProps, ProposalsViewProps, QueriesViewProps } from "./portalViewTypes";

interface PortalGridRow {
  approxMargin?: number | null;
  contractingStatus?: string;
  salesStatus?: string;
}

const MAX_QUERY_NOTES_WORDS = 30;
const SERVER_ERROR_PATTERN = /server error called by client/i;
const WHITESPACE_PATTERN = /\s+/;

export function strong(value: ReactNode) {
  return <strong className="font-semibold">{value}</strong>;
}

export function money(value: number | string | null | undefined) {
  return `INR ${Number(value || 0).toLocaleString("en-IN")}`;
}

export function countWords(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(WHITESPACE_PATTERN).length;
}

export function truncateToMaxWords(value: string | null | undefined, maxWords: number) {
  const words = String(value || "")
    .trim()
    .split(WHITESPACE_PATTERN)
    .filter(Boolean);
  if (words.length <= maxWords) {
    return String(value ?? "");
  }
  return words.slice(0, maxWords).join(" ");
}

export function formatNotesPreview(
  value: string | null | undefined,
  maxWords = MAX_QUERY_NOTES_WORDS
) {
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

export function notesPreview(value: string | null | undefined) {
  return formatNotesPreview(value);
}

export function isQueryConfirmed(rowOrForm: PortalGridRow | null | undefined) {
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

export function openPortalFile(url: string) {
  return requestDocumentPreview({ sourceUrl: url });
}

export function openQueryAttachment(
  attachmentId: string,
  _getQueryAttachmentUrl:
    | ExpensesViewProps["getExpenseAttachmentUrl"]
    | ProposalsViewProps["getProposalAttachmentUrl"]
    | QueriesViewProps["getQueryAttachmentUrl"],
  kind: "expense" | "proposal" | "query" = "query"
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

export function openFinalizedProposalPdf(
  proposalId: string,
  _getFinalizedPdfUrl:
    | ProposalsViewProps["getFinalizedPdfUrl"]
    | QueriesViewProps["getFinalizedPdfUrl"]
) {
  return Promise.resolve().then(() => {
    openPortalFile(`/api/portal/files/proposal-finalized/${encodeURIComponent(proposalId)}`);
  });
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- This function is the parser at the caught-error I/O boundary and validates before reading fields.
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
