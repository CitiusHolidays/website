import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { JSDOM } from "jsdom";
import { act } from "react";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { applyQueryLink } from "@/lib/portal/entityModalLinks";
import { jobCardProposalLinkPatch } from "@/lib/portal/modalLifecycle";

let createRoot;
let EntityModalJobCardFields;
const details = new Map();
let listed = [];
const pathname = "/portal/accounts/job-cards";
const accountsAccess = {
  allowed: true,
  permissions: [P.MANAGE_JOB_CARDS, P.VIEW_JOB_CARDS],
  roles: ["Accounts"],
};
const router = { replace: () => undefined };
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://citius.test" });
beforeAll(async () => {
  mock.module("next/navigation", () => ({
    usePathname: () => pathname,
    useRouter: () => router,
  }));
  mock.module("convex/react", () => ({
    useAction: () => async () => undefined,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useMutation: () => async () => undefined,
    usePaginatedQuery: (ref, args) => ({
      loadMore: () => undefined,
      results: args !== "skip" && getFunctionName(ref) === "crm/queries:listPage" ? listed : [],
      status: "Exhausted",
    }),
    useQuery: (ref, args) => {
      if (args === "skip" || getFunctionName(ref) !== "crm/queries:getDetail") {
        return;
      }
      return details.get(args.queryId);
    },
  }));
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.Event = dom.window.Event;
  globalThis.InputEvent = dom.window.InputEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.Element = dom.window.Element;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.Node = dom.window.Node;
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
  ({ EntityModalJobCardFields } = await import("./EntityModalJobCardFields"));
});
afterAll(() => {
  mock.restore();
  dom.window.close();
});
const nothing = () => undefined;
const offer = {
  airfarePerPax: 20_000,
  approxMargin: 25_000,
  confirmedPax: 10,
  destination: "Goa",
  landCostPerPax: 45_000,
  profitPerPax: 12_000,
  proposalId: "p1",
  sellingPricePerPax: 80_000,
  travelEndDate: "",
  travelStartDate: "2026-11-02",
  visaCostPerPax: 3000,
};
function marginInput(container, label) {
  return Array.from(container.querySelectorAll("label"))
    .find((node) => node.textContent.includes(label))
    ?.querySelector("input");
}
const emptyForm = {
  airfarePerPax: "",
  clientName: "",
  confirmedPax: "",
  destination: "",
  landCostPerPax: "",
  profitPerPax: "",
  proposalId: "",
  queryId: "",
  roomCount: "",
  sellingPricePerPax: "",
  travelEndDate: "",
  travelStartDate: "",
  visaCostPerPax: "",
};
async function mount(form) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = async (next) => {
    await act(async () =>
      root.render(
        <EntityModalJobCardFields
          form={{ ...emptyForm, ...next }}
          handleJobQuerySelect={nothing}
          modal="jobCard"
          proposals={[]}
          queries={[]}
          updateForm={nothing}
        />
      )
    );
  };
  await render(form);
  return {
    close: async () => {
      await act(async () => root.unmount());
    },
    container,
    render,
  };
}
test("Creation shows both distinct snapshot margins read-only before a Job Card number exists", async () => {
  const query = { approxMargin: 99_999, confirmedOffer: offer, id: "q1" };
  const form = jobCardProposalLinkPatch({
    form: { queryId: "q1" },
    modal: "jobCard",
    queries: [query],
  });
  const view = await mount({ queryId: "q1", ...form });
  expect(marginInput(view.container, "Approx. Margin (INR)")?.value).toBe("25000");
  expect(marginInput(view.container, "Approx. Margin (INR)")?.readOnly).toBe(true);
  expect(marginInput(view.container, "Profit per Person (pre-tax)")?.value).toBe("12000");
  expect(marginInput(view.container, "Profit per Person (pre-tax)")?.readOnly).toBe(true);
  await view.close();
});
test("Zero, missing snapshot and changing selections do not invent or retain a margin", async () => {
  const view = await mount({
    _confirmedOfferState: "ready",
    queryId: "q1",
    ...applyQueryLink(
      {},
      {
        approxMargin: 99_999,
        confirmedOffer: { ...offer, approxMargin: 0, profitPerPax: 0 },
        id: "q1",
      }
    ),
  });
  expect(marginInput(view.container, "Approx. Margin (INR)")?.value).toBe("0");
  expect(marginInput(view.container, "Profit per Person (pre-tax)")?.value).toBe("0");
  const missing = applyQueryLink(
    { approxMargin: "25000" },
    { approxMargin: 99_999, confirmedOffer: { ...offer, approxMargin: null }, id: "q2" }
  );
  await view.render({ ...missing, _confirmedOfferState: "ready" });
  expect(marginInput(view.container, "Approx. Margin (INR)")?.value).toBe("");
  for (const state of ["loading", "missing"]) {
    // biome-ignore lint/performance/noAwaitInLoops: state transitions on the same mounted form are intentionally sequential.
    await view.render({
      _confirmedOfferState: state,
      approxMargin: "25000",
      profitPerPax: "12000",
      queryId: "q2",
    });
    expect(marginInput(view.container, "Approx. Margin (INR)")?.value).toBe("");
    expect(marginInput(view.container, "Profit per Person (pre-tax)")?.value).toBe("");
  }
  await view.render({ approxMargin: "25000", entityId: "jc1", queryId: "q1" });
  expect(marginInput(view.container, "Approx. Margin (INR)")).toBeUndefined();
  await view.close();
});

async function editInput(label, value) {
  const input = marginInput(document, label);
  expect(input).toBeDefined();
  await act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter.call(input, value);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function selectConfirmedQuery(queryCode) {
  const label = Array.from(document.querySelectorAll("label")).find((node) =>
    node.textContent.includes("Confirmed Query")
  );
  const trigger = document.getElementById(label.htmlFor);
  await act(async () =>
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }))
  );
  const option = Array.from(document.querySelectorAll('[role="option"]')).find((node) =>
    node.textContent.includes(queryCode)
  );
  expect(option).toBeDefined();
  await act(async () => option.click());
}

test("Accounts trip edits survive query selection, unavailable details and fresh creation notifications", async () => {
  const { usePortalWorkspaceState } = await import("../usePortalWorkspaceState");
  const { usePortalNotificationDeepLink } = await import("../usePortalNotificationDeepLink");
  const { EntityModal } = await import("../EntityModal");
  const { PortalAccessProvider } = await import("../PortalAccessContext");
  const { PortalToastProvider } = await import("../PortalToast");
  const { PortalConfirmProvider } = await import("../PortalConfirmDialog");
  const { LazyMotion, domAnimation } = await import("motion/react");
  const container = document.createElement("div");
  document.body.append(container);
  container.tabIndex = 0;
  container.focus();
  const root = createRoot(container);
  listed = ["q1", "q2", "q3"].map((id) => ({
    clientName: `Client ${id}`,
    contractingStatus: "Order Confirmed",
    id,
    paxCount: 10,
    queryCode: `Q-${id}`,
    salesStatus: "Order Confirmed",
  }));
  details.clear();
  function Workspace() {
    const model = usePortalWorkspaceState(
      "accounts-job-cards",
      new URLSearchParams(window.location.search)
    );
    usePortalNotificationDeepLink(model.chrome.deepLink);
    return <EntityModal {...model.modal} close={model.modal.closeModal} />;
  }
  const render = async () => {
    await act(async () =>
      root.render(
        <LazyMotion features={domAnimation}>
          <PortalAccessProvider access={accountsAccess}>
            <PortalToastProvider>
              <PortalConfirmProvider>
                <Workspace />
              </PortalConfirmProvider>
            </PortalToastProvider>
          </PortalAccessProvider>
        </LazyMotion>
      )
    );
  };
  const navigate = async (queryId) => {
    window.history.replaceState({}, "", `${pathname}?open=jobCard&queryId=${queryId}`);
    await render();
  };
  const releaseDetail = async (queryId, confirmedOffer) => {
    details.set(queryId, { ...listed.find((row) => row.id === queryId), confirmedOffer });
    await render();
  };
  const expectMargins = (approximation, profit) => {
    expect(marginInput(document, "Approx. Margin (INR)")?.value).toBe(approximation);
    expect(marginInput(document, "Profit per Person (pre-tax)")?.value).toBe(profit);
  };
  const expectEditedTrip = () => {
    expect(marginInput(document, "Confirmed Pax")?.value).toBe("12");
    expect(marginInput(document, "Travel Start")?.value).toBe("05/11/2026");
    expect(marginInput(document, "Travel End")?.value).toBe("09/11/2026");
  };
  try {
    await navigate("q1");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await releaseDetail("q1", offer);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    expectMargins("25000", "12000");
    expect(marginInput(document, "Approx. Margin (INR)")?.readOnly).toBe(true);
    expect(marginInput(document, "Profit per Person (pre-tax)")?.readOnly).toBe(true);

    await selectConfirmedQuery("Q-q2");
    expectMargins("", "");
    expect(document.body.textContent).toContain("Loading the immutable Confirmed Offer");
    await releaseDetail("q1", { ...offer, approxMargin: 88_888 });
    expectMargins("", "");
    await releaseDetail("q2", { ...offer, approxMargin: 0, profitPerPax: -1250.5 });
    expectMargins("0", "-1250.5");
    await editInput("Confirmed Pax", "12");
    await editInput("Travel Start", "05/11/2026");
    await editInput("Travel End", "09/11/2026");
    await render();
    expectEditedTrip();
    expectMargins("0", "-1250.5");

    await navigate("q3");
    expectMargins("", "");
    expectEditedTrip();
    details.set("q3", null);
    await render();
    await render();
    expect(window.location.search).toBe("");
    expect(document.body.textContent).toContain("Record not found or you may not have access.");
    expectMargins("0", "-1250.5");
    expectEditedTrip();

    details.delete("q2");
    await render();
    expectMargins("", "");
    details.set("q2", null);
    await render();
    expectMargins("", "");
    expect(document.body.textContent).toContain("This Query has no Confirmed Offer");
    await releaseDetail("q2", { ...offer, approxMargin: 0, profitPerPax: -1250.5 });
    expectMargins("0", "-1250.5");
    expectEditedTrip();

    details.delete("q3");
    await navigate("q3");
    expectMargins("", "");
    await releaseDetail("q3", { ...offer, approxMargin: null, profitPerPax: 1500 });
    expectMargins("", "1500");
    expect(document.querySelector('[role="combobox"]')?.textContent).toContain("Q-q3");
    await editInput("Confirmed Pax", "15");
    await render();
    await render();
    expect(marginInput(document, "Confirmed Pax")?.value).toBe("15");
    expectMargins("", "1500");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test("Creation preserves a signed negative snapshot profit without recalculating it", async () => {
  const view = await mount({
    _confirmedOfferState: "ready",
    ...applyQueryLink({}, { confirmedOffer: { ...offer, profitPerPax: -1250.5 }, id: "q1" }),
  });
  expect(marginInput(view.container, "Profit per Person (pre-tax)")?.value).toBe("-1250.5");
  await view.close();
});

test("Initially absent commercial form values render when the immutable offer loads", async () => {
  const view = await mount({
    _confirmedOfferState: "loading",
    airfarePerPax: undefined,
    landCostPerPax: undefined,
    sellingPricePerPax: undefined,
    visaCostPerPax: undefined,
  });
  await view.render({
    _confirmedOfferState: "ready",
    ...applyQueryLink({}, { confirmedOffer: offer, id: "q1" }),
  });
  expect(marginInput(view.container, "Selling Price per Person (pre-tax)")?.value).toBe("80000");
  expect(marginInput(view.container, "Land Cost per Person")?.value).toBe("45000");
  expect(marginInput(view.container, "Airfare per Person")?.value).toBe("20000");
  expect(marginInput(view.container, "Visa Cost per Person")?.value).toBe("3000");
  await view.close();
});
