import { describe, expect, test } from "bun:test";
import { validateModalForm } from "./formValidation.js";

describe("validateModalForm", () => {
  test("rejects inverted travel dates on queries", () => {
    expect(() =>
      validateModalForm("query", {
        clientName: "Acme",
        paxCount: "2",
        travelEndDate: "2026-08-01",
        travelStartDate: "2026-08-10",
      })
    ).toThrow("Travel start date must be on or before Travel end date.");
  });

  test("rejects zero pax on queries", () => {
    expect(() =>
      validateModalForm("query", {
        clientName: "Acme",
        paxCount: "0",
      })
    ).toThrow("Pax count must be at least 1.");
  });

  test("rejects inverted leave dates", () => {
    expect(() =>
      validateModalForm("leave_create", {
        endDate: "2026-08-01",
        reason: "Trip",
        startDate: "2026-08-10",
      })
    ).toThrow("Leave start date must be on or before Leave end date.");
  });

  test("requires lost reason when marking order lost", () => {
    expect(() =>
      validateModalForm("salesDecision", {
        lostReason: "",
        queryId: "query_1",
        salesDecision: "Order Lost",
      })
    ).toThrow("Select a lost reason.");
  });

  test("requires expense category selection", () => {
    expect(() =>
      validateModalForm("expense", {
        cardAmount: "100",
        category: "",
        expenseDate: "2026-06-15",
        expenseType: "office",
        paidBy: "Staff",
      })
    ).toThrow("Select a category.");
  });

  test("office expenses do not require a job card", () => {
    expect(() =>
      validateModalForm("expense", {
        cardAmount: "100",
        category: "Miscellaneous",
        expenseDate: "2026-06-15",
        expenseType: "office",
        jobCardId: "",
        paidBy: "Staff",
      })
    ).not.toThrow();
  });
});
