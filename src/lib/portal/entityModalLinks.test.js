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

  test("autofills travel batch operational fields from linked job card", () => {
    expect(
      applyJobCardLink(
        {},
        {
          id: "job_1",
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
          status: "In Operations",
        },
        "travelBatch",
      ),
    ).toMatchObject({
      jobCardId: "job_1",
      destination: "Dubai",
      confirmedPax: "10",
      roomCount: "5",
      travelStartDate: "2026-08-01",
      travelEndDate: "2026-08-08",
      contractingOwnerId: "staff_1",
      contractingOwnerName: "Contracting",
      operationsOwnerId: "staff_2",
      operationsOwnerName: "Operations",
      ticketingOwnerId: "staff_3",
      ticketingOwnerName: "Ticketing",
      tourManagerName: "TM",
      status: "In Operations",
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

  test("clears stale travel batch when job card changes", () => {
    const jobCards = [
      {
        id: "job_1",
        travelBatches: [{ id: "batch_1", batchReference: "JC-0001 / B01" }],
      },
      { id: "job_2", travelBatches: [] },
    ];
    expect(
      reconcileTravelBatchSelection({ jobCardId: "job_2", travelBatchId: "batch_1" }, jobCards),
    ).toEqual({ travelBatchId: "" });
  });

  test("builds travel batch select options for the selected job card", () => {
    expect(
      travelBatchSelectOptions(
        [
          {
            id: "job_1",
            travelBatches: [{ id: "batch_1", batchReference: "JC-0001 / B01", batchCode: "B01" }],
          },
        ],
        "job_1",
      ),
    ).toEqual([
      { value: "", label: "Unbatched" },
      { value: "batch_1", label: "JC-0001 / B01" },
    ]);
  });
});
