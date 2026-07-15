import { describe, expect, test } from "bun:test";
import { getInvoiceAttention, invoiceDueDatePresentation } from "./invoiceListPresentation";

describe("invoice list presentation", () => {
  test("separates DD/MM/YYYY display from ISO sorting", () => {
    expect(invoiceDueDatePresentation("2026-07-09")).toEqual({
      display: "09/07/2026",
      sortValue: "2026-07-09",
    });
    expect(invoiceDueDatePresentation("")).toEqual({ display: "—", sortValue: null });
  });

  test("classifies overdue and outstanding balances with semantic copy", () => {
    expect(
      getInvoiceAttention({ balanceAmount: 5000, dueDate: "2026-07-09" }, "2026-07-13")
    ).toEqual({ label: "Overdue — due 09/07/2026", tone: "danger" });
    expect(
      getInvoiceAttention({ balanceAmount: 5000, dueDate: "2026-07-20" }, "2026-07-13")
    ).toEqual({ label: "Outstanding balance — due 20/07/2026", tone: "warning" });
    expect(
      getInvoiceAttention({ balanceAmount: 0, dueDate: "2026-07-09" }, "2026-07-13")
    ).toBeUndefined();
  });
});
