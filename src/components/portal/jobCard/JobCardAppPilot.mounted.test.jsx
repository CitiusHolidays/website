import { afterAll, afterEach, beforeAll, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citius.test/portal/job-cards/jc-1",
});
const mutationCalls = [];
let pilot;
let mutationResult = () => Promise.resolve(null);

mock.module("@convex/_generated/api", () => ({
  api: { crm: { jobCards: { getAppPilot: "getAppPilot", setAppPilot: "setAppPilot" } } },
}));
mock.module("@/lib/portal/trackedConvexSubscriptions", () => ({
  useTrackedQuery: () => pilot,
}));
mock.module("convex/react", () => ({
  useMutation: (reference) => (args) => {
    mutationCalls.push({ args, reference });
    return mutationResult();
  },
}));

let JobCardAppPilot;
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
  ({ JobCardAppPilot } = await import("./JobCardAppPilot"));
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});
afterEach(() => {
  mutationCalls.length = 0;
  mutationResult = () => Promise.resolve(null);
  document.body.replaceChildren();
});

async function mount() {
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  await act(() => {
    root.render(<JobCardAppPilot jobCardId="jc-1" />);
  });
  return node;
}

function button(node, label) {
  return Array.from(node.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label
  );
}

async function click(element) {
  await act(async () => {
    element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

test("renders nothing for a caller who cannot see the Job Card", async () => {
  pilot = null;
  const node = await mount();
  expect(node.textContent).toBe("");
});

test("an off trip offers Start pilot and starts it without asking", async () => {
  pilot = { canManage: true, changedAt: null, changedByName: null, enabled: false };
  const node = await mount();
  expect(node.textContent).toContain("Tour manager app pilot");
  expect(node.textContent).toContain("Off");
  expect(node.textContent).toContain("Tour managers do not see this trip in the app");
  await click(button(node, "Start pilot"));
  expect(mutationCalls).toEqual([
    { args: { enabled: true, jobCardId: "jc-1" }, reference: "setAppPilot" },
  ]);
  expect(node.textContent).toContain("Pilot started.");
});

test("stopping asks first, explains the trip leaves phones, and can be kept running", async () => {
  pilot = {
    canManage: true,
    changedAt: Date.parse("2026-11-07T04:30:00Z"),
    changedByName: "Synthetic Ops Head",
    enabled: true,
  };
  const node = await mount();
  expect(node.textContent).toContain("On");
  expect(node.textContent).toContain("Started by Synthetic Ops Head");

  await click(button(node, "Stop pilot"));
  expect(mutationCalls).toEqual([]);
  expect(node.textContent).toContain("disappears from tour managers' phones");
  await click(button(node, "Keep it running"));
  expect(mutationCalls).toEqual([]);
  expect(node.textContent).not.toContain("disappears from tour managers' phones");

  await click(button(node, "Stop pilot"));
  await click(button(node, "Stop pilot"));
  expect(mutationCalls).toEqual([
    { args: { enabled: false, jobCardId: "jc-1" }, reference: "setAppPilot" },
  ]);
  expect(node.textContent).toContain("Pilot stopped.");
});

test("a caller who cannot switch it sees the state and who can", async () => {
  pilot = {
    canManage: false,
    changedAt: Date.parse("2026-11-07T04:30:00Z"),
    changedByName: "Synthetic Director",
    enabled: false,
  };
  const node = await mount();
  expect(node.textContent).toContain("Stopped by Synthetic Director");
  expect(node.querySelectorAll("button")).toHaveLength(0);
  expect(node.textContent).toContain("Operations owner can change it");
});

test("a refused change shows who may switch it", async () => {
  const { ConvexError } = await import("convex/values");
  pilot = { canManage: true, changedAt: null, changedByName: null, enabled: false };
  mutationResult = () => Promise.reject(new ConvexError("FORBIDDEN"));
  const node = await mount();
  await click(button(node, "Start pilot"));
  expect(node.querySelector('[role="alert"]')?.textContent).toContain(
    "Only the Operations Head, directors, admins"
  );
});
