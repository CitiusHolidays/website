import { describe, expect, test } from "bun:test";
import { publicJobCard } from "./lib";

const legacyJob = {
  _id: "jobCards_legacy",
  clientName: "Legacy Client",
  confirmedPax: 10,
  createdAt: 1,
  jobCode: "JC-0001-LC",
  status: "Open",
  updatedAt: 2,
};

describe("publicJobCard legacy Ticketing presentation", () => {
  test("derives Not required from the linked query when the Job Card predates scope fields", () => {
    expect(publicJobCard(legacyJob, { ticketingScope: "Not required" })).toMatchObject({
      ticketingRequired: false,
      ticketingScope: "Not required",
    });
  });

  test("derives required work and preserves an explicit stored override", () => {
    expect(publicJobCard(legacyJob, { ticketingScope: "Both" }).ticketingRequired).toBe(true);
    expect(
      publicJobCard(
        { ...legacyJob, ticketingRequired: false, ticketingScope: "Both" },
        { ticketingScope: "Both" }
      ).ticketingRequired
    ).toBe(false);
  });
});
