import type { PortalGridAttention } from "./portalDataGrid";

interface InvoiceAttentionInput {
  balanceAmount?: number;
  dueDate?: string | null;
}

export function invoiceDueDatePresentation(value: string | null | undefined): {
  display: string;
  sortValue: string | null;
} {
  const iso = String(value || "").slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return {
    display: match ? `${match[3]}/${match[2]}/${match[1]}` : "—",
    sortValue: match ? iso : null,
  };
}

export function getInvoiceAttention(
  invoice: InvoiceAttentionInput,
  todayIso = new Date().toISOString().slice(0, 10)
): PortalGridAttention | undefined {
  if (!(Number(invoice.balanceAmount) > 0)) {
    return;
  }
  const due = invoiceDueDatePresentation(invoice.dueDate);
  if (due.sortValue && due.sortValue < todayIso) {
    return { label: `Overdue — due ${due.display}`, tone: "danger" };
  }
  return { label: `Outstanding balance — due ${due.display}`, tone: "warning" };
}
