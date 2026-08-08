import { describe, expect, test } from "bun:test";
import { assertValidExpenseLifecycle, normalizeExpenseLifecycle } from "./expenseLifecycle";

describe("expense approval and reimbursement lifecycle", () => {
  test("accepts only coherent approval and reimbursement combinations", () => {
    for (const [approvalStatus, reimbursementStatus] of [
      ["Pending", "Not Submitted"],
      ["Pending", "Pending"],
      ["Approved", "Pending"],
      ["Approved", "Reimbursed"],
      ["Rejected", "Not Submitted"],
    ] as const) {
      expect(() => assertValidExpenseLifecycle(approvalStatus, reimbursementStatus)).not.toThrow();
    }

    for (const [approvalStatus, reimbursementStatus] of [
      ["Pending", "Reimbursed"],
      ["Approved", "Not Submitted"],
      ["Rejected", "Pending"],
      ["Rejected", "Reimbursed"],
    ] as const) {
      expect(() => assertValidExpenseLifecycle(approvalStatus, reimbursementStatus)).toThrow(
        "Invalid expense lifecycle"
      );
    }
  });

  test("normalizes inconsistent stored rows deterministically", () => {
    expect(normalizeExpenseLifecycle("Pending", "Reimbursed")).toEqual({
      approvalStatus: "Pending",
      reimbursementStatus: "Pending",
    });
    expect(normalizeExpenseLifecycle("Approved", "Not Submitted")).toEqual({
      approvalStatus: "Approved",
      reimbursementStatus: "Pending",
    });
    expect(normalizeExpenseLifecycle("Rejected", "Reimbursed")).toEqual({
      approvalStatus: "Rejected",
      reimbursementStatus: "Not Submitted",
    });
  });
});
