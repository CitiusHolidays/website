import { afterAll, afterEach, beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

// Imported after the DOM globals exist, so the menu primitives see a browser environment.
let LeaveView;
let PortalConfirmProvider;
let PortalToastProvider;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/employees-on-leave",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  ({ LeaveView } = await import("./LeaveView"));
  ({ PortalConfirmProvider } = await import("@/components/portal/PortalConfirmDialog"));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
});

afterEach(() => setSystemTime());
afterAll(() => dom.window.close());

const noop = () => undefined;
const noopMutation = async () => undefined;
const manageLeave = (permission) => permission === P.MANAGE_LEAVE;
const noPermissions = () => false;

const ROWS = [
  {
    canApproveHr: true,
    canReject: true,
    department: "Ticketing",
    endDate: "2026-11-12",
    finalReviewStatus: "Approved",
    headReviewStatus: "Approved",
    hrReviewStatus: "Pending",
    id: "leave-hr",
    leaveType: "Casual",
    reason: "Bank work",
    staffId: "staff-gauri",
    staffName: "Gauri Deshpande",
    startDate: "2026-11-12",
    status: "Pending",
  },
  {
    canApproveHead: true,
    canReject: true,
    department: "Operations",
    endDate: "2026-11-25",
    headReviewerRole: "HR",
    headReviewStatus: "Pending",
    hrReviewStatus: "Pending",
    id: "leave-head",
    leaveType: "Privilege",
    reason: "Annual holiday",
    staffId: "staff-esha",
    staffName: "Esha Banerjee",
    startDate: "2026-11-18",
    status: "Pending",
  },
  {
    department: "Sales",
    endDate: "2026-11-06",
    headReviewStatus: "Approved",
    hrReviewStatus: "Approved",
    id: "leave-away",
    leaveType: "Casual",
    reason: "Family function",
    staffId: "staff-aarti",
    staffName: "Aarti Kulkarni",
    startDate: "2026-11-05",
    status: "Approved",
  },
  {
    department: "Sales",
    endDate: "2026-11-10",
    headApproverName: "Bhavesh Mehta",
    headReviewStatus: "Pending",
    hrReviewStatus: "Pending",
    id: "leave-not-mine",
    leaveType: "Casual",
    reason: "Doctor's appointment",
    staffId: "staff-ojas",
    staffName: "Ojas Kapoor",
    startDate: "2026-11-09",
    status: "Pending",
  },
];

async function mount(props) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PortalToastProvider>
        <PortalConfirmProvider>
          <LeaveView
            access={{ roles: ["HR"], staffId: "staff-hr" }}
            decideLeave={noopMutation}
            deleteItem={noop}
            has={manageLeave}
            leaveBalances={[{ availableDays: 4, fiscalYear: "2026-2027", leaveType: "Casual" }]}
            openModal={noop}
            removeLeave={noopMutation}
            rows={ROWS}
            {...props}
          />
        </PortalConfirmProvider>
      </PortalToastProvider>
    )
  );
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function waitingSection(container) {
  return container.querySelector('section[aria-labelledby="leave-waiting-heading"]');
}

async function click(element) {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("LeaveView approver queue", () => {
  test("lists exactly the rows the approver can act on, soonest start first", async () => {
    const view = await mount({});
    const section = waitingSection(view.container);

    expect(section?.querySelector("h2")?.textContent).toBe("Waiting for your approval2");
    const names = [...(section?.querySelectorAll("li") ?? [])].map(
      (item) => item.querySelector("span")?.textContent
    );
    expect(names).toEqual(["Gauri Deshpande", "Esha Banerjee"]);
    expect(section?.textContent).not.toContain("Ojas Kapoor");
    expect(section?.textContent).not.toContain("Aarti Kulkarni");
    expect(section?.textContent).toContain("Head approved · waiting for HR");

    await view.unmount();
  });

  test("Approve and Reject call decideLeave with the same arguments as the table", async () => {
    const calls = [];
    const decideLeave = (args) => {
      calls.push(args);
      return Promise.resolve();
    };
    const view = await mount({ decideLeave });
    const section = waitingSection(view.container);

    await click(section?.querySelector('button[aria-label="Approve (HR) for Gauri Deshpande"]'));
    await click(section?.querySelector('button[aria-label="Reject for Esha Banerjee"]'));
    const tableApprove = [...view.container.querySelectorAll("table button")].find(
      (button) => button.textContent === "Approve"
    );
    await click(tableApprove);

    expect(calls).toEqual([
      { leaveId: "leave-hr", status: "Approved" },
      { leaveId: "leave-head", status: "Rejected" },
      { leaveId: "leave-head", status: "Approved" },
    ]);

    await view.unmount();
  });

  test("a Sales user with no approval flags sees no approver queue", async () => {
    const own = ROWS.filter((row) => row.id === "leave-not-mine").map((row) => ({
      ...row,
      staffId: "staff-sunil",
      staffName: "Sunil Sales",
    }));
    const view = await mount({
      access: { roles: ["Sales"], staffId: "staff-sunil" },
      has: noPermissions,
      rows: own,
    });

    expect(waitingSection(view.container)).toBeNull();
    expect(view.container.textContent).not.toContain("Waiting for your approval");
    expect(view.container.textContent).not.toContain("Away today");
    expect(view.container.textContent).toContain("My leave balances");
    expect(view.container.textContent).not.toContain("No balance row");

    await view.unmount();
  });
});

describe("LeaveView table", () => {
  test("merges the review columns into one Progress column", async () => {
    const view = await mount({});
    const headers = [...view.container.querySelectorAll("th")].map((th) => th.textContent.trim());

    expect(headers).toContain("Progress");
    expect(headers).not.toContain("Head Review");
    expect(headers).not.toContain("HR Review");
    expect(
      view.container.querySelector('table [role="status"][aria-label*="leave approval required"]')
    ).not.toBeNull();

    await view.unmount();
  });

  test("Delete sits under More and still goes through the delete confirmation", async () => {
    const deleteCalls = [];
    const removeLeave = async () => undefined;
    const deleteItem = (...args) => {
      deleteCalls.push(args);
    };
    const view = await mount({ deleteItem, removeLeave });

    expect(
      view.container.querySelector('button[aria-label="Delete leave for Aarti Kulkarni"]')
    ).toBeNull();
    const more = view.container.querySelector(
      'button[aria-label="More actions for leave for Aarti Kulkarni"]'
    );
    expect(more?.getAttribute("aria-haspopup")).toBe("menu");

    await act(async () => {
      more?.focus();
      more?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const deleteItemButton = document.querySelector(
      '[role="menuitem"][aria-label="Delete leave for Aarti Kulkarni"]'
    );
    expect(deleteItemButton).not.toBeNull();
    await click(deleteItemButton);

    expect(deleteCalls).toEqual([
      ["leave for Aarti Kulkarni", removeLeave, { leaveId: "leave-away" }],
    ]);

    await view.unmount();
  });
});

describe("LeaveView away today", () => {
  test("uses the India date at 00:30 IST", async () => {
    // 00:30 IST on 5 Nov is still 4 Nov in UTC.
    setSystemTime(new Date("2026-11-05T00:30:00+05:30"));
    const view = await mount({});

    expect(view.container.textContent).toContain("Away today · Aarti Kulkarni");

    await view.unmount();
  });
});
