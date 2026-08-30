import { describe, expect, test } from "bun:test";
import {
  createFocusedEditModalForm,
  createInitialModalForm,
  createModalActionOwnership,
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

describe("ModalActionOwnership", () => {
  test("Rejects duplicate actions and cannot close a newer modal instance", () => {
    const ownership = createModalActionOwnership();
    const first = ownership.open();

    expect(ownership.begin()).toBe(first);
    expect(ownership.begin()).toBeNull();

    const second = ownership.open();
    expect(ownership.close(first)).toBe(false);
    expect(ownership.current()).toBe(second);
    expect(ownership.begin()).toBe(second);

    expect(ownership.release(second)).toBe(true);
    expect(ownership.begin()).toBe(second);
    expect(ownership.close(second)).toBe(true);
    expect(ownership.current()).toBeNull();
  });

  test("Ignores a deferred timer completion after another modal opens", async () => {
    const ownership = createModalActionOwnership();
    const first = ownership.open();
    expect(ownership.begin()).toBe(first);

    let finishFirst;
    const firstCompletion = new Promise((resolve) => {
      finishFirst = resolve;
    }).then(() => new Promise((resolve) => setTimeout(() => resolve(ownership.close(first)), 1)));

    const second = ownership.open();
    finishFirst();

    expect(await firstCompletion).toBe(false);
    expect(ownership.current()).toBe(second);
  });
});

describe("CreateInitialModalForm", () => {
  test("Hydrates job card forms only from the immutable Confirmed Offer", () => {
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
            id: "confirmed_offer_1",
            landCostPerPax: 45_000,
            profitPerPax: 12_000,
            proposalId: "proposal_old",
            proposalQueryHandoffId: "handoff_1",
            proposalRevision: 2,
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
      confirmedOfferId: "confirmed_offer_1",
      confirmedPax: "18",
      destination: "Baku",
      proposalId: "proposal_old",
      proposalQueryHandoffId: "handoff_1",
      proposalRevision: 2,
      queryId: "query_1",
      sellingPricePerPax: "80000",
      travelEndDate: "2026-10-08",
      travelStartDate: "2026-10-02",
    });
  });

  test("Defaults cement-scoped query creation to Cement", () => {
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

describe("JobCardProposalLinkPatch", () => {
  const proposals = [
    { id: "proposal_old", queryId: "query_1", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "proposal_new", queryIds: ["query_1"], updatedAt: "2026-02-01T00:00:00.000Z" },
  ];

  test("Reports loading while focused Query detail is unavailable", () => {
    expect(
      jobCardProposalLinkPatch({
        form: { queryId: "query_1" },
        modal: "jobCard",
        proposals,
      })
    ).toEqual({ _confirmedOfferState: "loading" });
  });

  test("Rejects a list projection as Job Card commercial authority", () => {
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
    ).toEqual({ _confirmedOfferState: "missing", proposalId: "" });
  });

  test("Hydrates immutable Confirmed Offer values when focused query detail arrives", () => {
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
              id: "confirmed_offer_1",
              landCostPerPax: 45_000,
              profitPerPax: 12_000,
              proposalId: "proposal_old",
              proposalQueryHandoffId: "handoff_1",
              proposalRevision: 2,
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
      _confirmedOfferQueryId: "query_1",
      _confirmedOfferState: "ready",
      confirmedOfferId: "confirmed_offer_1",
      confirmedPax: "18",
      proposalId: "proposal_old",
      proposalQueryHandoffId: "handoff_1",
      proposalRevision: 2,
      sellingPricePerPax: "80000",
    });
  });

  test("Skips existing Job Cards and does not trust a prefilled Proposal id", () => {
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
    ).toEqual({ _confirmedOfferState: "loading" });
  });

  test("Hydrates once per selected Query so later edits are preserved", () => {
    expect(
      jobCardProposalLinkPatch({
        form: {
          _confirmedOfferQueryId: "query_1",
          _confirmedOfferState: "ready",
          confirmedPax: "22",
          queryId: "query_1",
        },
        modal: "jobCard",
        queries: [
          {
            confirmedOffer: {
              confirmedPax: 18,
              id: "confirmed_offer_1",
              proposalId: "proposal_old",
              proposalQueryHandoffId: "handoff_1",
              proposalRevision: 2,
            },
            id: "query_1",
          },
        ],
      })
    ).toBeNull();
  });
});

describe("CreateFocusedEditModalForm", () => {
  test("Hydrates Query edit-only contact fields from focused detail", () => {
    expect(
      createFocusedEditModalForm("query", {
        clientName: "Acme",
        contactMobile: "+91 90000 00000",
        contactPerson: "Nina",
        id: "query_1",
        paxCount: 12,
        queryType: "MICE",
        salesOwnerId: "staff_sales",
        salesOwnerName: "Nina Sales",
        source: "Referral",
        travelType: "International Travel",
      })
    ).toMatchObject({
      clientName: "Acme",
      contactMobile: "+91 90000 00000",
      contactPerson: "Nina",
      entityId: "query_1",
      salesOwnerStaffId: "staff_sales",
      source: "Referral",
    });
  });

  test("Hydrates Proposal and Job Card edit forms from focused detail", () => {
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

  test("Preserves every linked query when focused Proposal detail exceeds the list preview", () => {
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
