import { describe, expect, test } from "bun:test";
import { validateModalForm } from "./formValidation.js";

describe("validateModalForm", () => {
  test("rejects inverted travel dates on queries", () => {
    expect(() =>
      validateModalForm("query", {
        clientName: "Acme",
        paxCount: "2",
        travelStartDate: "2026-08-10",
        travelEndDate: "2026-08-01",
      }),
    ).toThrow("Travel start date must be on or before Travel end date.");
  });

  test("rejects zero pax on queries", () => {
    expect(() =>
      validateModalForm("query", {
        clientName: "Acme",
        paxCount: "0",
      }),
    ).toThrow("Pax count must be at least 1.");
  });

  test("rejects inverted leave dates", () => {
    expect(() =>
      validateModalForm("leave_create", {
        startDate: "2026-08-10",
        endDate: "2026-08-01",
        reason: "Trip",
      }),
    ).toThrow("Leave start date must be on or before Leave end date.");
  });

  test("requires lost reason when marking order lost", () => {
    expect(() =>
      validateModalForm("salesDecision", {
        queryId: "query_1",
        salesDecision: "Order Lost",
        lostReason: "",
      }),
    ).toThrow("Select a lost reason.");
  });
});
