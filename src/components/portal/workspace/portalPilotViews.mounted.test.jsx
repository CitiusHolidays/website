import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PortalToastProvider } from "@/components/portal/PortalToast";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { ContractingView } from "./ContractingView";
import { ProposalsView } from "./ProposalsView";
import { QueriesView } from "./QueriesView";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => dom.window.close());

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

describe("mounted portal pilot views", () => {
  test("Queries preserves the Sales submit action and typed query identity", async () => {
    const submitted = [];
    const view = await mount(
      <QueriesView
        access={{ roles: ["Sales"] }}
        deleteItem={async () => undefined}
        getQueryAttachmentUrl={noopUrl}
        has={(permission) => permission === P.MANAGE_QUERIES}
        openModal={() => undefined}
        removeQuery={noopMutation}
        rows={[
          {
            clientName: "Acme Group",
            createdAt: "2026-07-14",
            destination: "Ladakh",
            id: "query-1",
            leadStage: "Inquiry",
            paxCount: 20,
            queryCode: "Q-0001",
            salesOwnerName: "Nina Sales",
          },
        ]}
        submitToContracting={async (args) => submitted.push(args)}
      />
    );

    expect(view.container.textContent).toContain("Q-0001");
    expect(view.container.textContent).toContain("Acme Group");
    const submit = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Submit to Contracting"
    );
    expect(submit).toBeDefined();
    await act(async () => submit?.click());
    expect(submitted).toEqual([{ queryId: "query-1" }]);

    await view.unmount();
  });

  test("Contracting preserves Contracting SPOC and With Sales handoff presentation", async () => {
    const view = await mount(
      <ContractingView
        canAssign={false}
        deleteItem={async () => undefined}
        has={() => false}
        openModal={() => undefined}
        proposals={[
          {
            id: "proposal-1",
            proposalCode: "P-0001",
            queryId: "query-1",
            status: "Sent",
            updatedAt: "2026-07-14",
          },
        ]}
        removeQuery={noopMutation}
        rows={[
          {
            clientName: "Acme Group",
            contractingOwnerName: "Cora Contracting",
            contractingStatus: "Proposal in progress",
            createdAt: "2026-07-14",
            id: "query-1",
            queryCode: "Q-0001",
            ticketingOwnerName: "Tina Ticketing",
            ticketingScope: "International",
          },
        ]}
        team={[]}
      />
    );

    expect(view.container.textContent).toContain("Contracting SPOC");
    expect(view.container.textContent).toContain("Cora Contracting");
    expect(view.container.textContent).toContain("With Sales");

    await view.unmount();
  });

  test("Proposals preserves With Sales and Finalized PDF presentation", async () => {
    const view = await mount(
      <ProposalsView
        deleteItem={async () => undefined}
        getFinalizedPdfUrl={noopUrl}
        getProposalAttachmentUrl={noopUrl}
        has={() => false}
        markProposalSent={noopMutation}
        openModal={() => undefined}
        removeProposal={noopMutation}
        rows={[
          {
            clientName: "Acme Group",
            createdAt: "2026-07-14",
            finalizedPdf: { fileName: "acme-final.pdf", uploadedAt: "2026-07-14" },
            id: "proposal-1",
            proposalCode: "P-0001",
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
});
