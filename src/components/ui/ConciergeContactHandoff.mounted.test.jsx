import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { buildConciergeHandoffPayload, ConciergeContactHandoff } from "./ConciergeContactHandoff";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
});

afterEach(() => document.body.replaceChildren());
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
    expect(view.container.textContent).toContain(
      "Add your name and either an email or mobile number."
    );
    expect(view.container.querySelector('input[name="consent"][type="checkbox"]')).not.toBeNull();
    expect(view.container.querySelector("textarea")).toBeNull();

    await act(async () => view.root.unmount());
  });
});
