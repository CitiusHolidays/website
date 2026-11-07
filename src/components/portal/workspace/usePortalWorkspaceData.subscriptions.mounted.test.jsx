import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act } from "react";

// Pins which Convex subscriptions each workspace context opens, with their exact args, so
// refactors of the per-view data hooks cannot silently change what loads or when.
// Midday UTC keeps the local reference date the same in every timezone the suite runs in.
process.env.TZ = "UTC";
const FIXED_NOW = 1_779_969_600_000;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal",
});
const calls = [];
const loadMoreCalls = [];
let responder = "more";

const DETAIL_RESPONSES = {
  "crm/approvals:getListRow": {
    entityId: "expense-from-approval",
    entityType: "expense",
    id: "a-1",
  },
  "crm/finance:getFinanceOverview": { aggregateCoverage: { complete: true } },
  "crm/queries:getDetail": { confirmedOffer: { proposalId: "offer-proposal" }, id: "q-focused" },
};

function pageResponse(name) {
  if (responder === "loading") {
    return { results: [], status: "LoadingFirstPage" };
  }
  return { results: [{ id: `row:${name}` }], status: "CanLoadMore" };
}

function queryResponse(name) {
  if (responder === "loading") {
    return;
  }
  if (name === "crm/listSearch:getReadiness") {
    const ready = responder === "ready";
    return { tables: { jobCards: ready, proposals: true, queries: ready, travellers: ready } };
  }
  return DETAIL_RESPONSES[name] ?? { id: `detail:${name}` };
}

mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
  usePortalSubscriptionSummary: () => ({
    duplicateSubscriptions: 0,
    logicalSubscriptions: 0,
    subscriptions: [],
  }),
  useTrackedPaginatedQuery: (reference, args, options) => {
    const name = getFunctionName(reference);
    calls.push({ args, name, pageSize: options?.initialNumItems });
    return {
      ...(args === "skip" ? { results: [], status: "LoadingFirstPage" } : pageResponse(name)),
      loadMore: (count) => loadMoreCalls.push(`${name} ${count}`),
    };
  },
  useTrackedQuery: (reference, args) => {
    const name = getFunctionName(reference);
    calls.push({ args, name });
    return args === "skip" ? undefined : queryResponse(name);
  },
}));

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  Date.now = () => FIXED_NOW;
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

const ALL = () => true;
const NONE = () => false;
const only =
  (...permissions) =>
  (permission) =>
    permissions.includes(permission);
const FILTERS = {
  action: "update",
  active: "true",
  approvalStatus: "Pending",
  callingStatus: "Called",
  category: "Hotel",
  contractingStatus: "Order Lost",
  department: "Sales",
  entityType: "query",
  leadStage: "Hot",
  passportExpiryUrgency: "critical",
  passportStatus: "Valid",
  queryType: "FIT",
  reimbursementStatus: "Reimbursed",
  roomType: "Twin",
  salesStatus: "Open",
  staffId: "staff-9",
  status: "Approved",
  ticketStatus: "Issued",
  type: "expense",
  visaStatus: "Submitted",
};
const BASE = {
  access: { permissions: ["view:visa", "view:team"], roles: ["Admin"] },
  canFetch: true,
  dateRangeArg: { from: "2026-01-01", to: "2026-01-31" },
  deepLinkId: null,
  deepLinkOpen: null,
  deepLinkQueryId: null,
  form: {},
  has: ALL,
  jobCardFilter: "jc-filter",
  listFilters: FILTERS,
  modal: null,
  search: "",
  view: "dashboard",
};

const SCENARIOS = {
  "accounts job cards": { view: "accounts-job-cards" },
  activity: { view: "activity" },
  "approval deep link without expense permission": {
    deepLinkId: "a-1",
    deepLinkOpen: "approval",
    has: only("view:approvals"),
    view: "approvals",
  },
  "contracting lost history": {
    listFilters: { ...FILTERS, contractingStatus: "Order Lost" },
    view: "contracting",
  },
  "deep links without permissions": {
    deepLinkId: "tk-1",
    deepLinkOpen: "ticket",
    has: NONE,
    view: "dashboard",
  },
  "expense deep link": { deepLinkId: "e-1", deepLinkOpen: "expense", view: "expenses" },
  finance: { view: "finance" },
  flights: { view: "flights" },
  "hotels with room counts": { view: "hotels" },
  "job card creation from a query": {
    form: { queryId: "query-from-form" },
    modal: "jobCard",
    view: "queries",
  },
  "job card deep link with query": {
    deepLinkId: "jc-1",
    deepLinkOpen: "jobCard",
    deepLinkQueryId: "dl-query",
    view: "job-cards",
  },
  "job card query-only deep link": {
    deepLinkOpen: "jobCard",
    deepLinkQueryId: "dl-query",
    has: only("view:jobCards", "manage:jobCards"),
    view: "dashboard",
  },
  "job cards searching": { search: "  beach  ", view: "job-cards" },
  "leave creation": {
    form: { staffId: "staff-1", startDate: "2026-05-01" },
    modal: "leave_create",
    view: "employees-on-leave",
  },
  "passenger import modal": { modal: "passengerImport", view: "travellers" },
  "passport for a tour manager": {
    access: { permissions: [], roles: ["Tour Manager"] },
    view: "passport",
  },
  "passport for staff": { view: "passport" },
  pipeline: { view: "pipeline" },
  "proposal collaborator modal": {
    form: { entityId: "p-entity", proposalId: "p-form" },
    modal: "addProposalCollaborator",
    view: "proposals",
  },
  "proposal deep link": { deepLinkId: "p-1", deepLinkOpen: "proposal", view: "proposals" },
  "queries searching": { search: "  beach  ", view: "queries" },
  "queries without fetch": { canFetch: false, view: "queries" },
  "query modal focus": {
    form: { entityId: "q-entity", focusedDetailType: "query" },
    modal: "query",
    view: "queries",
  },
  reports: { view: "reports" },
  "seat allocation": { view: "seat-allocation" },
  settings: { view: "settings" },
  "team picker without directory": {
    access: { permissions: ["view:visa", "view:team"], roles: ["Sales"] },
    has: only("view:queries"),
    view: "team",
  },
  ticketing: { view: "ticketing" },
  "tickets with focused ticket": { deepLinkId: "tk-1", deepLinkOpen: "ticket", view: "tickets" },
  "tour managers": { listFilters: { ...FILTERS, status: "Pending" }, view: "tour-managers" },
  "traveller deep link": { deepLinkId: "t-1", deepLinkOpen: "traveller", view: "travellers" },
  "travellers searching": { search: "anna", view: "travellers" },
  "visa create": { modal: "visa_create", view: "visa" },
};

function summarizeReturn(data) {
  return Object.entries(data)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}[${value.length}]`;
      }
      const shown = value === undefined || value === null || value === true || value === false;
      return `${key}:${shown ? String(value) : "set"}`;
    })
    .join(" ");
}

const COMMIT = Symbol("commit");

function lastCommittedRenderCalls() {
  const end = calls.lastIndexOf(COMMIT);
  return calls.slice(calls.lastIndexOf(COMMIT, end - 1) + 1, end);
}

async function record(scenario, responderName) {
  const { createRoot } = await import("react-dom/client");
  const { useEffect } = await import("react");
  const { usePortalWorkspaceData } = await import("./usePortalWorkspaceData");
  responder = responderName;
  calls.length = 0;
  loadMoreCalls.length = 0;
  let latest;
  const onCommit = (data) => {
    calls.push(COMMIT);
    latest = data;
  };
  function Probe() {
    const data = usePortalWorkspaceData({ ...BASE, ...scenario });
    useEffect(() => onCommit(data));
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Probe />));
  const rendered = lastCommittedRenderCalls();
  const subscriptions = rendered
    .map((call, index) =>
      call.args === "skip"
        ? null
        : `#${index} ${call.name} ${JSON.stringify(call.args)}${call.pageSize ? ` page=${call.pageSize}` : ""}`
    )
    .filter(Boolean);
  const automaticLoads = [...loadMoreCalls];
  loadMoreCalls.length = 0;
  act(() => {
    for (const control of Object.values(latest.pagination)) {
      control.loadMore();
    }
  });
  const result = {
    automaticLoads,
    manualLoads: [...loadMoreCalls],
    returned: summarizeReturn(latest),
    subscriptionCount: rendered.length,
    subscriptions,
  };
  await act(async () => root.unmount());
  container.remove();
  return result;
}

for (const [name, scenario] of Object.entries(SCENARIOS)) {
  test(`workspace subscriptions: ${name}`, async () => {
    expect({
      loaded: await record(scenario, "more"),
      loading: await record(scenario, "loading"),
      searchReady: await record(scenario, "ready"),
    }).toMatchSnapshot();
  });
}
