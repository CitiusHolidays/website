import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  hasMaterialExpenseChange,
  MATERIAL_EXPENSE_FIELDS,
  splitTotal,
} from "./expenseMaterialIntegrity";
import { canApproveExpenseAsManager } from "./expenseScope";
import * as finance from "./finance";
import {
  canApproveExpenseAsManager as facadeCanApproveExpenseAsManager,
  hasMaterialExpenseChange as facadeHasMaterialExpenseChange,
  MATERIAL_EXPENSE_FIELDS as facadeMaterialExpenseFields,
  splitTotal as facadeSplitTotal,
} from "./finance";
import * as ticketing from "./ticketing";
import {
  isTicketAttentionStatus as facadeIsTicketAttentionStatus,
  TICKET_ATTENTION_STATUSES as facadeTicketAttentionStatuses,
} from "./ticketing";
import { isTicketAttentionStatus, TICKET_ATTENTION_STATUSES } from "./ticketStatusPolicy";

const FINANCE_PUBLIC_EXPORTS = [
  "listInvoices",
  "createInvoice",
  "updateInvoice",
  "removeInvoice",
  "listExpenses",
  "createExpense",
  "updateExpense",
  "getFinanceOverview",
  "submitExpenseForApproval",
  "decideExpenseManager",
  "decideExpenseFinance",
  "updateExpenseStatus",
  "removeExpense",
] as const;

const TICKETING_PUBLIC_EXPORTS = [
  "dashboard",
  "listPnrs",
  "createPnr",
  "updatePnr",
  "listTickets",
  "createTicket",
  "updateTicket",
  "updateTicketStatus",
  "removeTicket",
  "removeManyTickets",
  "listSeatAllocations",
  "saveSeatAllocation",
  "updateSeatAllocation",
  "removePnr",
  "removeManyPnrs",
  "assignTicketingOwner",
  "removeSeatAllocation",
  "removeManySeatAllocations",
] as const;

const FINANCE_FOCUSED_MODULE_PATHS = [
  "./jobCardVisibility.ts",
  "./financeValidators.ts",
  "./expenseMaterialIntegrity.ts",
  "./expenseScope.ts",
  "./invoiceReads.ts",
  "./invoiceCommands.ts",
  "./expenseReads.ts",
  "./expenseCommands.ts",
  "./expenseApprovalWorkflow.ts",
  "./financeOverviewReads.ts",
] as const;

const TICKETING_FOCUSED_MODULE_PATHS = [
  "./ticketingValidators.ts",
  "./ticketingPresentation.ts",
  "./ticketingDashboardReads.ts",
  "./pnrReads.ts",
  "./pnrCommands.ts",
  "./pnrCleanup.ts",
  "./ticketStatusPolicy.ts",
  "./ticketReads.ts",
  "./ticketCommands.ts",
  "./seatReads.ts",
  "./seatCommands.ts",
  "./ticketingAssignmentPolicy.ts",
] as const;

describe("finance/ticketing entry API parity", () => {
  test("finance entry re-exports every stable public Convex function", () => {
    for (const exportName of FINANCE_PUBLIC_EXPORTS) {
      expect(finance).toHaveProperty(exportName);
      expect((finance as Record<string, unknown>)[exportName]).toBeDefined();
    }
  });

  test("ticketing entry re-exports every stable public Convex function", () => {
    for (const exportName of TICKETING_PUBLIC_EXPORTS) {
      expect(ticketing).toHaveProperty(exportName);
      expect((ticketing as Record<string, unknown>)[exportName]).toBeDefined();
    }
  });

  test("entry modules stay within the documented line budget", async () => {
    for (const path of ["./finance.ts", "./ticketing.ts"] as const) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      expect(source.split("\n").length).toBeLessThanOrEqual(500);
    }
  });

  test("focused finance modules stay under 500 lines each", async () => {
    for (const path of FINANCE_FOCUSED_MODULE_PATHS) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      expect(source.split("\n").length).toBeLessThanOrEqual(500);
    }
  });

  test("focused ticketing modules stay under 500 lines each", async () => {
    for (const path of TICKETING_FOCUSED_MODULE_PATHS) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      expect(source.split("\n").length).toBeLessThanOrEqual(500);
    }
  });
});

describe("finance/ticketing policy parity", () => {
  test("finance facade re-exports material integrity helpers from focused modules", () => {
    expect(facadeHasMaterialExpenseChange).toBe(hasMaterialExpenseChange);
    expect(facadeMaterialExpenseFields).toBe(MATERIAL_EXPENSE_FIELDS);
    expect(facadeSplitTotal).toBe(splitTotal);
    expect(facadeCanApproveExpenseAsManager).toBe(canApproveExpenseAsManager);
  });

  test("splitTotal sums card, cash, and epay amounts", () => {
    expect(splitTotal({ cardAmount: 100, cashAmount: 50, epayAmount: 25 })).toBe(175);
    expect(splitTotal({})).toBe(0);
  });

  test("material expense change detects category edits only when value changes", () => {
    const expense = { amount: 100, category: "Meals", paidBy: "Employee" };
    expect(hasMaterialExpenseChange(expense, { category: "Meals" })).toBe(false);
    expect(hasMaterialExpenseChange(expense, { category: "Lodging" })).toBe(true);
    expect(hasMaterialExpenseChange(expense, { notes: "updated" })).toBe(false);
  });

  test("ticketing facade re-exports ticket status policy helpers from focused modules", () => {
    expect(facadeIsTicketAttentionStatus).toBe(isTicketAttentionStatus);
    expect(facadeTicketAttentionStatuses).toBe(TICKET_ATTENTION_STATUSES);
  });

  test("ticket attention statuses include refund-pending workflows", () => {
    expect(isTicketAttentionStatus("Refund Pending")).toBe(true);
    expect(isTicketAttentionStatus("Issued")).toBe(false);
    expect(TICKET_ATTENTION_STATUSES).toEqual([
      "Name Change Required",
      "Reissue Required",
      "Refund Pending",
    ]);
  });
});
