import { describe, expect, test } from "bun:test";
import {
  canonicalTravelBatchSummary,
  travelBatchCountFromSummaries,
  travelBatchSummaryVariant,
} from "./travelBatchSummary";

describe("Travel Batch summary transition", () => {
  test("normalizes inventoried legacy aliases", () => {
    expect(canonicalTravelBatchSummary({ code: "B03", pax: 18, reference: "JC-1 / B03" })).toEqual({
      batchCode: "B03",
      batchReference: "JC-1 / B03",
      confirmedPax: 18,
    });
    expect(travelBatchSummaryVariant({ code: "B03" })).toBe("legacy-alias");
  });

  test("derives the monotonic counter from canonical and legacy summaries", () => {
    expect(travelBatchCountFromSummaries([{ batchCode: "B02" }, { code: "B11" }])).toBe(11);
  });

  test("ignores malformed legacy codes without decreasing an existing counter", () => {
    expect(travelBatchCountFromSummaries([{ batchCode: "Batch 4" }, { code: "" }])).toBe(0);
  });
});
