"use client";

type PortalGridRow = {
  approxMargin?: number | null;
  contractingStatus?: string;
  salesStatus?: string;
};

const MAX_QUERY_NOTES_WORDS = 30;

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
  return trimmed.split(/\s+/).length;
}

export function truncateToMaxWords(value: any, maxWords: any) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
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
  const words = text.split(/\s+/).filter(Boolean);
  const display = words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : text;
  return (
    <span
      className="block max-w-[220px] whitespace-normal break-words text-brand-muted text-xs leading-snug"
      title={text}
    >
      {display}
    </span>
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
  if (!isQueryConfirmed(row) || row.approxMargin == null) {
    return "-";
  }
  return money(row.approxMargin);
}

export function openPortalFile(url: any) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

export function openQueryAttachment(
  attachmentId: any,
  getQueryAttachmentUrl: any,
  kind: any = "query"
) {
  void getQueryAttachmentUrl;
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

export function openFinalizedProposalPdf(proposalId: any, getFinalizedPdfUrl: any) {
  void getFinalizedPdfUrl;
  return Promise.resolve().then(() => {
    openPortalFile(`/api/portal/files/proposal-finalized/${encodeURIComponent(proposalId)}`);
  });
}

export function formatConvexError(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback;
  }
  const record = error as { data?: unknown; message?: string };
  if (typeof record.data === "string" && record.data.trim()) {
    return record.data;
  }
  if (record.message && !/server error called by client/i.test(record.message)) {
    return record.message;
  }
  return fallback;
}
