import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PipelineView } from "./PipelineView";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/pipeline",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
});

const noop = () => undefined;

afterAll(() => dom.window.close());

async function mount(moveSalesPipelineStage) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PipelineView
        canMoveSalesPipeline
        mode="sales"
        moveSalesPipelineStage={moveSalesPipelineStage}
        rows={[
          {
            clientName: "Acme Group",
            id: "query-1",
            leadStage: "Inquiry",
            queryCode: "Q-0001",
            salesStatus: "Proposal in discussion",
          },
          {
            clientName: "Terminal Group",
            id: "query-2",
            leadStage: "Confirmation",
            queryCode: "Q-0002",
            salesStatus: "Order Confirmed",
          },
        ]}
        setMode={noop}
      />
    )
  );
  return {
    container,
    unmount: async () => act(async () => root.unmount()),
  };
}

async function mountContracting(moveContractingPipelineStage) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PipelineView
        canMoveContractingPipeline
        mode="contracting"
        moveContractingPipelineStage={moveContractingPipelineStage}
        rows={[
          {
            clientName: "Ready Group",
            contractingStatus: "Proposal in progress",
            id: "query-c1",
            queryCode: "Q-0101",
          },
          {
            clientName: "Needs Proposal Group",
            contractingStatus: "Query Received",
            id: "query-c2",
            queryCode: "Q-0102",
          },
          {
            clientName: "Confirmed Group",
            contractingStatus: "Order Confirmed",
            id: "query-c3",
            queryCode: "Q-0103",
            salesStatus: "Order Confirmed",
          },
        ]}
        setMode={noop}
      />
    )
  );
  return {
    container,
    unmount: async () => act(async () => root.unmount()),
  };
}

describe("mounted Sales Pipeline movement", () => {
  test("offers pointer and keyboard movement only for safe routine stages", async () => {
    const calls = [];
    const view = await mount(async (args) => calls.push(args));
    const movable = view.container.querySelector('[data-pipeline-card-id="query-1"]');
    const terminal = view.container.querySelector('[data-pipeline-card-id="query-2"]');
    const select = movable?.querySelector("select");

    expect(movable?.getAttribute("draggable")).toBe("true");
    expect(terminal?.getAttribute("draggable")).toBe("false");
    expect(terminal?.querySelector("select")).toBeNull();
    expect([...select.options].map((option) => option.value)).toEqual(["", "Proposal"]);

    await act(async () => {
      select.value = "Proposal";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(calls).toEqual([
      { expectedLeadStage: "Inquiry", queryId: "query-1", targetStage: "Proposal" },
    ]);
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      "Moved Acme Group to Proposal"
    );
    expect(view.container.querySelector('[aria-label="Proposal stage"]')?.textContent).toContain(
      "Acme Group"
    );
    await view.unmount();
  });

  test("announces a stale failure and restores the original column", async () => {
    const view = await mount(() =>
      Promise.reject(new Error("Pipeline card is out of date. Refresh and try again."))
    );
    const select = view.container.querySelector('[data-pipeline-card-id="query-1"] select');

    await act(async () => {
      select.value = "Proposal";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      "Could not move Acme Group to Proposal"
    );
    expect(view.container.querySelector('[aria-label="Inquiry stage"]')?.textContent).toContain(
      "Acme Group"
    );
    await view.unmount();
  });
});

describe("mounted Contracting Pipeline movement", () => {
  test("offers pointer and keyboard handoff only after proposal creation", async () => {
    const calls = [];
    const view = await mountContracting(async (args) => calls.push(args));
    const ready = view.container.querySelector('[data-pipeline-card-id="query-c1"]');
    const needsProposal = view.container.querySelector('[data-pipeline-card-id="query-c2"]');
    const terminal = view.container.querySelector('[data-pipeline-card-id="query-c3"]');
    const select = ready?.querySelector("select");

    expect(ready?.getAttribute("draggable")).toBe("true");
    expect(needsProposal?.getAttribute("draggable")).toBe("false");
    expect(needsProposal?.querySelector("select")).toBeNull();
    expect(terminal?.getAttribute("draggable")).toBe("false");
    expect(terminal?.querySelector("select")).toBeNull();
    expect([...select.options].map((option) => option.value)).toEqual(["", "Proposal sent"]);

    await act(async () => {
      select.value = "Proposal sent";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(calls).toEqual([
      {
        expectedContractingStatus: "Proposal in progress",
        queryId: "query-c1",
        targetStage: "Proposal sent",
      },
    ]);
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      "Moved Ready Group to Proposal sent"
    );
    expect(
      view.container.querySelector('[aria-label="Proposal sent stage"]')?.textContent
    ).toContain("Ready Group");
    await view.unmount();
  });

  test("announces stale handoff failure and rolls back the Contracting column", async () => {
    const view = await mountContracting(() =>
      Promise.reject(new Error("Pipeline card is out of date. Refresh and try again."))
    );
    const select = view.container.querySelector('[data-pipeline-card-id="query-c1"] select');

    await act(async () => {
      select.value = "Proposal sent";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      "Could not move Ready Group to Proposal sent"
    );
    expect(
      view.container.querySelector('[aria-label="Proposal in progress stage"]')?.textContent
    ).toContain("Ready Group");
    await view.unmount();
  });
});
