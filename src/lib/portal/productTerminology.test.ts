import { describe, expect, test } from "bun:test";
import { SALES_DECISION_OPTIONS } from "./constants.js";
import { displayPortalTerm } from "./productTerminology";

describe("Portal product terminology", () => {
  test("Presents the four Sales Decision labels without changing stored values", () => {
    expect(SALES_DECISION_OPTIONS).toEqual([
      { label: "Under Discussion", value: "Proposal in discussion" },
      {
        label: "Date/Destination Change Required",
        value: "Date/Destination Change Required",
      },
      { label: "Order Confirmed", value: "Order Confirmed" },
      { label: "Order Lost", value: "Order Lost" },
    ]);
  });

  test("Adapts only the legacy Proposal in discussion display literal", () => {
    expect(displayPortalTerm("Proposal in discussion")).toBe("Under Discussion");
    expect(displayPortalTerm("Order Confirmed")).toBe("Order Confirmed");
    expect(displayPortalTerm(null)).toBe("");
  });
});
