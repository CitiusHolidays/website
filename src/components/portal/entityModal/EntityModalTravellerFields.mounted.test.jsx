import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal/operations/travellers",
});
const nothing = () => undefined;
const RECORDED_AT = "2026-11-07T12:00:00.000Z";

let createRoot;
let EntityModalTravellerFields;

beforeAll(async () => {
  mock.module("convex/react", () => ({
    useAction: () => async () => undefined,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useMutation: () => async () => undefined,
    usePaginatedQuery: () => ({ loadMore: nothing, results: [], status: "Exhausted" }),
    useQuery: (_ref, args) =>
      args === "skip" ? undefined : [{ fullName: "Meera Iyer", id: "g1" }],
  }));
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.HTMLElement.prototype.scrollIntoView = nothing;
  const matchMedia = (query) => ({
    addEventListener: nothing,
    addListener: nothing,
    dispatchEvent: () => false,
    matches: false,
    media: String(query),
    onchange: null,
    removeEventListener: nothing,
    removeListener: nothing,
  });
  globalThis.matchMedia = matchMedia;
  dom.window.matchMedia = matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ EntityModalTravellerFields } = await import("./EntityModalTravellerFields"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

function Editor({ initial, updates }) {
  const [form, setForm] = useState(initial);
  return (
    <EntityModalTravellerFields
      form={form}
      handleJobCardSelect={nothing}
      jobCards={[]}
      modal="traveller"
      updateForm={(field, value) => {
        updates.push([field, value]);
        setForm((current) => ({ ...current, [field]: value }));
      }}
    />
  );
}

async function mountEditor(initial) {
  const updates = [];
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Editor initial={initial} updates={updates} />));
  const unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { container, unmount, updates };
}

function consentControl() {
  const label = Array.from(document.querySelectorAll("label")).find(
    (node) => node.textContent.trim() === "Parental consent"
  );
  return label ? document.getElementById(label.htmlFor) : null;
}

function consentNote() {
  const label = Array.from(document.querySelectorAll("label")).find((node) =>
    node.textContent.startsWith("Consent note")
  );
  return label ? document.getElementById(label.htmlFor) : null;
}

async function chooseConsent(optionLabel) {
  const trigger = consentControl();
  expect(trigger).not.toBeNull();
  await act(async () =>
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }))
  );
  const option = Array.from(document.querySelectorAll('[role="option"]')).find(
    (node) => node.textContent.trim() === optionLabel
  );
  expect(option).toBeDefined();
  await act(async () => option.click());
}

const minor = {
  ageGroup: "minor",
  entityId: "t1",
  fullName: "Kavya Iyer",
  jobCardId: "",
};

describe("Traveller editor parental consent", () => {
  test("shows who recorded consent and when, and clears it", async () => {
    const editor = await mountEditor({
      ...minor,
      initialParentalConsent: "received",
      parentalConsent: "received",
      parentalConsentNote: "Signed form from Meera Iyer",
      parentalConsentReceivedAt: RECORDED_AT,
      parentalConsentRecordedByName: "Synthetic Ops Lead",
    });
    const section = editor.container.textContent;
    expect(section).toContain("Recorded by Synthetic Ops Lead on 07/11/2026");
    expect(consentNote()?.value).toBe("Signed form from Meera Iyer");

    await chooseConsent("Pending");
    expect(editor.updates.at(-1)).toEqual(["parentalConsent", "pending"]);
    expect(editor.container.textContent).not.toContain("Recorded by");
    expect(editor.container.textContent).toContain("Saving clears the recorded consent.");
    expect(consentNote()).toBeNull();
    await editor.unmount();
  });

  test("sets consent on a minor and says it is recorded on saving", async () => {
    const editor = await mountEditor({ ...minor, parentalConsent: "pending" });
    expect(editor.container.textContent).not.toContain("Recorded by");

    await chooseConsent("Received");
    expect(editor.updates.at(-1)).toEqual(["parentalConsent", "received"]);
    expect(editor.container.textContent).toContain(
      "Saving records your name and the current time."
    );
    expect(editor.container.textContent).toContain("Consent note");
    await editor.unmount();
  });

  test("offers no consent control unless the traveller is a minor", async () => {
    for (const ageGroup of ["adult", ""]) {
      // biome-ignore lint/performance/noAwaitInLoops: each age group mounts and unmounts in turn.
      const editor = await mountEditor({ ...minor, ageGroup, parentalConsent: "received" });
      expect(consentControl()).toBeNull();
      expect(editor.container.textContent).not.toContain("Parental consent");
      await editor.unmount();
    }
  });
});
