import { describe, expect, test } from "bun:test";
import { PortalValidationError, validateModalForm } from "./formValidation.js";

describe("validateModalForm", () => {
  test("rejects inverted travel dates on queries", () => {
    expect(() =>
      validateModalForm("query", {
        clientName: "Acme",
        paxCount: "2",
        travelEndDate: "2026-08-01",
        travelStartDate: "2026-08-10",
      })
    ).toThrow("Travel Date From must be on or before Travel Date To.");
  });

  test("rejects zero pax on queries", () => {
    let error;
    try {
      validateModalForm("query", {
        clientName: "Acme",
        paxCount: "0",
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(PortalValidationError);
    expect(error).toMatchObject({
      field: "paxCount",
      message: "Enter No. of Pax as 1 or more.",
    });
  });

  test("matches Query and Expense validation copy to visible field labels", () => {
    expect(() => validateModalForm("query", { clientName: "", paxCount: "2" })).toThrow(
      "Enter a Client / Company."
    );
    expect(() =>
      validateModalForm("expense", {
        cardAmount: "100",
        category: "",
        expenseDate: "2026-06-15",
        expenseType: "office",
        paidBy: "Staff",
      })
    ).toThrow("Select Category.");
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
    ).toThrow("Select Category.");
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

  test("rejects pricing-incomplete proposal handoff but allows draft proposal save", () => {
    expect(() =>
      validateModalForm("proposal", {
        airfarePerPax: "",
        landCostPerPax: "",
        queryIds: ["query_1"],
        sellingPrice: "",
        visaCostPerPax: "",
      })
    ).not.toThrow();

    expect(() =>
      validateModalForm("proposalHandoff", {
        costPrice: 0,
        sellingPrice: 100_000,
      })
    ).toThrow("Enter selling price and cost price on the proposal before sending it to Sales.");

    expect(() =>
      validateModalForm("proposalHandoff", {
        costPrice: 70_000,
        sellingPrice: 100_000,
      })
    ).not.toThrow();
  });

  test("rejects missing visible required fields across operational modals", () => {
    expect(() => validateModalForm("traveller", { fullName: "", jobCardId: "job_1" })).toThrow(
      "Traveller name is required."
    );
    expect(() => validateModalForm("seat", { jobCardId: "job_1", seatNumber: "" })).toThrow(
      "Seat number is required."
    );
    expect(() => validateModalForm("tourManager", { jobCardId: "job_1", staffId: "" })).toThrow(
      "Select a tour manager."
    );
    expect(() =>
      validateModalForm("tourManager", {
        jobCardId: "job_1",
        staffId: "",
        tourManagerName: "External TM",
      })
    ).not.toThrow();
    expect(() => validateModalForm("visa", { visaRecordId: "" })).toThrow("Select a visa record.");
    expect(() => validateModalForm("visa_create", { travellerId: "" })).toThrow(
      "Select a traveller."
    );
  });

  test("rejects missing visible required fields across finance and approval modals", () => {
    expect(() => validateModalForm("invoice", { invoiceNumber: "", jobCardId: "job_1" })).toThrow(
      "Invoice number is required."
    );
    expect(() =>
      validateModalForm("expense", {
        cardAmount: "100",
        category: "Miscellaneous",
        expenseDate: "2026-06-15",
        expenseType: "office",
        paidBy: "",
      })
    ).toThrow("Enter Paid By.");
    expect(() =>
      validateModalForm("approvalDecide", {
        approvalStatus: "Rejected",
        decisionNote: "",
      })
    ).toThrow("A decision note is required when rejecting or requesting details.");
    expect(() =>
      validateModalForm("approvalDecide", {
        approvalStatus: "Approved",
        decisionNote: "",
      })
    ).not.toThrow();
  });
});
