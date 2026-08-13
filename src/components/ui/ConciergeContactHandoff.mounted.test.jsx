import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { buildConciergeHandoffPayload, ConciergeContactHandoff } from "./ConciergeContactHandoff";

let createRoot;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/",
});
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  ({ createRoot } = await import("react-dom/client"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  document.body.replaceChildren();
});
afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, root };
}

describe("Concierge contact handoff", () => {
  test("builds a bounded structured payload without conversation content", () => {
    const payload = buildConciergeHandoffPayload(
      {
        clientName: " Traveller ",
        consent: true,
        contactEmail: "TRAVELLER@EXAMPLE.COM ",
        contactMobile: "",
        destination: " Kerala ",
        paxCount: "2",
        travelStartDate: "2026-10-12",
      },
      123,
      ""
    );
    expect(payload).toEqual({
      clientName: "Traveller",
      consent: true,
      contactEmail: "traveller@example.com",
      destination: "Kerala",
      formLoadedAt: 123,
      paxCount: 2,
      source: "Citius Concierge",
      travelStartDate: "2026-10-12",
    });
    expect(JSON.stringify(payload)).not.toContain("transcript");
    expect(JSON.stringify(payload)).not.toContain("messages");
  });

  test("requires explicit contact fields and affirmative consent in the mounted surface", async () => {
    const requests = [];
    globalThis.fetch = (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { json: () => ({ accepted: true }), ok: true };
    };
    const view = await mount(<ConciergeContactHandoff />);
    const toggle = view.container.querySelector('button[aria-expanded="false"]');
    await act(async () => toggle.click());
    expect(view.container.textContent).toContain("Your Concierge conversation is not attached.");
    expect(view.container.firstElementChild.className).toContain("overflow-y-auto");
    expect(view.container.firstElementChild.className).toContain("max-h-[55dvh]");

    const form = view.container.querySelector("form");
    await act(async () =>
      form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(requests).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const name = view.container.querySelector('input[name="clientName"]');
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute("autocomplete")).toBe("name");
    expect(name.getAttribute("aria-describedby")).toBe("concierge-name-error");
    expect(view.container.querySelector('input[name="contactEmail"]').autocomplete).toBe("email");
    expect(view.container.querySelector('input[name="contactMobile"]').autocomplete).toBe("tel");
    expect(view.container.querySelector('[role="status"]').textContent).toContain(
      "Please correct the highlighted fields."
    );
    expect(view.container.querySelector('input[name="consent"][type="checkbox"]')).not.toBeNull();
    expect(view.container.querySelector("textarea")).toBeNull();

    await act(async () => view.root.unmount());
  });

  test("uses one stable idempotency key for the durable request", async () => {
    const requests = [];
    globalThis.fetch = (_url, options) => {
      requests.push(options);
      return { json: () => ({ accepted: true }), ok: true };
    };
    const view = await mount(<ConciergeContactHandoff />);
    await act(async () => view.container.querySelector('button[aria-expanded="false"]').click());

    const setValue = (name, value) => {
      const input = view.container.querySelector(`[name="${name}"]`);
      const setter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value"
      ).set;
      setter.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    };
    await act(() => {
      setValue("clientName", "Traveller");
      setValue("contactEmail", "traveller@example.com");
      view.container.querySelector('input[name="consent"]').click();
    });
    await act(async () => {
      view.container
        .querySelector("form")
        .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      view.container
        .querySelector("form")
        .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].headers["Idempotency-Key"]).toBeTruthy();
    expect(view.container.querySelector('[role="status"]').textContent).toContain(
      "Request received"
    );

    await act(async () => view.root.unmount());
  });
});
