import { describe, expect, test } from "bun:test";
import {
  createFocusedEditModalForm,
  createInitialModalForm,
  jobCardProposalLinkPatch,
} from "./modalLifecycle";

const initialForm = {
  budgetAmount: "",
  clientName: "",
  confirmedPax: "1",
  destination: "",
  jobCardId: "",
  paxCount: "1",
  pnrId: "",
  proposalId: "",
  queryId: "",
  queryIds: [],
  queryType: "MICE",
  travelEndDate: "",
  travellerId: "",
  travelStartDate: "",
  visaRecordId: "",
};

describe("createInitialModalForm", () => {
  test("hydrates job card forms from linked query and latest linked proposal", () => {
    const form = createInitialModalForm({
      access: { roles: [] },
      initial: { queryId: "query_1" },
      initialForm,
      jobCards: [],
      pnrs: [],
      proposals: [
        { id: "proposal_old", queryId: "query_1", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "proposal_new", queryIds: ["query_1"], updatedAt: "2026-02-01T00:00:00.000Z" },
      ],
      queries: [
        {
          budgetAmount: 5000,
          clientName: "Acme",
          confirmedOffer: {
            airfarePerPax: 20_000,
            confirmedPax: 18,
            destination: "Baku",
            landCostPerPax: 45_000,
            profitPerPax: 12_000,
            proposalId: "proposal_old",
            sellingPricePerPax: 80_000,
            travelEndDate: "2026-10-08",
            travelStartDate: "2026-10-02",
            visaCostPerPax: 3000,
          },
          destination: "Dubai",
          id: "query_1",
          paxCount: 12,
          travelEndDate: "2026-08-06",
          travelStartDate: "2026-08-01",
        },
      ],
      travellers: [],
      travellersWithoutVisa: [],
      type: "jobCard",
      visas: [],
    });

    expect(form).toMatchObject({
      clientName: "Acme",
      confirmedPax: "18",
      destination: "Baku",
      proposalId: "proposal_old",
      queryId: "query_1",
      sellingPricePerPax: "80000",
      travelEndDate: "2026-10-08",
      travelStartDate: "2026-10-02",
    });
  });

  test("defaults cement-scoped query creation to Cement", () => {
    const form = createInitialModalForm({
      access: { roles: ["Sales Cement"] },
      initial: {},
      initialForm,
      jobCards: [],
      pnrs: [],
      proposals: [],
      queries: [],
      travellers: [],
      travellersWithoutVisa: [],
      type: "query",
      visas: [],
    });

    expect(form.queryType).toBe("Cement");
  });
});

describe("jobCardProposalLinkPatch", () => {
  const proposals = [
    { id: "proposal_old", queryId: "query_1", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "proposal_new", queryIds: ["query_1"], updatedAt: "2026-02-01T00:00:00.000Z" },
  ];

  test("links the latest proposal when a job card modal opens with a prefilled query", () => {
    expect(
      jobCardProposalLinkPatch({
        form: { queryId: "query_1" },
        modal: "jobCard",
        proposals,
      })
    ).toEqual({ proposalId: "proposal_new" });
  });

  test("prefers the query-side bounded proposal projection over list fallback data", () => {
    expect(
      jobCardProposalLinkPatch({
        form: { queryId: "query_1" },
        modal: "jobCard",
        proposals,
        queries: [
          {
            id: "query_1",
            proposalPreview: { proposalId: "proposal_projected" },
          },
        ],
      })
    ).toMatchObject({ proposalId: "proposal_projected" });
  });

  test("hydrates immutable Confirmed Offer values when focused query detail arrives", () => {
    expect(
      jobCardProposalLinkPatch({
        form: { confirmedPax: "2", queryId: "query_1", sellingPricePerPax: "" },
        modal: "jobCard",
        proposals,
        queries: [
          {
            confirmedOffer: {
              airfarePerPax: 20_000,
              confirmedPax: 18,
              destination: "Baku",
              landCostPerPax: 45_000,
              profitPerPax: 12_000,
              proposalId: "proposal_old",
              sellingPricePerPax: 80_000,
              travelEndDate: "2026-10-08",
              travelStartDate: "2026-10-02",
              visaCostPerPax: 3000,
            },
            id: "query_1",
          },
        ],
      })
    ).toMatchObject({
      confirmedPax: "18",
      proposalId: "proposal_old",
      sellingPricePerPax: "80000",
    });
  });

  test("skips when the form already has a proposal or is editing an existing job card", () => {
    expect(
      jobCardProposalLinkPatch({
        form: { entityId: "job_1", queryId: "query_1" },
        modal: "jobCard",
        proposals,
      })
    ).toBeNull();
    expect(
      jobCardProposalLinkPatch({
        form: { proposalId: "proposal_old", queryId: "query_1" },
        modal: "jobCard",
        proposals,
      })
    ).toBeNull();
  });
});

describe("createFocusedEditModalForm", () => {
  test("hydrates Query edit-only contact fields from focused detail", () => {
    expect(
      createFocusedEditModalForm("query", {
        clientName: "Acme",
        contactMobile: "+91 90000 00000",
        contactPerson: "Nina",
        id: "query_1",
        paxCount: 12,
        queryType: "MICE",
        source: "Referral",
        travelType: "International Travel",
      })
    ).toMatchObject({
      clientName: "Acme",
      contactMobile: "+91 90000 00000",
      contactPerson: "Nina",
      entityId: "query_1",
      source: "Referral",
    });
  });

  test("hydrates Proposal and Job Card edit forms from focused detail", () => {
    expect(
      createFocusedEditModalForm("proposal", {
        airfarePerPax: 20_000,
        id: "proposal_1",
        queries: [{ id: "query_1" }, { id: "query_2" }],
        query: { id: "query_1", paxCount: 12 },
        queryId: "query_1",
        queryIds: ["query_1", "query_2"],
        sellingPrice: 80_000,
      })
    ).toMatchObject({
      entityId: "proposal_1",
      paxCount: "12",
      queryIds: ["query_1", "query_2"],
      sellingPrice: "80000",
    });
    expect(
      createFocusedEditModalForm("jobCard", {
        clientName: "Acme",
        confirmedPax: 12,
        id: "job_1",
        queryId: "query_1",
      })
    ).toMatchObject({
      clientName: "Acme",
      confirmedPax: "12",
      entityId: "job_1",
      queryId: "query_1",
    });
  });

  test("preserves every linked query when focused Proposal detail exceeds the list preview", () => {
    const queryIds = Array.from({ length: 8 }, (_, index) => `query_${index + 1}`);
    expect(
      createFocusedEditModalForm("proposal", {
        id: "proposal_many",
        queries: queryIds.map((id) => ({ id })),
        query: { id: queryIds[0], paxCount: 24 },
        queryId: queryIds[0],
        queryIds,
      })
    ).toMatchObject({
      entityId: "proposal_many",
      queryIds,
    });
  });
});
