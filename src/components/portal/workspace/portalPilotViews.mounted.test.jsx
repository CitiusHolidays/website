import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { PortalToastProvider } from "@/components/portal/PortalToast";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import { pipeViewRows } from "@/lib/portal/pipeViewRows";
import { queryHistoryScopeForView } from "@/lib/portal/queryHistory";
import { parseUrlFilterState } from "@/lib/portal/urlFilterState";
import { ContractingView } from "./ContractingView";
import { ProposalsView } from "./ProposalsView";
import { buildPortalWorkspaceFilters } from "./portalWorkspaceFilters";
import { QueriesView } from "./QueriesView";

let queryRecords = [];
let queryArgs;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(() => {
  mock.module("convex/react", () => ({
    usePaginatedQuery: (reference, args) => {
      const isQuery = args !== "skip" && getFunctionName(reference) === "crm/queries:listPage";
      if (isQuery) {
        queryArgs = args;
      }
      return {
        loadMore: () => undefined,
        results: isQuery ? queryRecords : [],
        status: "Exhausted",
      };
    },
    useQuery: (reference, args) =>
      args !== "skip" && getFunctionName(reference) === "crm/listSearch:getReadiness"
        ? { tables: { jobCards: true, proposals: true, queries: true, travellers: true } }
        : undefined,
  }));
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<PortalToastProvider>{element}</PortalToastProvider>));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const noopMutation = async () => undefined;
const noopUrl = async () => "https://example.com/file";
const denyPermission = () => false;
const hasManageQueries = (permission) => permission === P.MANAGE_QUERIES;
const hasManageProposals = (permission) => permission === P.MANAGE_PROPOSALS;
const noop = () => undefined;

describe("Mounted portal pilot views", () => {
  for (const surface of ["queries", "contracting"]) {
    test(`${surface} archive controls update rendered membership, URL and saved filters`, async () => {
      const { usePortalWorkspaceData } = await import("./usePortalWorkspaceData");
      const pathname = surface === "queries" ? "/portal/queries" : "/portal/contracting";
      window.history.replaceState({}, "", pathname);
      const config = getListFilterConfig(surface);
      const saved = [];
      let controller;
      const baseRow = {
        clientName: "Acme",
        contractingStatus: "Proposal sent",
        createdAt: "2026-10-10",
        paxCount: 10,
        queryType: "MICE",
        salesStatus: "Proposal in discussion",
      };
      const records = [
        { ...baseRow, id: "active", leadStage: "Proposal", queryCode: "Q-ACTIVE" },
        { ...baseRow, id: "stage", leadStage: "Lost", queryCode: "Q-STAGE" },
        {
          ...baseRow,
          id: "lost",
          leadStage: "Lost",
          queryCode: "Q-LOST",
          salesStatus: "Order Lost",
        },
        {
          ...baseRow,
          id: "type",
          queryCode: "Q-OTHER-TYPE",
          queryType: "Cement",
          salesStatus: "Order Lost",
        },
        {
          ...baseRow,
          createdAt: "2026-09-10",
          id: "date",
          queryCode: "Q-OTHER-DATE",
          salesStatus: "Order Lost",
        },
        {
          ...baseRow,
          clientName: "Unrelated",
          id: "search",
          queryCode: "Q-OTHER-SEARCH",
          salesStatus: "Order Lost",
        },
      ];
      queryRecords = records;
      function QueryHistory() {
        const [listFilters, setListFilters] = useState({
          contractingStatus: "Proposal sent",
          leadStage: "Proposal",
          queryType: "MICE",
          salesStatus: "Proposal in discussion",
        });
        const [search, setSearch] = useState("Acme");
        const [dateRange, setDateRange] = useState({ from: "2026-10-01", to: "2026-10-31" });
        controller = buildPortalWorkspaceFilters({
          allowed: true,
          createSavedView: async (input) => saved.push(input),
          dateRange,
          jobCardFilter: "",
          listFilterConfig: config,
          listFilters,
          pathname,
          removeSavedView: noopMutation,
          savedViews: [],
          search,
          searchParams: new URLSearchParams(window.location.search),
          setDateRange,
          setJobCardFilter: noop,
          setListFilters,
          setSearch,
          showToast: { error: noop, success: noop },
          updateSavedView: noopMutation,
          view: surface,
        });
        const data = usePortalWorkspaceData({
          access: { roles: [surface === "queries" ? "Sales" : "Contracting"] },
          canFetch: true,
          dateRangeArg: dateRange,
          deepLinkId: null,
          deepLinkOpen: null,
          deepLinkQueryId: null,
          form: {},
          has: (permission) => [P.VIEW_QUERIES, P.VIEW_CONTRACTING].includes(permission),
          jobCardFilter: "",
          listFilters,
          modal: null,
          search,
          view: surface,
        });
        const shared = {
          access: { roles: [surface === "queries" ? "Sales" : "Contracting"] },
          deleteItem: noopMutation,
          has: denyPermission,
          historyScope: queryHistoryScopeForView(surface, listFilters),
          onHistoryScopeChange: controller.setQueryHistoryScope,
          openModal: noop,
          removeQuery: noopMutation,
          rows: pipeViewRows(data.queries, {
            dateRange,
            filterConfig: config,
            jobCardFilter: "",
            listFilters,
            search,
            searchKeys: ["clientName"],
            view: surface,
          }),
        };
        return surface === "queries" ? (
          <QueriesView
            {...shared}
            getFinalizedPdfUrl={noopUrl}
            getQueryAttachmentUrl={noopUrl}
            submitToContracting={noopMutation}
          />
        ) : (
          <ContractingView {...shared} canAssign={false} proposals={[]} team={[]} />
        );
      }
      const view = await mount(<QueryHistory />);
      const history = view.container.querySelector('fieldset[aria-label="Query history"]');
      const buttons = [...history.querySelectorAll("button")];
      const active = buttons.find((button) => button.textContent.trim() === "Active queries");
      const archive = buttons.find((button) => button.textContent.trim() === "Lost queries");
      expect(active.getAttribute("aria-pressed")).toBe("true");
      expect(queryArgs).toMatchObject({
        historyScope: "active",
        queryType: "MICE",
        search: "Acme",
      });
      expect(view.container.textContent).toContain("Q-ACTIVE");
      expect(view.container.textContent).toContain("Q-STAGE");
      expect(view.container.textContent).not.toContain("Q-LOST");
      await act(async () => archive.click());
      expect(archive.getAttribute("aria-pressed")).toBe("true");
      expect(queryArgs).toMatchObject({ historyScope: "lost", queryType: "MICE", search: "Acme" });
      expect(queryArgs.leadStage).toBeUndefined();
      expect(view.container.textContent).toContain("Q-LOST");
      expect(view.container.textContent).not.toContain("Q-ACTIVE");
      expect(view.container.textContent).not.toContain("Q-STAGE");
      expect(view.container.textContent).not.toContain("Q-OTHER-");
      const archiveState = parseUrlFilterState(new URLSearchParams(window.location.search), config);
      expect(archiveState).toMatchObject({
        dateRange: { from: "2026-10-01", to: "2026-10-31" },
        listFilters:
          surface === "queries"
            ? { queryType: "MICE", salesStatus: "Order Lost" }
            : { contractingStatus: "Order Lost", queryType: "MICE" },
        search: "Acme",
      });
      expect(Object.keys(archiveState.listFilters).sort()).toEqual(
        surface === "queries" ? ["queryType", "salesStatus"] : ["contractingStatus", "queryType"]
      );
      await act(async () => controller.saveCurrentView("Lost history"));
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        filterState: {
          dateRange: { from: "2026-10-01", to: "2026-10-31" },
          listFilters: archiveState.listFilters,
          search: "Acme",
        },
        name: "Lost history",
        pathname,
        view: surface,
      });
      await act(async () => active.click());
      expect(active.getAttribute("aria-pressed")).toBe("true");
      expect(view.container.textContent).toContain("Q-ACTIVE");
      expect(view.container.textContent).toContain("Q-STAGE");
      expect(view.container.textContent).not.toContain("Q-LOST");
      expect(
        parseUrlFilterState(new URLSearchParams(window.location.search), config)
      ).toMatchObject({
        dateRange: { from: "2026-10-01", to: "2026-10-31" },
        listFilters: { queryType: "MICE" },
        search: "Acme",
      });
      await act(async () => controller.applySavedView({ id: "saved-history", ...saved[0] }));
      expect(archive.getAttribute("aria-pressed")).toBe("true");
      expect(view.container.textContent).toContain("Q-LOST");
      expect(view.container.textContent).not.toContain("Q-STAGE");
      await view.unmount();
    });
  }
  test("Queries preserves the Sales submit action and typed query identity", async () => {
    const submitted = [];
    const submitToContracting = async (args) => submitted.push(args);
    const view = await mount(
      <QueriesView
        access={{ roles: ["Sales"] }}
        deleteItem={noopMutation}
        getFinalizedPdfUrl={noopUrl}
        getQueryAttachmentUrl={noopUrl}
        has={hasManageQueries}
        openModal={noop}
        removeQuery={noopMutation}
        rows={[
          {
            clientName: "Acme Group",
            createdAt: "2026-07-14",
            destination: "Ladakh",
            id: "query-1",
            leadStage: "Inquiry",
            paxCount: 20,
            proposalDocument: {
              fileName: "proposal-doc.pdf",
              proposalId: "proposal-1",
              uploadedAt: "2026-07-14",
            },
            queryCode: "Q-0001",
            salesOwnerName: "Nina Sales",
          },
        ]}
        submitToContracting={submitToContracting}
      />
    );

    expect(view.container.textContent).toContain("Q-0001");
    expect(view.container.textContent).toContain("Acme Group");
    expect(view.container.textContent).toContain("proposal-doc.pdf");
    expect(view.container.textContent).toContain("Add file");
    const submit = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Submit to Contracting"
    );
    expect(submit).toBeDefined();
    await act(async () => submit?.click());
    expect(submitted).toEqual([{ queryId: "query-1" }]);

    await view.unmount();
  });

  test("Queries reserves prominent attention treatment for real exceptions", async () => {
    const view = await mount(
      <QueriesView
        access={{ roles: ["Sales"] }}
        deleteItem={noopMutation}
        getFinalizedPdfUrl={noopUrl}
        getQueryAttachmentUrl={noopUrl}
        has={hasManageQueries}
        openModal={noop}
        removeQuery={noopMutation}
        rows={[
          {
            clientName: "Healthy Group",
            contractingOwnerId: "staff-contracting",
            createdAt: "2026-07-14",
            destination: "Goa",
            id: "query-healthy",
            leadStage: "Proposal",
            paxCount: 12,
            queryCode: "Q-HEALTHY",
            submittedToContractingAt: 1,
            ticketingOwnerId: "staff-ticketing",
            ticketingScope: "Required",
            travelStartDate: "2026-08-01",
          },
          {
            clientName: "Needs Assignment Group",
            createdAt: "2026-07-14",
            destination: "Goa",
            id: "query-warning",
            leadStage: "Proposal",
            paxCount: 12,
            queryCode: "Q-WARNING",
            submittedToContractingAt: 1,
          },
        ]}
        submitToContracting={noopMutation}
      />
    );

    expect(view.container.textContent).not.toContain("No open exception");
    expect(view.container.textContent).toContain("Contracting SPOC unassigned");
    expect(view.container.querySelectorAll('[data-attention="warning"]')).toHaveLength(2);

    await view.unmount();
  });

  test("Contracting preserves Contracting SPOC and With Sales handoff presentation", async () => {
    const view = await mount(
      <ContractingView
        access={{ roles: ["Contracting"] }}
        canAssign={false}
        deleteItem={noopMutation}
        has={denyPermission}
        openModal={noop}
        proposals={[
          {
            id: "proposal-1",
            proposalCode: "P-0001",
            proposalRevision: 1,
            queryId: "query-1",
            status: "Sent",
            updatedAt: "2026-07-14",
          },
        ]}
        removeQuery={noopMutation}
        rows={[
          {
            batchingNotes: "Batch A then Batch B",
            clientName: "Acme Group",
            commercialProjectionState: "ready",
            contractingOwnerName: "Cora Contracting",
            contractingStatus: "Proposal in progress",
            createdAt: "2026-07-14",
            id: "query-1",
            proposalPreview: {
              handedOffRevision: 1,
              proposalCode: "P-0001",
              proposalId: "proposal-1",
              proposalRevision: 1,
              status: "Sent",
              updatedAt: "2026-07-14",
            },
            queryCode: "Q-0001",
            ticketingOwnerName: "Tina Ticketing",
            ticketingScope: "International",
            travelInBatches: true,
          },
        ]}
        team={[]}
      />
    );

    expect(view.container.textContent).toContain("Contracting SPOC");
    expect(view.container.textContent).toContain("Cora Contracting");
    expect(view.container.textContent).toContain("With Sales");
    expect(view.container.textContent).toContain("Travel in Series");
    expect(view.container.textContent).toContain("Batch A then Batch B");

    await view.unmount();
  });

  test("Proposals preserves With Sales and Proposal Doc presentation", async () => {
    const view = await mount(
      <ProposalsView
        deleteItem={noopMutation}
        getFinalizedPdfUrl={noopUrl}
        getProposalAttachmentUrl={noopUrl}
        has={denyPermission}
        openModal={noop}
        removeProposal={noopMutation}
        rows={[
          {
            clientName: "Acme Group",
            createdAt: "2026-07-14",
            finalizedPdf: { fileName: "acme-final.pdf", uploadedAt: "2026-07-14" },
            id: "proposal-1",
            proposalCode: "P-0001",
            proposalRevision: 1,
            sentToSalesAt: "2026-07-14",
            status: "Sent",
          },
        ]}
        sendProposalToSales={noopMutation}
      />
    );

    expect(view.container.textContent).toContain("P-0001");
    expect(view.container.textContent).toContain("With Sales");
    expect(view.container.textContent).toContain("acme-final.pdf");
    expect(view.container.textContent).not.toContain("Upload PDF");

    await view.unmount();
  });

  test("Proposals sends one explicit Proposal, Query, and revision target", async () => {
    const calls = [];
    const sendProposalToSales = async (args) => calls.push(args);
    const view = await mount(
      <ProposalsView
        deleteItem={noopMutation}
        getFinalizedPdfUrl={noopUrl}
        getProposalAttachmentUrl={noopUrl}
        has={hasManageProposals}
        openModal={noop}
        removeProposal={noopMutation}
        rows={[
          {
            clientName: "Acme Group",
            costPrice: 70_000,
            createdAt: "2026-07-14",
            id: "proposal-1",
            proposalCode: "P-0001",
            proposalRevision: 4,
            query: { id: "query-1", queryCode: "Q-0001" },
            queryId: "query-1",
            sellingPrice: 100_000,
            status: "Draft",
          },
        ]}
        sendProposalToSales={sendProposalToSales}
      />
    );

    const button = [...view.container.querySelectorAll("button")].find((candidate) =>
      candidate.textContent?.includes("Send to Sales for Q-0001")
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
    expect(calls).toEqual([{ proposalId: "proposal-1", proposalRevision: 4, queryId: "query-1" }]);

    await view.unmount();
  });
});
