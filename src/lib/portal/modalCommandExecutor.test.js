import { describe, expect, test } from "bun:test";
import { executeModalCommand } from "./modalCommandExecutor";
import { JOB_CARD_MODALS } from "./modalLifecycle";

function makeDeps(overrides = {}) {
  const calls = [];
  const record = (name, result) => async (args) => {
    calls.push([name, args]);
    return result;
  };
  return {
    calls,
    deps: {
      addJobCardCollaborator: record("addJobCardCollaborator"),
      addProposalCollaborator: record("addProposalCollaborator"),
      assignContracting: record("assignContracting"),
      assignContractingOwner: record("assignContractingOwner"),
      assignJobCardCreator: record("assignJobCardCreator"),
      assignOperationsOwner: record("assignOperationsOwner"),
      assignQueryTeams: record("assignQueryTeams"),
      assignQueryTicketing: record("assignQueryTicketing"),
      assignTicketingOwner: record("assignTicketingOwner"),
      createExpense: record("createExpense", { id: "expense_1" }),
      createHotel: record("createHotel"),
      createInvoice: record("createInvoice"),
      createJobCard: record("createJobCard"),
      createLeave: record("createLeave"),
      createPnr: record("createPnr"),
      createProposal: record("createProposal", { id: "proposal_1" }),
      createQuery: record("createQuery", { id: "query_1" }),
      createTicket: record("createTicket"),
      createTourManager: record("createTourManager"),
      createTravelBatch: record("createTravelBatch", {
        batchReference: "JC-0001-NS / B01",
        id: "batch_1",
      }),
      createTraveller: record("createTraveller"),
      createVisa: record("createVisa"),
      decideApproval: record("decideApproval"),
      has: () => false,
      jobCardModals: JOB_CARD_MODALS,
      pendingExpenseProofFiles: [],
      pendingProposalFiles: [],
      pendingQueryFiles: [],
      queries: [],
      removeJobCardCollaborator: record("removeJobCardCollaborator"),
      removeProposalCollaborator: record("removeProposalCollaborator"),
      saveSeat: record("saveSeat"),
      team: [],
      updateExpense: record("updateExpense", { id: "expense_1" }),
      updateHotel: record("updateHotel"),
      updateInvoice: record("updateInvoice"),
      updateJobCard: record("updateJobCard"),
      updateLeave: record("updateLeave"),
      updatePnr: record("updatePnr"),
      updateProposal: record("updateProposal", { id: "proposal_1" }),
      updateQuery: record("updateQuery"),
      updateQueryStatus: record("updateQueryStatus"),
      updateSeatAllocation: record("updateSeatAllocation"),
      updateTicket: record("updateTicket"),
      updateTourManager: record("updateTourManager"),
      updateTravelBatch: record("updateTravelBatch"),
      updateTraveller: record("updateTraveller"),
      updateVisaRecord: record("updateVisaRecord"),
      uploadEntityFiles: record("uploadEntityFiles"),
      uploadExpenseProofFiles: record("uploadExpenseProofFiles"),
      uploadQueryFiles: record("uploadQueryFiles"),
      upsertStaff: record("upsertStaff", { created: false }),
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
      deps,
      form: {
        approxMargin: "",
        lostReason: "Price",
        queryId: "query_1",
        salesDecision: "Order Confirmed",
      },
      modal: "salesDecision",
    });

    expect(calls).toEqual([
      [
        "updateQueryStatus",
        {
          leadStage: "Confirmation",
          lostReason: undefined,
          queryId: "query_1",
          salesStatus: "Order Confirmed",
        },
      ],
    ]);
  });

  test("rejects inverted travel dates before mutations run", async () => {
    const { deps, calls } = makeDeps();

    await expect(
      executeModalCommand({
        deps,
        form: {
          clientName: "Acme",
          paxCount: "2",
          travelEndDate: "2026-08-01",
          travelStartDate: "2026-08-10",
        },
        modal: "query",
      })
    ).rejects.toThrow("Travel start date must be on or before Travel end date.");

    expect(calls).toEqual([]);
  });

  test("creates query then uploads pending query files", async () => {
    const pendingQueryFiles = [{ name: "ref.pdf" }];
    const { deps, calls } = makeDeps({ pendingQueryFiles });

    await executeModalCommand({
      deps,
      form: {
        batchingNotes: "3 batches of 100 pax on separate dates",
        budgetAmount: "12000",
        clientName: "Acme",
        contactMobile: "999",
        contactPerson: "Nina",
        destination: "Dubai",
        notes: "Reference itinerary",
        paxCount: "8",
        queryType: "MICE",
        salesOwnerName: "Sales",
        source: "Client",
        staffId: "staff_contracting",
        ticketingScope: "Both",
        travelEndDate: "2026-08-06",
        travelInBatches: "Yes",
        travelStartDate: "2026-08-01",
        travelType: "International Travel",
      },
      modal: "query",
    });

    expect(calls[0][0]).toBe("createQuery");
    expect(calls[0][1]).toMatchObject({
      batchingNotes: "3 batches of 100 pax on separate dates",
      contractingStaffId: "staff_contracting",
      ticketingScope: "Both",
      travelInBatches: true,
    });
    expect(calls[1]).toEqual([
      "uploadQueryFiles",
      expect.objectContaining({ files: pendingQueryFiles, queryId: "query_1" }),
    ]);
  });

  test("allows pricing-incomplete draft proposal save before Proposal Handoff", async () => {
    const { deps, calls } = makeDeps();

    await executeModalCommand({
      deps,
      form: {
        airfarePerPax: "",
        itinerarySummary: "Draft itinerary",
        landCostPerPax: "",
        queryIds: ["query_1"],
        sellingPrice: "",
        taxRate: "",
        visaCostPerPax: "",
      },
      modal: "proposal",
    });

    expect(calls).toEqual([
      [
        "createProposal",
        expect.objectContaining({
          airfarePerPax: 0,
          landCostPerPax: 0,
          queryIds: ["query_1"],
          sellingPrice: 0,
          visaCostPerPax: 0,
        }),
      ],
    ]);
  });

  test("rejects invalid required modal fields before mutations run", async () => {
    const { deps, calls } = makeDeps();

    await expect(
      executeModalCommand({
        deps,
        form: { fullName: "", jobCardId: "job_1" },
        modal: "traveller",
      })
    ).rejects.toThrow("Traveller name is required.");

    await expect(
      executeModalCommand({
        deps,
        form: { invoiceNumber: "", jobCardId: "job_1" },
        modal: "invoice",
      })
    ).rejects.toThrow("Invoice number is required.");

    await expect(
      executeModalCommand({
        deps,
        form: {
          cardAmount: "100",
          category: "Miscellaneous",
          expenseDate: "2026-06-15",
          expenseType: "office",
          paidBy: "",
        },
        modal: "expense",
      })
    ).rejects.toThrow("Paid by is required.");

    expect(calls).toEqual([]);
  });

  test("query assignment fields require contracting SPOC and ticketing scope together", async () => {
    const { deps, calls } = makeDeps();

    await expect(
      executeModalCommand({
        deps,
        form: {
          budgetAmount: "12000",
          clientName: "Acme",
          paxCount: "8",
          queryType: "MICE",
          source: "Client",
          staffId: "staff_contracting",
          ticketingScope: "",
          travelEndDate: "2026-08-06",
          travelStartDate: "2026-08-01",
          travelType: "International Travel",
        },
        modal: "query",
      })
    ).rejects.toThrow("Select a Ticketing Scope.");

    expect(calls).toEqual([]);
  });

  test("query updates clear batch notes when Travel in Batches is No", async () => {
    const { deps, calls } = makeDeps();

    await executeModalCommand({
      deps,
      form: {
        batchingNotes: "3 batches of 100 pax",
        budgetAmount: "12000",
        clientName: "Acme",
        entityId: "query_1",
        paxCount: "8",
        queryType: "MICE",
        source: "Client",
        travelEndDate: "2026-08-06",
        travelInBatches: "No",
        travelStartDate: "2026-08-01",
        travelType: "International Travel",
      },
      modal: "query",
    });

    expect(calls).toEqual([
      [
        "updateQuery",
        expect.objectContaining({
          batchingNotes: "",
          queryId: "query_1",
          travelInBatches: false,
        }),
      ],
    ]);
  });

  test("assignQueryTeams calls the atomic mutation once", async () => {
    const { deps, calls } = makeDeps();
    await executeModalCommand({
      deps,
      form: {
        queryId: "query_1",
        staffId: "staff_contracting",
        ticketingScope: "Both",
        ticketingStaffId: "staff_ticketing",
      },
      modal: "assignQueryTeams",
    });
    expect(calls).toEqual([
      [
        "assignQueryTeams",
        {
          contractingStaffId: "staff_contracting",
          queryId: "query_1",
          ticketingScope: "Both",
          ticketingStaffId: "staff_ticketing",
        },
      ],
    ]);
  });

  test("assignQueryTeams rejects invalid ticketing scope before mutation", async () => {
    const { deps, calls } = makeDeps();

    await expect(
      executeModalCommand({
        deps,
        form: {
          queryId: "query_1",
          staffId: "staff_contracting",
          ticketingScope: "Regional",
        },
        modal: "assignQueryTeams",
      })
    ).rejects.toThrow("Select a valid Ticketing Scope.");

    expect(calls).toEqual([]);
  });

  test("assignJobCardCreator calls the assignment mutation", async () => {
    const { deps, calls } = makeDeps();
    await executeModalCommand({
      deps,
      form: { queryId: "query_1", staffId: "staff_accounts" },
      modal: "assignJobCardCreator",
    });
    expect(calls).toEqual([
      ["assignJobCardCreator", { queryId: "query_1", staffId: "staff_accounts" }],
    ]);
  });

  test("collaborator modals call proposal and job card share mutations", async () => {
    const { deps, calls } = makeDeps();
    await executeModalCommand({
      deps,
      form: { proposalId: "proposal_1", staffId: "staff_ops" },
      modal: "addProposalCollaborator",
    });
    await executeModalCommand({
      deps,
      form: { jobCardId: "job_1", staffId: "staff_ops" },
      modal: "addJobCardCollaborator",
    });
    await executeModalCommand({
      deps,
      form: { proposalId: "proposal_1", staffId: "staff_ops" },
      modal: "removeProposalCollaborator",
    });
    await executeModalCommand({
      deps,
      form: { jobCardId: "job_1", staffId: "staff_ops" },
      modal: "removeJobCardCollaborator",
    });
    expect(calls).toEqual([
      ["addProposalCollaborator", { proposalId: "proposal_1", staffId: "staff_ops" }],
      ["addJobCardCollaborator", { jobCardId: "job_1", staffId: "staff_ops" }],
      ["removeProposalCollaborator", { proposalId: "proposal_1", staffId: "staff_ops" }],
      ["removeJobCardCollaborator", { jobCardId: "job_1", staffId: "staff_ops" }],
    ]);
  });

  test("office/general expenses do not require a job card", async () => {
    const { deps, calls } = makeDeps();
    await executeModalCommand({
      deps,
      form: {
        cardAmount: "500",
        category: "Miscellaneous",
        expenseDate: "2026-06-15",
        expenseType: "office",
        jobCardId: "",
        paidBy: "Accounts",
      },
      modal: "expense",
    });
    expect(calls).toEqual([
      [
        "createExpense",
        expect.objectContaining({
          category: "Miscellaneous",
          paidBy: "Accounts",
        }),
      ],
    ]);
    expect(calls[0][1].jobCardId).toBeUndefined();
  });

  test("creates travel batches with operational fields on the parent job card", async () => {
    const { deps, calls } = makeDeps();
    await executeModalCommand({
      deps,
      form: {
        confirmedPax: "12",
        contractingOwnerId: "staff_contracting",
        contractingOwnerName: "Contracting Lead",
        destination: "Dubai",
        jobCardId: "job_1",
        operationsOwnerId: "staff_ops",
        operationsOwnerName: "Ops Lead",
        roomCount: "6",
        status: "In Operations",
        ticketingOwnerId: "staff_ticketing",
        ticketingOwnerName: "Ticketing Lead",
        tourManagerName: "TM One",
        travelEndDate: "2026-08-10",
        travelStartDate: "2026-08-01",
      },
      modal: "travelBatch",
    });
    expect(calls).toEqual([
      [
        "createTravelBatch",
        {
          confirmedPax: 12,
          contractingOwnerId: "staff_contracting",
          contractingOwnerName: "Contracting Lead",
          destination: "Dubai",
          jobCardId: "job_1",
          operationsOwnerId: "staff_ops",
          operationsOwnerName: "Ops Lead",
          roomCount: 6,
          status: "In Operations",
          ticketingOwnerId: "staff_ticketing",
          ticketingOwnerName: "Ticketing Lead",
          tourManagerName: "TM One",
          travelEndDate: "2026-08-10",
          travelStartDate: "2026-08-01",
        },
      ],
    ]);
  });

  test("updates travel batches by travel batch id", async () => {
    const { deps, calls } = makeDeps();
    await executeModalCommand({
      deps,
      form: {
        batchReference: "JC-0001-NS / B01",
        confirmedPax: "8",
        destination: "Singapore",
        entityId: "batch_1",
        jobCardId: "job_1",
        roomCount: "4",
        status: "Open",
        travelEndDate: "2026-09-08",
        travelStartDate: "2026-09-01",
      },
      modal: "travelBatch",
    });
    expect(calls).toEqual([
      [
        "updateTravelBatch",
        {
          confirmedPax: 8,
          destination: "Singapore",
          roomCount: 4,
          status: "Open",
          travelBatchId: "batch_1",
          travelEndDate: "2026-09-08",
          travelStartDate: "2026-09-01",
        },
      ],
    ]);
  });

  test("passes travelBatchId through create and update traveller payloads", async () => {
    const { deps, calls } = makeDeps();

    await executeModalCommand({
      deps,
      form: {
        arrivingEarly: "No",
        domesticTravelRequired: "No",
        extensionOfTour: "No",
        fullName: "Ada Lovelace",
        jobCardId: "job_1",
        travelBatchId: "batch_1",
        visaRequired: "Yes",
      },
      modal: "traveller",
    });

    expect(calls[0][1]).toMatchObject({
      fullName: "Ada Lovelace",
      jobCardId: "job_1",
      travelBatchId: "batch_1",
    });

    await executeModalCommand({
      deps,
      form: {
        arrivingEarly: "No",
        domesticTravelRequired: "No",
        entityId: "traveller_1",
        extensionOfTour: "No",
        fullName: "Ada Lovelace",
        jobCardId: "job_1",
        travelBatchId: "",
        visaRequired: "Yes",
      },
      modal: "traveller",
    });

    expect(calls[1][1]).toMatchObject({
      fullName: "Ada Lovelace",
      travelBatchId: "",
      travellerId: "traveller_1",
    });
  });
});
