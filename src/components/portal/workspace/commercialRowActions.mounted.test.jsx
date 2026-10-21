import { afterAll, beforeAll, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal",
});
let ContractingView, ProposalsView, PortalToastProvider, createRoot;
beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "MutationObserver",
  ]) {
    globalThis[key] = key === "window" ? dom.window : dom.window[key];
  }
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  ({ createRoot } = await import("react-dom/client"));
  ({ PortalToastProvider } = await import("../PortalToast"));
  ({ ContractingView } = await import("./ContractingView"));
  ({ ProposalsView } = await import("./ProposalsView"));
});
afterAll(() => dom.window.close());
const noop = () => undefined;
const noopMutation = async () => undefined;
const noopUrl = async () => "https://example.invalid/file";
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
async function choose(view, row, label) {
  const more = view.container.querySelector(`[aria-label="More actions for ${row}"]`);
  await act(async () => {
    more.focus();
    more.dispatchEvent(new window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  const item = [...document.querySelectorAll('[role="menuitem"]')].find(
    (node) => node.textContent.trim() === label
  );
  expect(item).toBeDefined();
  await act(async () => item.click());
}

test("Proposal overflow retains exact edit, collaborator and guarded-deletion targets", async () => {
  const opened = [],
    deleted = [];
  const view = await mount(
    <ProposalsView
      deleteItem={(label, _action, args) => deleted.push({ args, label })}
      getFinalizedPdfUrl={noopUrl}
      getProposalAttachmentUrl={noopUrl}
      has={(permission) => permission === P.MANAGE_PROPOSALS}
      openModal={(modal, initial) => opened.push({ initial, modal })}
      removeProposal={noopMutation}
      rows={[
        {
          hasCollaborators: true,
          id: "proposal-2",
          proposalCode: "P-0002",
          proposalRevision: 2,
          status: "Sent",
        },
      ]}
      sendProposalToSales={noopMutation}
    />
  );
  await choose(view, "P-0002", "Edit");
  await choose(view, "P-0002", "Invite collaborator");
  await choose(view, "P-0002", "Unshare");
  await choose(view, "P-0002", "Delete");
  expect(opened).toEqual([
    { initial: { entityId: "proposal-2", focusedDetailType: "proposal" }, modal: "proposal" },
    {
      initial: { proposalId: "proposal-2", queryCode: "P-0002" },
      modal: "addProposalCollaborator",
    },
    {
      initial: { proposalId: "proposal-2", queryCode: "P-0002" },
      modal: "removeProposalCollaborator",
    },
  ]);
  expect(deleted).toEqual([{ args: { proposalId: "proposal-2" }, label: "P-0002" }]);
  expect(view.container.querySelector('[aria-label^="Send to Sales"]')).toBeNull();
  await view.unmount();
});

test("Contracting keeps unassigned-head allocation primary and exact secondary actions", async () => {
  const opened = [],
    deleted = [];
  const view = await mount(
    <ContractingView
      access={{ roles: ["Admin"] }}
      canAssign
      deleteItem={(label, _action, args) => deleted.push({ args, label })}
      has={() => true}
      openModal={(modal, initial) => opened.push({ initial, modal })}
      removeQuery={noopMutation}
      rows={[
        {
          clientName: "Synthetic",
          contractingStatus: "Query Received",
          id: "query-2",
          queryCode: "Q-0002",
          salesStatus: "Proposal in discussion",
        },
      ]}
      team={[]}
    />
  );
  const assign = [...view.container.querySelectorAll("button")].find(
    (node) => node.textContent === "Assign"
  );
  await act(async () => assign.click());
  expect(opened[0]).toEqual({ initial: { queryId: "query-2" }, modal: "assignQueryTeams" });
  await choose(view, "Q-0002", "Files");
  await choose(view, "Q-0002", "Status");
  await choose(view, "Q-0002", "Delete");
  expect(opened[1]).toEqual({
    initial: { entityId: "query-2", entryPoint: "query" },
    modal: "commercialFiles",
  });
  expect(opened[2].modal).toBe("queryStatus");
  expect(opened[2].initial.queryId).toBe("query-2");
  expect(deleted).toEqual([{ args: { queryId: "query-2" }, label: "Q-0002" }]);
  await view.unmount();
});

test("read-only Proposal viewers keep Files without management actions", async () => {
  const opened = [];
  const view = await mount(
    <ProposalsView
      deleteItem={noop}
      getFinalizedPdfUrl={noopUrl}
      getProposalAttachmentUrl={noopUrl}
      has={() => false}
      openModal={(modal, initial) => opened.push({ initial, modal })}
      removeProposal={noopMutation}
      rows={[
        {
          id: "proposal-3",
          proposalCode: "P-0003",
          proposalRevision: 1,
          queryId: "query-3",
          status: "Draft",
        },
      ]}
      sendProposalToSales={noopMutation}
    />
  );
  expect(view.container.querySelector('[aria-label^="More actions"]')).toBeNull();
  const files = [...view.container.querySelectorAll("button")].find(
    (node) => node.textContent === "Files"
  );
  await act(async () => files.click());
  expect(opened).toEqual([
    { initial: { entityId: "proposal-3", entryPoint: "proposal" }, modal: "commercialFiles" },
  ]);
  await view.unmount();
});
