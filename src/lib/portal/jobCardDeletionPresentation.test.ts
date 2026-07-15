import { describe, expect, test } from "bun:test";
import {
  formatJobCardDeletionCount,
  humanizeJobCardDeletionStage,
} from "./jobCardDeletionPresentation";

describe("jobCardDeletionPresentation", () => {
  test("humanizes known cascade stages", () => {
    expect(humanizeJobCardDeletionStage("travellers")).toBe("Travellers");
    expect(humanizeJobCardDeletionStage("finishingDescendants")).toBe("Finishing cleanup");
    expect(humanizeJobCardDeletionStage("passportDetails")).toBe("Passport details");
  });

  test("formats deleted counts with singular and plural labels", () => {
    expect(formatJobCardDeletionCount(0)).toBe("0 records removed");
    expect(formatJobCardDeletionCount(1)).toBe("1 record removed");
    expect(formatJobCardDeletionCount(12)).toBe("12 records removed");
  });
});
