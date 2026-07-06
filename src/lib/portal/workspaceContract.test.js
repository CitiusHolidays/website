import { describe, expect, test } from "bun:test";
import {
  buildTravelBatchModalInitial,
  formatTravelBatchOwnerSummary,
} from "./workspaceContract.js";

describe("workspaceContract travel batches", () => {
  test("buildTravelBatchModalInitial maps batch identity and operational fields", () => {
    expect(
      buildTravelBatchModalInitial({
        batch: {
          id: "batch_1",
          jobCardId: "job_1",
          batchReference: "JC-0001-NS / B01",
          destination: "Dubai",
          confirmedPax: 10,
          roomCount: 5,
          travelStartDate: "2026-08-01",
          travelEndDate: "2026-08-08",
          contractingOwnerId: "staff_1",
          contractingOwnerName: "Contracting",
          operationsOwnerId: "staff_2",
          operationsOwnerName: "Operations",
          ticketingOwnerId: "staff_3",
          ticketingOwnerName: "Ticketing",
          tourManagerName: "TM",
          status: "Open",
        },
      }),
    ).toMatchObject({
      entityId: "batch_1",
      batchReference: "JC-0001-NS / B01",
      destination: "Dubai",
      confirmedPax: "10",
      roomCount: "5",
      contractingOwnerName: "Contracting",
      tourManagerName: "TM",
    });
  });

  test("formatTravelBatchOwnerSummary joins assigned SPOCs", () => {
    expect(
      formatTravelBatchOwnerSummary({
        contractingOwnerName: "A",
        operationsOwnerName: "B",
        ticketingOwnerName: "",
      }),
    ).toBe("A · B");
    expect(formatTravelBatchOwnerSummary({})).toBe("Unassigned");
  });
});
