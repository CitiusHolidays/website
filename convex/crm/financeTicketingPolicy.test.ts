import { describe, expect, test } from "bun:test";
import { hasMaterialExpenseChange, splitTotal } from "./expenseMaterialIntegrity";
import { isTicketAttentionStatus, TICKET_ATTENTION_STATUSES } from "./ticketStatusPolicy";

describe("Finance and ticketing rules", () => {
  test("SplitTotal sums card, cash, and epay amounts", () => {
    expect(splitTotal({ cardAmount: 100, cashAmount: 50, epayAmount: 25 })).toBe(175);
    expect(splitTotal({})).toBe(0);
  });

  test("Material expense change detects category edits only when value changes", () => {
    const expense = { amount: 100, category: "Meals", paidBy: "Employee" };
    expect(hasMaterialExpenseChange(expense, { category: "Meals" })).toBe(false);
    expect(hasMaterialExpenseChange(expense, { category: "Lodging" })).toBe(true);
    expect(hasMaterialExpenseChange(expense, { notes: "updated" })).toBe(false);
  });

  test("Ticket attention statuses include refund-pending workflows", () => {
    expect(isTicketAttentionStatus("Refund Pending")).toBe(true);
    expect(isTicketAttentionStatus("Issued")).toBe(false);
    expect(TICKET_ATTENTION_STATUSES).toEqual([
      "Name Change Required",
      "Reissue Required",
      "Refund Pending",
    ]);
  });
});
