import { describe, expect, test } from "bun:test";
import {
  applyJobCardLink,
  applyQueryLink,
  applyStaffLink,
  reconcileTravelBatchSelection,
  travelBatchSelectOptions,
} from "./entityModalLinks";

describe("entityModalLinks", () => {
  test("autofills proposal costs from linked query costing", () => {
    expect(
      applyQueryLink(
        {},
        {
          clientName: "Acme",
          contractingAirlinesCost: 500,
          contractingLandCost: 1000,
          contractingVisaCost: 125,
          id: "query_1",
          paxCount: 12,
        }
      )
    ).toMatchObject({
      airfarePerPax: "500",
      clientName: "Acme",
      landCostPerPax: "1000",
      paxCount: "12",
      queryId: "query_1",
      visaCostPerPax: "125",
    });
  });

  test("autofills travel batch operational fields from linked job card", () => {
    expect(
      applyJobCardLink(
        {},
        {
          confirmedPax: 10,
          contractingOwnerId: "staff_1",
          contractingOwnerName: "Contracting",
          destination: "Dubai",
          id: "job_1",
          operationsOwnerId: "staff_2",
          operationsOwnerName: "Operations",
          roomCount: 5,
          status: "In Operations",
          ticketingOwnerId: "staff_3",
          ticketingOwnerName: "Ticketing",
          tourManagerName: "TM",
          travelEndDate: "2026-08-08",
          travelStartDate: "2026-08-01",
        },
        "travelBatch"
      )
    ).toMatchObject({
      confirmedPax: "10",
      contractingOwnerId: "staff_1",
      contractingOwnerName: "Contracting",
      destination: "Dubai",
      jobCardId: "job_1",
      operationsOwnerId: "staff_2",
      operationsOwnerName: "Operations",
      roomCount: "5",
      status: "In Operations",
      ticketingOwnerId: "staff_3",
      ticketingOwnerName: "Ticketing",
      tourManagerName: "TM",
      travelEndDate: "2026-08-08",
      travelStartDate: "2026-08-01",
    });
  });

  test("keeps tour manager staff id and contact fields together", () => {
    expect(
      applyStaffLink(
        "staff_1",
        { email: "nisha@example.com", mobile: "9999999999", name: "Nisha Shah" },
        "tourManager"
      )
    ).toEqual({
      paidBy: "9999999999",
      staffEmail: "nisha@example.com",
      staffId: "staff_1",
      tourManagerName: "Nisha Shah",
    });
  });

  test("clears stale travel batch when job card changes", () => {
    const jobCards = [
      {
        id: "job_1",
        travelBatches: [{ batchReference: "JC-0001 / B01", id: "batch_1" }],
      },
      { id: "job_2", travelBatches: [] },
    ];
    expect(
      reconcileTravelBatchSelection({ jobCardId: "job_2", travelBatchId: "batch_1" }, jobCards)
    ).toEqual({ travelBatchId: "" });
  });

  test("builds travel batch select options for the selected job card", () => {
    expect(
      travelBatchSelectOptions(
        [
          {
            id: "job_1",
            travelBatches: [{ batchCode: "B01", batchReference: "JC-0001 / B01", id: "batch_1" }],
          },
        ],
        "job_1"
      )
    ).toEqual([
      { label: "Unbatched", value: "" },
      { label: "JC-0001 / B01", value: "batch_1" },
    ]);
  });
});
