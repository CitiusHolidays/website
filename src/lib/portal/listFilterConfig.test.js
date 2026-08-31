import { describe, expect, test } from "bun:test";
import {
  CONTRACTING_STATUSES,
  JOB_CARD_STATUSES,
  LEAD_STAGES,
  PROPOSAL_STATUSES,
  QUERY_TYPES,
  SALES_STATUSES,
  VISA_STATUSES,
} from "./constants.js";
import { getListFilterConfig, LIST_FILTER_CONFIG, PORTAL_LIST_VIEWS } from "./listFilterConfig.js";

describe("ListFilterConfig", () => {
  test("Defines config for every portal list view", () => {
    for (const view of PORTAL_LIST_VIEWS) {
      expect(Array.isArray(LIST_FILTER_CONFIG[view])).toBe(true);
    }
  });

  test("Option values align with constants for key views", () => {
    const salesOptions = LIST_FILTER_CONFIG.queries.find((f) => f.field === "salesStatus")?.options;
    expect(
      salesOptions
        .map((o) => o.value)
        .filter(Boolean)
        .slice(0, SALES_STATUSES.length)
    ).toEqual(SALES_STATUSES);
    const contractingOptions = LIST_FILTER_CONFIG.contracting.find(
      (f) => f.field === "contractingStatus"
    )?.options;
    const contractingValues = contractingOptions.map((o) => o.value).filter(Boolean);
    expect(contractingValues.slice(0, CONTRACTING_STATUSES.length)).toEqual(CONTRACTING_STATUSES);
    expect(contractingValues.at(-1)).toBe("Query Received|Proposal in progress");
    expect(LIST_FILTER_CONFIG.proposals[0].options.map((o) => o.value).filter(Boolean)).toEqual(
      PROPOSAL_STATUSES
    );
    expect(
      LIST_FILTER_CONFIG["job-cards"]
        .find((f) => f.field === "status")
        .options.map((o) => o.value)
        .filter(Boolean)
    ).toEqual(JOB_CARD_STATUSES);
    const visaOptions = LIST_FILTER_CONFIG.visa[0].options.map((o) => o.value).filter(Boolean);
    expect(visaOptions.slice(0, VISA_STATUSES.length)).toEqual(VISA_STATUSES);
    expect(visaOptions.at(-1)).toBe("Not Started|Checklist Shared|Documents Pending|Awaiting");
    expect(
      LIST_FILTER_CONFIG.queries
        .find((f) => f.field === "queryType")
        ?.options?.map((o) => o.value)
        .filter(Boolean)
    ).toEqual(QUERY_TYPES);
    expect(
      LIST_FILTER_CONFIG.queries
        .find((f) => f.field === "salesStatus")
        .options.map((o) => o.value)
        .filter(Boolean)
        .at(-1)
    ).toBe("Proposal in discussion|Change in destination|Date/Destination Change Required");
  });

  test("Team view uses directory filters without date-scoped fields", () => {
    const fields = LIST_FILTER_CONFIG.team.map((entry) => entry.field);
    expect(fields).toEqual(["department", "function"]);
    expect(LIST_FILTER_CONFIG.dashboard).toEqual([]);
    expect(LIST_FILTER_CONFIG.reports).toEqual([]);
  });

  test("Pipeline sales mode exposes lead stage and query type only", () => {
    const sales = getListFilterConfig("pipeline", { pipelineMode: "sales" });
    expect(sales.map((f) => f.field)).toEqual(["leadStage", "queryType"]);
    expect(LEAD_STAGES.length).toBeGreaterThan(0);
    const contracting = getListFilterConfig("pipeline", { pipelineMode: "contracting" });
    expect(contracting.some((f) => f.field === "leadStage")).toBe(false);
  });
});
