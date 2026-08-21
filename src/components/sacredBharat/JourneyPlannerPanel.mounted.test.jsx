import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/sacred-bharat",
});
let createRoot;
let JourneyPlannerPanel;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  mock.module("./SacredBharatProvider", () => ({
    useSacredBharatContext: () => ({
      progress: { wishlist: [] },
      visitedTempleIds: [],
    }),
  }));
  mock.module("@/lib/sacredBharat/journeyPlannerStream", () => ({
    streamJourneyPlannerResponse: ({ onMessage }) => {
      const message = {
        id: "journey-planner-test",
        parts: [{ id: "status-1", status: "complete", type: "status" }],
        terminalState: "complete",
      };
      onMessage(message);
      return { message, streamedVisibleText: true, streamHadError: false };
    },
  }));
  ({ createRoot } = await import("react-dom/client"));
  ({ default: JourneyPlannerPanel } = await import("./JourneyPlannerPanel"));
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

describe("Mounted Sacred Bharat Journey Planner handoff", () => {
  test("Offers Sales contact only after a plan completes and binds the selected temple", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<JourneyPlannerPanel />));
    expect(container.textContent).not.toContain("Plan this route with Citius");

    const plannerButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Plan my route with AI")
    );
    expect(plannerButton).toBeDefined();
    await act(async () => {
      plannerButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Journey details prepared");
    const handoffButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Plan this route with Citius")
    );
    expect(handoffButton).toBeDefined();
    expect(container.querySelector("form")).toBeNull();
    await act(async () => handoffButton.click());
    expect(container.querySelector('input[name="destination"]')?.value).toBe(
      "Tirumala Venkateswara, Andhra Pradesh"
    );

    await act(async () => root.unmount());
    container.remove();
  });
});
