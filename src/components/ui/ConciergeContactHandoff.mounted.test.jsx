import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import {
  buildConciergeHandoffPayload,
  buildSacredBharatHandoffPayload,
  CONCIERGE_HANDOFF_LAYOUT_SPRING,
  ConciergeContactHandoff,
  conciergeHandoffDisclosureMotion,
  SacredBharatContactHandoff,
} from "./ConciergeContactHandoff";

let createRoot;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/",
});
const originalFetch = globalThis.fetch;
const PRIVATE_STATE_PATTERN = /messages|progress|score|wishlist|private model/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.matchMedia = () => ({
    addEventListener() {
      // Motion subscribes to preference changes; this fixture stays non-reduced.
    },
    matches: false,
    removeEventListener() {
      // Motion cleanup mirrors the inert fixture subscription above.
    },
  });
  globalThis.matchMedia = dom.window.matchMedia;
  globalThis.ResizeObserver = class {
    disconnect() {
      // The fixture does not emit resize records.
    }
    observe() {
      // The fixture does not emit resize records.
    }
    unobserve() {
      // The fixture does not emit resize records.
    }
  };
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  ({ createRoot } = await import("react-dom/client"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  dom.window.sessionStorage.clear();
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
  test("uses the exact productive layout spring and reduced-motion disclosure recipe", () => {
    expect(CONCIERGE_HANDOFF_LAYOUT_SPRING).toEqual({
      damping: 33.161_255_787_892_26,
      stiffness: 304.617_419_786_708_64,
      type: "spring",
    });
    expect(conciergeHandoffDisclosureMotion(false)).toEqual({
      animate: { opacity: 1, transform: "translateY(0)" },
      exit: { opacity: 0, transform: "translateY(-4px)" },
      initial: { opacity: 0, transform: "translateY(-4px)" },
      transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
    });
    expect(conciergeHandoffDisclosureMotion(true)).toEqual({
      animate: { opacity: 1, transform: "none" },
      exit: { opacity: 0, transform: "none" },
      initial: { opacity: 0, transform: "none" },
      transition: { duration: 0.18, ease: "linear" },
    });
  });

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

  test("builds a canonical Sacred Bharat payload without AI or progress state", () => {
    const payload = buildSacredBharatHandoffPayload(
      {
        clientName: " Yatri ",
        consent: true,
        contactEmail: "YATRI@EXAMPLE.COM ",
        contactMobile: "",
        destination: " Shiva Trail ",
        messages: ["private model output"],
        paxCount: "4",
        progress: { score: 900 },
        travelStartDate: "2026-11-01",
        wishlist: ["shiva-trail"],
      },
      456,
      "",
      { entryPoint: "trail", templeId: "kedarnath", trailSlug: "shiva-trail" }
    );
    expect(payload).toEqual({
      clientName: "Yatri",
      consent: true,
      contactEmail: "yatri@example.com",
      destination: "Shiva Trail",
      formLoadedAt: 456,
      paxCount: 4,
      sacredBharatContext: { entryPoint: "trail", trailSlug: "shiva-trail" },
      source: "Sacred Bharat",
      travelStartDate: "2026-11-01",
    });
    expect(JSON.stringify(payload)).not.toMatch(PRIVATE_STATE_PATTERN);
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
    expect(toggle.getAttribute("aria-controls")).toBe(view.container.querySelector("form").id);
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

  test("retargets rapid disclosure changes while preserving form state and focus order", async () => {
    const view = await mount(<ConciergeContactHandoff />);
    let toggle = view.container.querySelector('button[aria-expanded="false"]');
    await act(async () => toggle.click());
    const name = view.container.querySelector('input[name="clientName"]');
    const setter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      "value"
    ).set;
    await act(() => {
      setter.call(name, "Traveller");
      name.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    expect(view.container.querySelector("form")).not.toBeNull();

    toggle = view.container.querySelector('button[aria-expanded="true"]');
    toggle.focus();
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const exitingForm = view.container.querySelector('[data-concierge-handoff-form=""]');
    expect(exitingForm === null || exitingForm.hasAttribute("inert")).toBe(true);
    expect(exitingForm === null || exitingForm.getAttribute("aria-hidden") === "true").toBe(true);
    expect(document.activeElement).toBe(toggle);

    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(view.container.querySelector('input[name="clientName"]').value).toBe("Traveller");
    expect(
      view.container.querySelector('[data-concierge-handoff-form=""]').hasAttribute("inert")
    ).toBe(false);

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
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].headers["Idempotency-Key"]).toBeTruthy();
    expect(view.container.querySelector('[role="status"]').textContent).toContain(
      "Request received"
    );

    await act(async () => view.root.unmount());
  });

  test("keeps Sacred Bharat planning explicit and submits only after consent", async () => {
    const requests = [];
    globalThis.fetch = (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { json: () => ({ accepted: true }), ok: true };
    };
    const view = await mount(
      <SacredBharatContactHandoff
        context={{ entryPoint: "journey_planner", templeId: "varanasi" }}
        triggerLabel="Plan this journey with Citius"
      />
    );
    expect(view.container.querySelector("form")).toBeNull();
    expect(view.container.textContent).toContain("Plan this journey with Citius");
    await act(async () => view.container.querySelector('button[aria-expanded="false"]').click());
    expect(view.container.textContent).toContain(
      "Your Soul Score, progress, wishlist, and AI journey text are not attached."
    );
    expect(view.container.querySelector('input[name="destination"]').value).toBe(
      "Kashi Vishwanath & Varanasi, Uttar Pradesh"
    );

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
      setValue("clientName", "Yatri");
      setValue("contactEmail", "yatri@example.com");
      view.container.querySelector('input[name="consent"]').click();
    });
    await act(async () => {
      view.container
        .querySelector("form")
        .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      sacredBharatContext: {
        entryPoint: "journey_planner",
        templeId: "kashi-vishwanath",
      },
      source: "Sacred Bharat",
    });
    expect(requests[0]).not.toHaveProperty("notes");
    expect(view.container.textContent).toContain("Planning request received");
    await act(async () => view.root.unmount());
  });

  test("reuses the Sacred Bharat UUID across a failed reload retry", async () => {
    const requests = [];
    const privateFailure = "provider secret-value escaped";
    globalThis.fetch = (_url, options) => {
      requests.push(options);
      return { json: () => ({ error: privateFailure }), ok: false, status: 502 };
    };
    const context = { entryPoint: "trail", trailSlug: "shiva-trail" };

    async function enterAndSubmit(view) {
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
        setValue("clientName", "Yatri");
        setValue("contactEmail", "yatri@example.com");
        view.container.querySelector('input[name="consent"]').click();
      });
      await act(async () => {
        view.container
          .querySelector("form")
          .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }

    const first = await mount(<SacredBharatContactHandoff context={context} />);
    await enterAndSubmit(first);
    expect(first.container.querySelector('[role="status"]').textContent).toContain(
      "Your details are still here"
    );
    expect(first.container.querySelector('[role="status"]').textContent).not.toContain(
      privateFailure
    );
    const replayRecord = dom.window.sessionStorage.getItem(
      "citius:sacred-intent:v1:trail:shiva-trail"
    );
    expect(replayRecord).not.toContain("Yatri");
    expect(replayRecord).not.toContain("yatri@example.com");
    expect(JSON.parse(replayRecord).fingerprint).toMatch(SHA256_PATTERN);
    await act(async () => first.root.unmount());
    first.container.remove();

    const reloaded = await mount(<SacredBharatContactHandoff context={context} />);
    await enterAndSubmit(reloaded);

    expect(requests).toHaveLength(2);
    expect(requests[1].headers["Idempotency-Key"]).toBe(requests[0].headers["Idempotency-Key"]);
    await act(async () => reloaded.root.unmount());
  });
});
