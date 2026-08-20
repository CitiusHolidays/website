import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import { projectJobCardListRow } from "./jobCardReads";
import { mergeProposalLinkedQueriesForUpdate, projectProposalListRow } from "./proposals";
import { projectQueryListRow } from "./queryReads";

const QUERY = {
  _id: "query-1",
  approxMargin: 1200,
  batchingNotes: "Two departures",
  budgetAmount: 75_000,
  clientName: "Example Client",
  confirmedAt: Date.UTC(2026, 7, 1),
  contactMobile: "+91 99999 99999",
  contactPerson: "Private Contact",
  contractingAirlinesCost: 10_000,
  contractingLandCost: 20_000,
  contractingOwnerId: "staff-contracting",
  contractingOwnerName: "Contracting Owner",
  contractingStatus: "Proposal in progress",
  contractingVisaCost: 2000,
  createdAt: Date.UTC(2026, 6, 1),
  destination: "Baku",
  jobCardCreatorName: "Accounts User",
  jobCardCreatorStaffId: "staff-accounts",
  leadStage: "Proposal",
  lostReason: "",
  notes: "Visible contracting note",
  paxCount: 10,
  queryCode: "Q-0001",
  queryType: "MICE",
  salesOwnerName: "Sales Owner",
  salesStatus: "Under Discussion",
  source: "Referral",
  submittedToContractingAt: Date.UTC(2026, 6, 2),
  ticketingOwnerId: "staff-ticketing",
  ticketingOwnerName: "Ticketing Owner",
  ticketingScope: "Both",
  travelEndDate: "2026-10-08",
  travelInBatches: true,
  travelStartDate: "2026-10-02",
  travelType: "International",
  updatedAt: Date.UTC(2026, 6, 3),
};

describe("Compact Staff Workspace list projections", () => {
  test("Query list omits private/edit-only detail while retaining visible workflow fields", () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const row = projectQueryListRow(fromAny<never, unknown>(QUERY));

    expect(row).toMatchObject({
      clientName: "Example Client",
      notes: "Visible contracting note",
      queryCode: "Q-0001",
      ticketingScope: "Both",
    });
    expect(row).not.toHaveProperty("contactMobile");
    expect(row).not.toHaveProperty("contactPerson");
    expect(row).not.toHaveProperty("jobCardCreatorName");
    expect(row).not.toHaveProperty("source");
  });

  test("Proposal list uses compact linked-query summaries and bounded file previews", () => {
    const attachments = Array.from({ length: 8 }, (_, index) => ({
      _id: `attachment-${index}`,
      createdAt: index,
      fileName: `working-${index}.xlsx`,
      fileSize: 100 + index,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }));
    const row = projectProposalListRow(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>({
        _id: "proposal-1",
        airfarePerPax: 10,
        clientName: "Example Client",
        collaboratorStaffIds: ["staff-1"],
        costPrice: 30,
        createdAt: 1,
        itinerarySummary: "Summary",
        landCostPerPax: 15,
        preparedBy: "Contracting Owner",
        proposalCode: "P-0001",
        queryId: "query-1",
        sellingPrice: 40,
        status: "Draft",
        updatedAt: 2,
        visaCostPerPax: 5,
      }),
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(
        Array.from({ length: 8 }, (_, index) => ({
          ...QUERY,
          _id: `query-${index + 1}`,
          queryCode: `Q-${String(index + 1).padStart(4, "0")}`,
        }))
      ),
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(attachments)
    );

    expect(row.attachments).toHaveLength(3);
    expect(row.attachmentCount).toBe(8);
    expect(row.hasCollaborators).toBe(true);
    expect(row.linkedQueryCount).toBe(8);
    expect(row.queryPreview).toHaveLength(3);
    expect(row.previewQueryIds).toEqual(["query-1", "query-2", "query-3"]);
    expect(row).not.toHaveProperty("queryIds");
    expect(row).not.toHaveProperty("collaboratorStaffIds");
    expect(row.queryPreview[0]).toMatchObject({
      contractingOwnerId: "staff-contracting",
      id: "query-1",
      paxCount: 10,
      queryCode: "Q-0001",
    });
    expect(row.queryPreview[0]).not.toHaveProperty("contactMobile");
    expect(row.queryPreview[0]).not.toHaveProperty("notes");
  });

  test("Proposal pricing edits preserve linked Queries outside the editor's scope", () => {
    const hiddenQuery = {
      ...QUERY,
      _id: "query-hidden",
      contractingOwnerId: "staff-other",
      contractingOwnerName: "Other Owner",
      createdBy: "auth-other",
    };
    const access = {
      allowed: true,
      authUserId: "auth-contracting",
      email: "contracting@example.com",
      name: "Contracting Owner",
      permissions: ["manage:proposals"],
      roles: ["Contracting"],
      staffId: "staff-contracting",
    };

    expect(
      mergeProposalLinkedQueriesForUpdate(access, [QUERY, hiddenQuery], [QUERY]).map(
        (query) => query._id
      )
    ).toEqual(["query-1", "query-hidden"]);
  });

  test("Job Card list omits checklist and payment detail", () => {
    const row = projectJobCardListRow(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>({
        _id: "job-1",
        clientName: "Example Client",
        confirmedPax: 10,
        createdAt: 1,
        jobCode: "JC-0001-SO",
        paymentTerms: { label: "MICE", maxAdvancePercent: 50, minAdvancePercent: 25 },
        preDepartureChecklist: Array.from({ length: 40 }, (_, index) => ({
          completed: false,
          title: `Task ${index}`,
        })),
        status: "Open",
        updatedAt: 2,
      }),
      null
    );

    expect(row).toMatchObject({ jobCode: "JC-0001-SO", status: "Open" });
    expect(row.hasCollaborators).toBe(false);
    expect(row).not.toHaveProperty("collaboratorStaffIds");
    expect(row).not.toHaveProperty("paymentTerms");
    expect(row).not.toHaveProperty("preDepartureChecklist");
  });
});
