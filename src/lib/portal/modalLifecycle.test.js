import { describe, expect, test } from "bun:test";
import { createInitialModalForm, jobCardProposalLinkPatch } from "./modalLifecycle";

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
