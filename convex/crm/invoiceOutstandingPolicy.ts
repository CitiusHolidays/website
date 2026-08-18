export const INVOICE_OUTSTANDING_PROJECTION_KEY = "invoices.outstanding.v1" as const;
export const INVOICE_OUTSTANDING_PROJECTION_VERSION = 1;

export function hasOutstandingInvoiceBalance(balanceAmount: number) {
  return balanceAmount > 0;
}

export function invoiceOutstandingProjectionMismatch(invoice: {
  balanceAmount: number;
  hasOutstandingBalance?: boolean;
}) {
  return invoice.hasOutstandingBalance !== hasOutstandingInvoiceBalance(invoice.balanceAmount);
}

export function isInvoiceOutstandingProjectionReady(
  state: {
    ready: boolean;
    residuals: number;
    stage: "backfill" | "verify" | "complete";
    status: "running" | "complete" | "failed";
    version: number;
  } | null
) {
  return Boolean(
    state?.ready &&
      state.status === "complete" &&
      state.stage === "complete" &&
      state.residuals === 0 &&
      state.version === INVOICE_OUTSTANDING_PROJECTION_VERSION
  );
}
