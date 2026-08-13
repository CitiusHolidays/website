import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";

let PipelineView;
let pipelineGeometryEnabled = false;
const STAGE_LABEL_SUFFIX = / stage$/;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/pipeline",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const originalGetBoundingClientRect = dom.window.HTMLElement.prototype.getBoundingClientRect;
  dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (!pipelineGeometryEnabled) {
      return originalGetBoundingClientRect.call(this);
    }
    const stageNames = ["Inquiry", "Proposal", "Negotiation", "Confirmation", "Lost"];
    const section = this.matches?.("section[aria-label$=' stage']")
      ? this
      : this.closest?.("section[aria-label$=' stage']");
    const stage = section?.getAttribute("aria-label")?.replace(STAGE_LABEL_SUFFIX, "");
    const stageIndex = stageNames.indexOf(stage);
    const stageLeft = stageIndex < 0 ? 0 : 296 + stageIndex * 224;
    const isCard = this.matches?.("[data-pipeline-card-id]");
    const left = isCard ? stageLeft + 16 : stageLeft;
    const top = isCard ? 308 : 180;
    const width = isCard ? 176 : 200;
    const height = isCard ? 182 : 3954;
    return {
      bottom: top + height,
      height,
      left,
      right: left + width,
      toJSON: () => undefined,
      top,
      width,
      x: left,
      y: top,
    };
  };
  ({ PipelineView } = await import("./PipelineView"));
});

const noop = () => undefined;

afterAll(() => dom.window.close());

async function mount(moveSalesPipelineStage, rows) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PipelineView
        canMoveSalesPipeline
        mode="sales"
        moveSalesPipelineStage={moveSalesPipelineStage}
        rows={
          rows ?? [
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
          ]
        }
        setMode={noop}
      />
    )
  );
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

async function mountContracting(moveContractingPipelineStage) {
  const container = document.createElement("div");
  document.body.append(container);
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
            proposalPreview: {
              handedOffRevision: null,
              proposalId: "proposal-c1",
              proposalRevision: 3,
            },
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
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

async function chooseStage(trigger, label) {
  await act(async () => {
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const option = [...document.body.querySelectorAll('[role="option"]')].find(
    (candidate) => candidate.textContent.trim() === label
  );
  expect(option).not.toBeUndefined();
  await act(async () => {
    option.click();
    await Promise.resolve();
  });
}

function pointerEvent(type, clientX, pointerType = "mouse") {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: 0 },
    isPrimary: { value: true },
    pointerType: { value: pointerType },
  });
  return event;
}

function touchEvent(type) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    changedTouches: { value: [{ clientX: 0, clientY: 0 }] },
    touches: { value: type === "touchend" ? [] : [{ clientX: 0, clientY: 0 }] },
  });
  return event;
}

async function cancelActiveDrag(card) {
  await act(async () => {
    card.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, code: "Escape", key: "Escape" })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function boundedPipelineRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    clientName: `Terminal Group ${index + 1}`,
    id: `query-bound-${count}-${index}`,
    leadStage: "Confirmation",
    queryCode: `Q-${count}-${index}`,
    salesStatus: "Order Confirmed",
  }));
}

function expectBoundedLayout(view, count) {
  expect(view.container.querySelectorAll('[data-pipeline-layout="bounded"]')).toHaveLength(count);
  expect(view.container.querySelectorAll('[data-pipeline-layout="shared"]')).toHaveLength(0);
}

describe("mounted Sales Pipeline movement", () => {
  test("bounds shared layout participation at realistic 50- and 100-card pages", async () => {
    const fifty = await mount(async () => undefined, boundedPipelineRows(50));
    expectBoundedLayout(fifty, 50);
    await fifty.unmount();

    const hundred = await mount(async () => undefined, boundedPipelineRows(100));
    expectBoundedLayout(hundred, 100);
    await hundred.unmount();

    const small = await mount(async () => undefined);
    expect(small.container.querySelectorAll('[data-pipeline-layout="shared"]')).toHaveLength(2);
    await small.unmount();
  });

  test("moves one adjacent stage by keyboard, never scales, drops once, and cancels", async () => {
    const proposalRow = {
      clientName: "Keyboard Group",
      id: "query-keyboard",
      leadStage: "Proposal",
      queryCode: "Q-0099",
      salesStatus: "Proposal in discussion",
    };

    pipelineGeometryEnabled = true;
    const rightCalls = [];
    const rightView = await mount(async (args) => rightCalls.push(args), [proposalRow]);
    const rightCard = rightView.container.querySelector('[data-pipeline-card-id="query-keyboard"]');
    rightCard?.focus();
    await act(async () => {
      rightCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      rightCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "ArrowRight", key: "ArrowRight" })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(rightCard?.style.transform).not.toContain("scale");
    expect(
      rightView.container.querySelector('[aria-label="Negotiation stage"]')?.className
    ).toContain("ring-2");
    await act(async () => {
      rightCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(rightCalls).toEqual([
      {
        expectedLeadStage: "Proposal",
        queryId: "query-keyboard",
        targetStage: "Negotiation",
      },
    ]);
    await rightView.unmount();

    const leftCalls = [];
    const leftView = await mount(async (args) => leftCalls.push(args), [proposalRow]);
    const leftCard = leftView.container.querySelector('[data-pipeline-card-id="query-keyboard"]');
    leftCard?.focus();
    await act(async () => {
      leftCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      leftCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "ArrowLeft", key: "ArrowLeft" })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      leftCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(leftCalls).toEqual([
      {
        expectedLeadStage: "Proposal",
        queryId: "query-keyboard",
        targetStage: "Inquiry",
      },
    ]);
    await leftView.unmount();

    const cancelCalls = [];
    const cancelView = await mount(async (args) => cancelCalls.push(args), [proposalRow]);
    const cancelCard = cancelView.container.querySelector(
      '[data-pipeline-card-id="query-keyboard"]'
    );
    cancelCard?.focus();
    await act(async () => {
      cancelCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      cancelCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "ArrowRight", key: "ArrowRight" })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      cancelCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Escape", key: "Escape" })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(cancelCalls).toEqual([]);
    expect(cancelCard?.hasAttribute("data-dnd-dragging")).toBe(false);
    await cancelView.unmount();
    pipelineGeometryEnabled = false;
  });

  test("activates pointer, touch, and keyboard sensors on non-interactive card content", async () => {
    const calls = [];

    const pointerView = await mount(async (args) => calls.push(args));
    const pointerCard = pointerView.container.querySelector('[data-pipeline-card-id="query-1"]');
    const pointerTarget = pointerCard?.querySelector("div");
    await act(async () => {
      pointerTarget?.dispatchEvent(pointerEvent("pointerdown", 0));
      document.dispatchEvent(pointerEvent("pointermove", 12));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(pointerCard?.getAttribute("data-dnd-dragging")).toBe("true");
    await cancelActiveDrag(pointerCard);
    await pointerView.unmount();

    const touchView = await mount(async (args) => calls.push(args));
    const touchCard = touchView.container.querySelector('[data-pipeline-card-id="query-1"]');
    const touchTarget = touchCard?.querySelector("div");
    await act(async () => {
      touchTarget?.dispatchEvent(touchEvent("touchstart"));
      await new Promise((resolve) => setTimeout(resolve, 225));
    });
    expect(touchCard?.getAttribute("data-dnd-dragging")).toBe("true");
    await cancelActiveDrag(touchCard);
    await touchView.unmount();

    const keyboardView = await mount(async (args) => calls.push(args));
    const keyboardCard = keyboardView.container.querySelector('[data-pipeline-card-id="query-1"]');
    keyboardCard?.focus();
    await act(async () => {
      keyboardCard?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(keyboardCard?.getAttribute("data-dnd-dragging")).toBe("true");
    await cancelActiveDrag(keyboardCard);
    await keyboardView.unmount();

    expect(calls).toEqual([]);
  });

  test("keeps nested copy and Select controls outside the drag activator", async () => {
    const calls = [];
    const view = await mount(async (args) => calls.push(args));
    const card = view.container.querySelector('[data-pipeline-card-id="query-1"]');
    const select = card?.querySelector('[role="combobox"]');
    const pointerDown = new Event("pointerdown", { bubbles: true });
    Object.defineProperties(pointerDown, {
      button: { value: 0 },
      isPrimary: { value: true },
      pointerType: { value: "mouse" },
    });

    await act(async () => {
      select?.dispatchEvent(pointerDown);
      select?.dispatchEvent(new Event("touchstart", { bubbles: true }));
      select?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(card?.hasAttribute("data-dnd-dragging")).toBe(false);
    expect(calls).toEqual([]);
    expect(select?.getAttribute("aria-expanded")).toBe("false");
    await view.unmount();
  });

  test("offers pointer and keyboard movement only for safe routine stages", async () => {
    const calls = [];
    const view = await mount(async (args) => calls.push(args));
    const movable = view.container.querySelector('[data-pipeline-card-id="query-1"]');
    const terminal = view.container.querySelector('[data-pipeline-card-id="query-2"]');
    const select = movable?.querySelector('[role="combobox"]');

    expect(movable?.hasAttribute("draggable")).toBe(false);
    expect(movable?.getAttribute("role")).toBe("group");
    expect(movable?.getAttribute("aria-roledescription")).toBe("draggable pipeline card");
    expect(movable?.getAttribute("tabindex")).toBe("0");
    expect(terminal?.hasAttribute("draggable")).toBe(false);
    expect(terminal?.getAttribute("role")).toBeNull();
    expect(terminal?.querySelector('[role="combobox"]')).toBeNull();
    expect(select.textContent).toContain("Select stage…");

    await act(async () => {
      terminal?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " })
      );
      terminal?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "ArrowLeft", key: "ArrowLeft" })
      );
      terminal?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, code: "Space", key: " " })
      );
      await Promise.resolve();
    });
    expect(calls).toEqual([]);

    await chooseStage(select, "Proposal");

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
    const select = view.container.querySelector(
      '[data-pipeline-card-id="query-1"] [role="combobox"]'
    );

    await chooseStage(select, "Proposal");

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
    const select = ready?.querySelector('[role="combobox"]');

    expect(ready?.hasAttribute("draggable")).toBe(false);
    expect(ready?.getAttribute("role")).toBe("group");
    expect(ready?.getAttribute("aria-roledescription")).toBe("draggable pipeline card");
    expect(ready?.getAttribute("tabindex")).toBe("0");
    expect(needsProposal?.hasAttribute("draggable")).toBe(false);
    expect(needsProposal?.getAttribute("role")).toBeNull();
    expect(needsProposal?.querySelector('[role="combobox"]')).toBeNull();
    expect(terminal?.hasAttribute("draggable")).toBe(false);
    expect(terminal?.getAttribute("role")).toBeNull();
    expect(terminal?.querySelector('[role="combobox"]')).toBeNull();
    expect(select.textContent).toContain("Select stage…");

    await chooseStage(select, "Proposal sent");

    expect(calls).toEqual([
      {
        expectedContractingStatus: "Proposal in progress",
        proposalId: "proposal-c1",
        proposalRevision: 3,
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
    const select = view.container.querySelector(
      '[data-pipeline-card-id="query-c1"] [role="combobox"]'
    );

    await chooseStage(select, "Proposal sent");

    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(
      "Could not move Ready Group to Proposal sent"
    );
    expect(
      view.container.querySelector('[aria-label="Proposal in progress stage"]')?.textContent
    ).toContain("Ready Group");
    await view.unmount();
  });
});
