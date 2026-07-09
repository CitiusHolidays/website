import { describe, expect, test } from "bun:test";
import { buildTravelBatchModalInitial, formatTravelBatchOwnerSummary } from "./workspaceContract";

describe("workspaceContract travel batches", () => {
  test("buildTravelBatchModalInitial maps batch identity and operational fields", () => {
    expect(
      buildTravelBatchModalInitial({
        batch: {
          batchReference: "JC-0001-NS / B01",
          confirmedPax: 10,
          contractingOwnerId: "staff_1",
          contractingOwnerName: "Contracting",
          destination: "Dubai",
          id: "batch_1",
          jobCardId: "job_1",
          operationsOwnerId: "staff_2",
          operationsOwnerName: "Operations",
          roomCount: 5,
          status: "Open",
          ticketingOwnerId: "staff_3",
          ticketingOwnerName: "Ticketing",
          tourManagerName: "TM",
          travelEndDate: "2026-08-08",
          travelStartDate: "2026-08-01",
        },
      })
    ).toMatchObject({
      batchReference: "JC-0001-NS / B01",
      confirmedPax: "10",
      contractingOwnerName: "Contracting",
      destination: "Dubai",
      entityId: "batch_1",
      roomCount: "5",
      tourManagerName: "TM",
    });
  });

  test("formatTravelBatchOwnerSummary joins assigned SPOCs", () => {
    expect(
      formatTravelBatchOwnerSummary({
        contractingOwnerName: "A",
        operationsOwnerName: "B",
        ticketingOwnerName: "",
      })
    ).toBe("A · B");
    expect(formatTravelBatchOwnerSummary({})).toBe("Unassigned");
  });
});
