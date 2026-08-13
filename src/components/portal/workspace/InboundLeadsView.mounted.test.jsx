import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/inbound-leads",
});

let InboundLeadsView;
let createRoot;
let selectedIntent;
const convert = mock(async () => ({ queryCode: "Q-0042" }));
const dismiss = mock(async () => ({ status: "dismissed" }));
const replace = mock(() => undefined);

function lead(overrides = {}) {
  return {
    _creationTime: 1,
    _id: "inboundQueryIntents_1",
    clientName: "A Traveller",
    consentAt: 1,
    createdAt: 1,
    notes: "Short source note",
    paxCount: 2,
    source: "Citius Concierge",
    status: "pending",
    ...overrides,
  };
}

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  globalThis.InputEvent = dom.window.InputEvent;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  ({ createRoot } = await import("react-dom/client"));

  mock.module("convex/react", () => ({
    useMutation: (reference) =>
      getFunctionName(reference) === "crm/inboundQueryIntents:dismiss" ? dismiss : convert,
    usePaginatedQuery: () => ({
      loadMore: () => undefined,
      results: selectedIntent ? [selectedIntent] : [],
      status: "Exhausted",
    }),
    useQuery: () => selectedIntent,
  }));
  mock.module("next/navigation", () => ({
    useRouter: () => ({ replace }),
    useSearchParams: () => new URLSearchParams("open=inboundIntent&id=inboundQueryIntents_1"),
  }));
  ({ InboundLeadsView } = await import("./InboundLeadsView"));
});

beforeEach(() => {
  selectedIntent = lead();
  convert.mockClear();
  dismiss.mockClear();
  replace.mockClear();
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<InboundLeadsView allowed canFetch />));
  return {
    container,
    rerender: async () => {
      await act(async () => root.render(<InboundLeadsView allowed canFetch />));
    },
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("InboundLeadsView conversion", () => {
  test("keeps over-limit source notes visible and requires compliant Query Notes", async () => {
    const longNotes = Array.from({ length: 31 }, (_, index) => `source${index + 1}`).join(" ");
    selectedIntent = lead({ notes: longNotes });
    const view = await mount();
    const notes = view.container.querySelector("textarea");

    expect(view.container.textContent).toContain(longNotes);
    expect(notes?.value).toBe("");
    expect(view.container.textContent).toContain(
      "Source notes exceed the 30-word Query Notes limit"
    );

    const invalidNotes = Array.from({ length: 31 }, (_, index) => `query${index + 1}`).join(" ");
    await act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(notes, invalidNotes);
      notes?.dispatchEvent(
        new InputEvent("input", { bubbles: true, data: invalidNotes, inputType: "insertText" })
      );
      notes?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const submit = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Convert to Query")
    );
    await act(async () => submit?.click());

    expect(convert).not.toHaveBeenCalled();
    expect(notes?.getAttribute("aria-invalid")).toBe("true");
    expect(view.container.textContent).toContain("Query Notes must be 30 words or fewer");

    await view.unmount();
  });

  test("keeps conversion success visible when the selected lead reactively becomes converted", async () => {
    const view = await mount();
    const submit = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Convert to Query")
    );

    await act(async () => submit?.click());
    expect(view.container.textContent).toContain("Q-0042 created and linked to this inbound lead.");

    selectedIntent = lead({ status: "converted" });
    await view.rerender();

    expect(view.container.textContent).toContain("Q-0042 created and linked to this inbound lead.");
    expect(replace).toHaveBeenCalledWith("/portal/inbound-leads");

    await view.unmount();
  });

  test("dismisses a pending lead with the bounded default reason and preserves the outcome", async () => {
    selectedIntent = lead({ source: "Website" });
    const view = await mount();
    const dismissButton = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Dismiss lead")
    );

    await act(async () => dismissButton?.click());
    expect(dismiss).toHaveBeenCalledWith({
      dismissalReason: "not_qualified",
      intentId: "inboundQueryIntents_1",
    });
    expect(view.container.textContent).toContain(
      "Lead dismissed. Its consent and source record remain available."
    );

    selectedIntent = lead({
      dismissalReason: "not_qualified",
      status: "dismissed",
      triagedAt: Date.parse("2026-08-12T12:00:00.000Z"),
    });
    await view.rerender();
    expect(view.container.textContent).toContain("Reason: Not qualified.");
    expect(view.container.textContent).toContain("Outcome recorded: 12/08/2026.");
    expect(replace).toHaveBeenCalledWith("/portal/inbound-leads");

    await view.unmount();
  });
});
