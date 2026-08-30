import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act } from "react";

const revokeCalls = [];
let revokeAttempts = 0;
const noop = () => undefined;

mock.module("convex/react", () => ({
  useMutation: (reference) => {
    const name = getFunctionName(reference);
    if (name === "customerConfirmedTrips:revokeConfirmedTripEntitlement") {
      return (args) => {
        revokeCalls.push(args);
        revokeAttempts += 1;
        if (revokeAttempts === 1) {
          return Promise.reject(new Error("Network reply unavailable"));
        }
        return Promise.resolve();
      };
    }
    return () => Promise.resolve();
  },
  usePaginatedQuery: (reference) => {
    const name = getFunctionName(reference);
    if (name === "customerConfirmedTrips:listConfirmedTripAccess") {
      return {
        loadMore: () => undefined,
        results: [
          {
            accountHolder: {
              email: "traveller@example.com",
              id: "profile-1",
              name: "Priya Traveller",
            },
            grantedAt: 1,
            grantedBy: "Asha Admin",
            id: "entitlement-1",
            lastChange: null,
            role: "organizer",
            source: "crm_operator_grant",
            status: "active",
          },
        ],
        status: "Exhausted",
      };
    }
    return { loadMore: () => undefined, results: [], status: "Exhausted" };
  },
  useQuery: () => ({
    destination: "Ladakh",
    queryCode: "Q-0001",
    travelEndDate: "2026-09-08",
    travelStartDate: "2026-09-01",
  }),
}));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal/queries",
});

let createRoot;
let CustomerJourneyAccessManager;
let PortalToastProvider;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  globalThis.matchMedia = matchMedia;
  dom.window.matchMedia = matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
  ({ CustomerJourneyAccessManager } = await import("./CustomerJourneyAccessManager"));
});

afterEach(() => {
  document.body.replaceChildren();
  revokeAttempts = 0;
  revokeCalls.length = 0;
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

const flushDialog = () => act(async () => new Promise((resolve) => setTimeout(resolve, 350)));

describe("CustomerJourneyAccessManager", () => {
  test("Reuses the same command ID after an ambiguous revoke failure", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalToastProvider>
          <CustomerJourneyAccessManager onClose={noop} open queryId="query-1" />
        </PortalToastProvider>
      )
    );
    await flushDialog();

    const dialog = document.querySelector('[role="dialog"]');
    const reason = dialog?.querySelector("#customer-journey-access-reason");
    expect(reason).toBeDefined();
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        dom.window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setValue?.call(reason, "Customer requested access removal");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const revoke = [...dialog.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Revoke access"
    );
    expect(revoke?.disabled).toBe(false);

    await act(async () => revoke?.click());
    await flushDialog();
    await act(async () => revoke?.click());
    await flushDialog();

    expect(revokeCalls).toHaveLength(2);
    expect(revokeCalls[0].commandId).toBe(revokeCalls[1].commandId);
    expect(revokeCalls[0]).toMatchObject({
      entitlementId: "entitlement-1",
      queryId: "query-1",
      reason: "Customer requested access removal",
    });

    await act(async () => root.unmount());
    container.remove();
  });
});
