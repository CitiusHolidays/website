import { describe, expect, test } from "bun:test";
import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import { getFilterDateRangeError } from "@/lib/portal/periodFilter";
import { buildPortalWorkspaceRows } from "./portalWorkspaceRows";

function workspaceRowsInput(overrides = {}) {
  return {
    activity: [],
    approvals: [],
    dateRange: { from: null, to: null },
    expenses: [],
    flightItinerary: [],
    hotels: [],
    invoices: [],
    jobCardFilter: "",
    jobCards: [],
    leaves: [],
    listFilterConfig: [],
    listFilters: {},
    notifications: [],
    pnrs: [],
    proposals: [],
    queries: [],
    search: "",
    seats: [],
    staff: [],
    team: [],
    tickets: [],
    tourManagers: [],
    travellersWithPassportExpiry: [],
    view: "queries",
    visas: [],
    ...overrides,
  };
}

describe("Portal workspace rows", () => {
  test("Filters query rows by date, status, and search", () => {
    const rows = buildPortalWorkspaceRows(
      workspaceRowsInput({
        dateRange: { from: "2026-01-01", to: "2026-01-31" },
        listFilterConfig: getListFilterConfig("queries"),
        listFilters: { queryType: "Corporate" },
        queries: [
          {
            _creationTime: 1,
            _id: "queries_1",
            clientName: "Acme Industries",
            createdAt: "2026-01-10",
            destination: "Delhi",
            queryCode: "Q-001",
            queryType: "Corporate",
            salesOwnerName: "Nisha",
          },
          {
            _creationTime: 2,
            _id: "queries_2",
            clientName: "Pilgrim Group",
            createdAt: "2026-01-12",
            destination: "Varanasi",
            queryCode: "Q-002",
            queryType: "Pilgrimage",
            salesOwnerName: "Raj",
          },
          {
            _creationTime: 3,
            _id: "queries_3",
            clientName: "Acme Old",
            createdAt: "2025-12-31",
            destination: "Mumbai",
            queryCode: "Q-003",
            queryType: "Corporate",
            salesOwnerName: "Nisha",
          },
        ],
        search: "acme",
        view: "queries",
      })
    );

    expect(rows.filteredQueries.map((row) => row.queryCode)).toEqual(["Q-001"]);
    expect(rows.viewResultCount).toBe(1);
  });

  test("Filters proposal and job card rows", () => {
    const proposalRows = buildPortalWorkspaceRows(
      workspaceRowsInput({
        listFilterConfig: getListFilterConfig("proposals"),
        listFilters: { status: "Draft" },
        proposals: [
          {
            _creationTime: 1,
            _id: "proposals_1",
            clientName: "Acme Industries",
            createdAt: "2026-02-01",
            preparedBy: "Nisha",
            proposalCode: "P-001",
            status: "Draft",
          },
          {
            _creationTime: 2,
            _id: "proposals_2",
            clientName: "Acme Industries",
            createdAt: "2026-02-01",
            preparedBy: "Nisha",
            proposalCode: "P-002",
            status: "Sent",
          },
        ],
        search: "P-001",
        view: "proposals",
      })
    );
    const jobCardRows = buildPortalWorkspaceRows(
      workspaceRowsInput({
        jobCards: [
          {
            _creationTime: 1,
            _id: "jobCards_1",
            clientName: "Acme Industries",
            createdAt: "2026-02-01",
            destination: "Delhi",
            jobCode: "JC-001",
            status: "Active",
          },
          {
            _creationTime: 2,
            _id: "jobCards_2",
            clientName: "Beta Industries",
            createdAt: "2026-02-01",
            destination: "Goa",
            jobCode: "JC-002",
            status: "Closed",
          },
        ],
        listFilterConfig: getListFilterConfig("job-cards"),
        listFilters: { status: "Active" },
        search: "acme",
        view: "job-cards",
      })
    );

    expect(proposalRows.filteredProposals.map((row) => row.proposalCode)).toEqual(["P-001"]);
    expect(jobCardRows.filteredJobCards.map((row) => row.jobCode)).toEqual(["JC-001"]);
  });

  test("Reports inverted date ranges without reordering them", () => {
    const dateRange = { from: "2026-03-31", to: "2026-03-01" };
    const rows = buildPortalWorkspaceRows(
      workspaceRowsInput({
        dateRange,
        queries: [
          {
            _creationTime: 1,
            _id: "queries_1",
            clientName: "Before",
            createdAt: "2026-02-01",
            queryCode: "Q-001",
          },
          {
            _creationTime: 2,
            _id: "queries_2",
            clientName: "After",
            createdAt: "2026-04-01",
            queryCode: "Q-002",
          },
        ],
        view: "queries",
      })
    );

    expect(getFilterDateRangeError(dateRange)).toBe("From must be on or before To.");
    expect(rows.filteredQueries.map((row) => row.queryCode)).toEqual(["Q-001", "Q-002"]);
  });
});
