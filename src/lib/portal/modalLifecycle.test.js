import { describe, expect, test } from "bun:test";
import { createInitialModalForm } from "./modalLifecycle";

const initialForm = {
  queryId: "",
  queryIds: [],
  proposalId: "",
  jobCardId: "",
  travellerId: "",
  pnrId: "",
  visaRecordId: "",
  clientName: "",
  destination: "",
  confirmedPax: "1",
  paxCount: "1",
  travelStartDate: "",
  travelEndDate: "",
  budgetAmount: "",
  queryType: "MICE",
};

describe("createInitialModalForm", () => {
  test("hydrates job card forms from linked query and latest linked proposal", () => {
    const form = createInitialModalForm({
      type: "jobCard",
      initial: { queryId: "query_1" },
      initialForm,
      queries: [
        {
          id: "query_1",
          clientName: "Acme",
          destination: "Dubai",
          paxCount: 12,
          travelStartDate: "2026-08-01",
          travelEndDate: "2026-08-06",
          budgetAmount: 5000,
        },
      ],
      proposals: [
        { id: "proposal_old", queryId: "query_1", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "proposal_new", queryIds: ["query_1"], updatedAt: "2026-02-01T00:00:00.000Z" },
      ],
      jobCards: [],
      travellers: [],
      travellersWithoutVisa: [],
      pnrs: [],
      visas: [],
      access: { roles: [] },
    });

    expect(form).toMatchObject({
      queryId: "query_1",
      proposalId: "proposal_new",
      clientName: "Acme",
      destination: "Dubai",
      confirmedPax: "1",
      travelStartDate: "2026-08-01",
      travelEndDate: "2026-08-06",
    });
  });

  test("defaults cement-scoped query creation to Cement", () => {
    const form = createInitialModalForm({
      type: "query",
      initial: {},
      initialForm,
      queries: [],
      proposals: [],
      jobCards: [],
      travellers: [],
      travellersWithoutVisa: [],
      pnrs: [],
      visas: [],
      access: { roles: ["Sales Cement"] },
    });

    expect(form.queryType).toBe("Cement");
  });
});
