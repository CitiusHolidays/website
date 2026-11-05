import { renderTransactionalEmail } from "../lib/transactionalEmail";

type EmailDetails = {
  title: string;
  rows: Array<{ label: string; value: string }>;
} | null;

const PORTAL_ONLY_DETAIL_LABELS = new Set([
  "Budget per Person",
  "Cost price / pax",
  "Decision note",
  "File",
  "Itinerary summary",
  "Notes",
  "Passport last four",
  "Reason",
]);

// Email is a portable copy. Keep private documents, reasons and commercial notes
// behind the portal's current authorization checks instead of copying them out.
export function notificationEmailSummaryDetails(
  details: EmailDetails,
  entityType?: string
): EmailDetails {
  if (!details) {
    return null;
  }
  return {
    ...details,
    rows: details.rows.filter(
      (row) =>
        (entityType === "inboundQueryIntent" && row.label === "Notes") ||
        !PORTAL_ONLY_DETAIL_LABELS.has(row.label)
    ),
  };
}

export function renderNotificationEmail(args: {
  title: string;
  body: string;
  href: string;
  details: EmailDetails;
}) {
  return renderTransactionalEmail({
    action: { href: args.href, label: "Open in Citius Connect" },
    context: "Citius Connect · Staff workspace",
    details: args.details,
    footer: "Citius Connect · Sign in to view the current record.",
    paragraphs: [args.body],
    title: args.title,
  });
}
