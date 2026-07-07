import { describe, expect, test } from "bun:test";
import {
  getExpenseSplitTotal,
  getPaymentTermForQueryType,
  getPipelineBuckets,
  getPipelineStage,
  isTicketComplete,
  isValidTicketStatus,
  isValidVisaStatus,
  isVisaComplete,
} from "./workflow";

describe("portal workflow helpers", () => {
  test("uses workbook payment terms by query type", () => {
    expect(getPaymentTermForQueryType("Spiritual")).toEqual({
      maxAdvancePercent: 100,
      minAdvancePercent: 100,
    });
    expect(getPaymentTermForQueryType("B2B")).toEqual({
      maxAdvancePercent: 100,
      minAdvancePercent: 80,
    });
  });

  test("maps query statuses into pipeline stages", () => {
    expect(getPipelineStage({ contractingStatus: "Proposal sent" })).toBe("Proposal sent");
    expect(getPipelineStage({ contractingStatus: "Date/Destination Change Required" })).toBe(
      "Date/Destination Change Required"
    );
    expect(getPipelineStage({ salesStatus: "Order Confirmed" })).toBe("Order Confirmed");
    expect(getPipelineStage({ salesStatus: "Order Lost" })).toBe("Order Lost");
  });

  test("builds pipeline buckets", () => {
    const buckets = getPipelineBuckets([
      { contractingStatus: "Query Received", id: "q1" },
      { contractingStatus: "Proposal sent", id: "q2" },
      { id: "q3", salesStatus: "Order Confirmed" },
      { contractingStatus: "Date/Destination Change Required", id: "q4" },
    ]);

    expect(buckets["Query Received"]).toHaveLength(1);
    expect(buckets["Proposal sent"]).toHaveLength(1);
    expect(buckets["Order Confirmed"]).toHaveLength(1);
    expect(buckets["Date/Destination Change Required"]).toHaveLength(1);
  });

  test("validates terminal ticket and visa statuses", () => {
    expect(isValidVisaStatus("Approved")).toBe(true);
    expect(isVisaComplete("Approved")).toBe(true);
    expect(isValidTicketStatus("Issued")).toBe(true);
    expect(isTicketComplete("Issued")).toBe(true);
  });

  test("computes expense total from card cash and e-pay amounts", () => {
    expect(
      getExpenseSplitTotal({ cardAmount: "1000", cashAmount: "250", epayAmount: "99.5" })
    ).toBe(1349.5);
    expect(getExpenseSplitTotal({ cardAmount: "", cashAmount: null, epayAmount: undefined })).toBe(
      0
    );
  });
});
