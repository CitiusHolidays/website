import { describe, expect, test } from "bun:test";
import { createInitialModalForm } from "./modalLifecycle";

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
      confirmedPax: "1",
      destination: "Dubai",
      proposalId: "proposal_new",
      queryId: "query_1",
      travelEndDate: "2026-08-06",
      travelStartDate: "2026-08-01",
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
