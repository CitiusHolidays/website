import { afterAll, afterEach, beforeAll, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal/job-cards/jc-1",
});
const mutationCalls = [];
let data;

mock.module("@convex/_generated/api", () => ({
  api: {
    customerTripInvites: { createInvites: "createInvites", listForJobCard: "listForJobCard" },
  },
}));
mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
  useTrackedQuery: () => data,
}));
mock.module("convex/react", () => ({
  useMutation: (reference) => (args) => {
    mutationCalls.push({ args, reference });
    return Promise.resolve([]);
  },
}));

const HASH = /^[0-9a-f]{64}$/;
const RAVI_LINK = /Ravi Testguest:\s*https:\/\/citius\.test\/app\/invite#token=[\w-]{43}/;

let JobCardCustomerInvites;
let createRoot;
beforeAll(async () => {
  Object.assign(globalThis, {
    document: dom.window.document,
    Element: dom.window.Element,
    Event: dom.window.Event,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    MouseEvent: dom.window.MouseEvent,
    Node: dom.window.Node,
    window: dom.window,
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ JobCardCustomerInvites } = await import("./JobCardCustomerInvites"));
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});
afterEach(() => {
  mutationCalls.length = 0;
  document.body.replaceChildren();
});

const rows = [
  {
    appAccess: "joined",
    fullName: "Asha Testguest",
    invite: null,
    inviteBlockedReason: null,
    isMinor: false,
    travellerId: "t-asha",
  },
  {
    appAccess: "none",
    fullName: "Kiran Testguest",
    invite: null,
    inviteBlockedReason: "minor",
    isMinor: true,
    travellerId: "t-kiran",
  },
  {
    appAccess: "none",
    fullName: "Mira Unrecorded",
    invite: null,
    inviteBlockedReason: "age_not_recorded",
    isMinor: false,
    travellerId: "t-mira",
  },
  {
    appAccess: "none",
    fullName: "Ravi Testguest",
    invite: null,
    inviteBlockedReason: null,
    isMinor: false,
    travellerId: "t-ravi",
  },
];

async function mount() {
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(() => {
    root.render(<JobCardCustomerInvites jobCardId="jc-1" />);
  });
  return node;
}

function button(node, text) {
  return Array.from(node.querySelectorAll("button")).find((candidate) =>
    candidate.textContent.includes(text)
  );
}

async function click(element) {
  await act(async () => {
    element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test("lists who uses the app and never offers a minor or an unrecorded age a link", async () => {
  data = { canInvite: true, rows };
  const node = await mount();
  expect(node.textContent).toContain("1 of 2 adults use the Citius Holidays app");
  expect(node.textContent).toContain("Minor, seen by their guardian");
  expect(node.textContent).toContain("Age not recorded: mark them adult to invite");
  expect(node.querySelector('[aria-label="Select Kiran Testguest"]')).toBeNull();
  expect(node.querySelector('[aria-label="Select Mira Unrecorded"]')).toBeNull();
  expect(node.querySelector('[aria-label="Select Ravi Testguest"]')).not.toBeNull();
});

test("creates links for the adults not invited and sends only token hashes", async () => {
  data = { canInvite: true, rows };
  const node = await mount();
  await click(button(node, "Select not invited"));
  await click(button(node, "Create 1 invite link"));
  expect(mutationCalls).toHaveLength(1);
  const [{ args, reference }] = mutationCalls;
  expect(reference).toBe("createInvites");
  expect(args.invites).toEqual([{ tokenHash: expect.stringMatching(HASH), travellerId: "t-ravi" }]);
  expect(node.textContent).toMatch(RAVI_LINK);
  expect(node.textContent).not.toContain(args.invites[0].tokenHash);
});

test("a caller who cannot invite sees the list without controls", async () => {
  data = { canInvite: false, rows };
  const node = await mount();
  expect(node.querySelectorAll("button")).toHaveLength(0);
  expect(node.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
});

test("a refused clipboard write tells the coordinator to copy the listed links", async () => {
  data = { canInvite: true, rows };
  const clipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.reject(new Error("NotAllowedError")) },
  });
  try {
    const node = await mount();
    await click(button(node, "Select not invited"));
    await click(button(node, "Create 1 invite link"));
    await click(button(node, "Copy all"));
    expect(node.querySelector('[role="alert"]')?.textContent).toBe(
      "The links could not be copied. Copy them from the list instead."
    );
    expect(node.textContent).not.toContain("Links copied.");
    expect(node.textContent).toMatch(RAVI_LINK);
  } finally {
    if (clipboard) {
      Object.defineProperty(globalThis.navigator, "clipboard", clipboard);
    } else {
      Reflect.deleteProperty(globalThis.navigator, "clipboard");
    }
  }
});
