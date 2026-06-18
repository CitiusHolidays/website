import { describe, expect, test } from "bun:test";
import { applyQueryLink, applyStaffLink } from "./entityModalLinks";

describe("entityModalLinks", () => {
  test("autofills proposal costs from linked query costing", () => {
    expect(
      applyQueryLink(
        {},
        {
          id: "query_1",
          clientName: "Acme",
          paxCount: 12,
          contractingLandCost: 1000,
          contractingAirlinesCost: 500,
          contractingVisaCost: 125,
        },
      ),
    ).toMatchObject({
      queryId: "query_1",
      clientName: "Acme",
      paxCount: "12",
      landCostPerPax: "1000",
      airfarePerPax: "500",
      visaCostPerPax: "125",
    });
  });

  test("keeps tour manager staff id and contact fields together", () => {
    expect(
      applyStaffLink(
        "staff_1",
        { name: "Nisha Shah", email: "nisha@example.com", mobile: "9999999999" },
        "tourManager",
      ),
    ).toEqual({
      staffId: "staff_1",
      tourManagerName: "Nisha Shah",
      staffEmail: "nisha@example.com",
      paidBy: "9999999999",
    });
  });
});
