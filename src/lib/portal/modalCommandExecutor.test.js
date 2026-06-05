import { describe, expect, test } from "bun:test";
import { executeModalCommand } from "./modalCommandExecutor";

function makeDeps(overrides = {}) {
  const calls = [];
  const record = (name, result) => async (args) => {
    calls.push([name, args]);
    return result;
  };
  return {
    calls,
    deps: {
      has: () => false,
      queries: [],
      team: [],
      pendingQueryFiles: [],
      pendingProposalFiles: [],
      pendingExpenseProofFiles: [],
      uploadQueryFiles: record("uploadQueryFiles"),
      uploadEntityFiles: record("uploadEntityFiles"),
      uploadExpenseProofFiles: record("uploadExpenseProofFiles"),
      createQuery: record("createQuery", { id: "query_1" }),
      updateQuery: record("updateQuery"),
      assignContracting: record("assignContracting"),
      assignQueryTicketing: record("assignQueryTicketing"),
      assignContractingOwner: record("assignContractingOwner"),
      assignOperationsOwner: record("assignOperationsOwner"),
      assignTicketingOwner: record("assignTicketingOwner"),
      updateQueryStatus: record("updateQueryStatus"),
      createProposal: record("createProposal", { id: "proposal_1" }),
      updateProposal: record("updateProposal", { id: "proposal_1" }),
      createJobCard: record("createJobCard"),
      updateJobCard: record("updateJobCard"),
      createTraveller: record("createTraveller"),
      updateTraveller: record("updateTraveller"),
      updateVisaRecord: record("updateVisaRecord"),
      createVisa: record("createVisa"),
      createPnr: record("createPnr"),
      updatePnr: record("updatePnr"),
      createTicket: record("createTicket"),
      updateTicket: record("updateTicket"),
      saveSeat: record("saveSeat"),
      updateSeatAllocation: record("updateSeatAllocation"),
      createHotel: record("createHotel"),
      updateHotel: record("updateHotel"),
      createTourManager: record("createTourManager"),
      updateTourManager: record("updateTourManager"),
      createInvoice: record("createInvoice"),
      updateInvoice: record("updateInvoice"),
      createExpense: record("createExpense", { id: "expense_1" }),
      updateExpense: record("updateExpense", { id: "expense_1" }),
      upsertStaff: record("upsertStaff", { created: false }),
      createLeave: record("createLeave"),
      updateLeave: record("updateLeave"),
      decideApproval: record("decideApproval"),
      ...overrides,
    },
  };
}

describe("executeModalCommand", () => {
  test("maps sales decisions to query status payloads without auto-filling margin", async () => {
    const { deps, calls } = makeDeps({
      queries: [{ id: "query_1", salesStatus: "Proposal in discussion" }],
    });

    await executeModalCommand({
      modal: "salesDecision",
      form: {
        queryId: "query_1",
        salesDecision: "Order Confirmed",
        approxMargin: "",
        lostReason: "Price",
      },
      deps,
    });

    expect(calls).toEqual([
      [
        "updateQueryStatus",
        {
          queryId: "query_1",
          salesStatus: "Order Confirmed",
          leadStage: "Confirmation",
          lostReason: undefined,
        },
      ],
    ]);
  });

  test("rejects inverted travel dates before mutations run", async () => {
    const { deps, calls } = makeDeps();

    await expect(
      executeModalCommand({
        modal: "query",
        form: {
          clientName: "Acme",
          paxCount: "2",
          travelStartDate: "2026-08-10",
          travelEndDate: "2026-08-01",
        },
        deps,
      }),
    ).rejects.toThrow("Travel start date must be on or before Travel end date.");

    expect(calls).toEqual([]);
  });

  test("creates query then uploads pending query files", async () => {
    const pendingQueryFiles = [{ name: "ref.pdf" }];
    const { deps, calls } = makeDeps({ pendingQueryFiles });

    await executeModalCommand({
      modal: "query",
      form: {
        clientName: "Acme",
        contactPerson: "Nina",
        contactMobile: "999",
        destination: "Dubai",
        paxCount: "8",
        travelStartDate: "2026-08-01",
        travelEndDate: "2026-08-06",
        queryType: "MICE",
        travelType: "International Travel",
        budgetAmount: "12000",
        source: "Client",
        salesOwnerName: "Sales",
        notes: "Reference itinerary",
      },
      deps,
    });

    expect(calls[0][0]).toBe("createQuery");
    expect(calls[1]).toEqual([
      "uploadQueryFiles",
      expect.objectContaining({ queryId: "query_1", files: pendingQueryFiles }),
    ]);
  });
});
