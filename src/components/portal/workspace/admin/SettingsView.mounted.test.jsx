import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/settings",
});

let currentSearch = "";
const replacedUrls = [];

mock.module("next/navigation", () => ({
  usePathname: () => "/portal/settings",
  useRouter: () => ({
    push: (href) => replacedUrls.push(href),
    replace: (href) => replacedUrls.push(href),
  }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

let createRoot;
let PortalConfirmProvider;
let PortalToastProvider;
let SettingsView;

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
  ({ createRoot } = await import("react-dom/client"));
  ({ PortalConfirmProvider } = await import("@/components/portal/PortalConfirmDialog"));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
  ({ SettingsView } = await import("./SettingsView"));
});

afterAll(() => dom.window.close());

const noop = () => undefined;
const noopMutation = async () => undefined;
const admin = { roles: ["Admin"], staffId: "staff-admin" };
const director = { roles: ["Directors"], staffId: "staff-director" };

const staffRow = {
  active: true,
  confirmationDate: "2026-04-01",
  department: "Sales",
  email: "nina@citiusholidays.com",
  emailAlertRoles: ["Operations Head"],
  employmentStatus: "Probation",
  function: "Sales leadership",
  id: "staff-1",
  joiningDate: "2025-10-01",
  leaveHeadApproverId: "staff-head",
  leaveHeadApproverName: "Bhavesh Mehta",
  leavePolicyGroup: "Default",
  location: "Mumbai",
  marriageLeaveUsed: false,
  maternityEventsUsed: 0,
  mobile: "+91 98200 00000",
  name: "Nina Sales",
  onboardingStatus: "pending",
  paternityEventsUsed: 0,
  reportingManagerName: "Bhavesh Mehta",
  reportingManagerStaffId: "staff-head",
  roles: ["Sales"],
};

async function mountSettings({ access = admin, search = "", ...props } = {}) {
  currentSearch = search;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PortalToastProvider>
        <PortalConfirmProvider>
          <SettingsView
            access={access}
            deleteItem={noop}
            dropdowns={{ department: ["Sales", "Operations"] }}
            openModal={noop}
            removeStaff={noopMutation}
            search=""
            staff={[staffRow]}
            startStaffOnboarding={noopMutation}
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

const TRAILING_COUNT = /\d+$/;

function tabLabels(container) {
  return [...container.querySelectorAll('[role="tab"]')].map((tab) =>
    tab.textContent.replace(TRAILING_COUNT, "")
  );
}

function selectedTab(container) {
  return container.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
}

function headerLabels(container) {
  return [...container.querySelectorAll("table thead th")].map((cell) => cell.textContent.trim());
}

function buttonNamed(root, name) {
  return [...root.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === name || button.getAttribute("aria-label") === name
  );
}

async function openMenu(button) {
  await act(async () => {
    button?.focus();
    button?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("Settings view", () => {
  test("opens on Staff and offers Live controls to the exact Admin only", async () => {
    const adminView = await mountSettings();
    expect(tabLabels(adminView.container)).toEqual([
      "Staff",
      "Dropdown values",
      "Leave workbook",
      "Live controls",
    ]);
    expect(selectedTab(adminView.container)).toContain("Staff");
    expect(adminView.container.textContent).toContain("Staff access");
    expect(adminView.container.textContent).not.toContain("Live feature controls");
    await adminView.unmount();

    const directorView = await mountSettings({ access: director, search: "tab=live-controls" });
    expect(tabLabels(directorView.container)).toEqual([
      "Staff",
      "Dropdown values",
      "Leave workbook",
    ]);
    expect(selectedTab(directorView.container)).toContain("Staff");
    await directorView.unmount();
  });

  test("renders while the staff list is still loading", async () => {
    // The workspace passes undefined until staff rows arrive.
    const view = await mountSettings({ staff: undefined });
    expect(tabLabels(view.container)).toContain("Staff");
    expect(selectedTab(view.container)).toBe("Staff");
    expect(view.container.textContent).toContain("Staff access");
    await view.unmount();
  });

  test("keeps the chosen tab in the URL so a refresh lands on the same section", async () => {
    replacedUrls.length = 0;
    const view = await mountSettings({ search: "tab=workbook" });
    expect(selectedTab(view.container)).toBe("Leave workbook");
    expect(view.container.textContent).toContain("Open workbook import");
    expect(view.container.textContent).not.toContain("Staff access");

    const dropdownTab = [...view.container.querySelectorAll('[role="tab"]')].find(
      (tab) => tab.textContent === "Dropdown values"
    );
    await act(async () => dropdownTab.click());
    expect(replacedUrls.at(-1)).toBe("/portal/settings?tab=dropdowns");
    await view.unmount();

    const dropdowns = await mountSettings({ search: "tab=dropdowns" });
    expect(dropdowns.container.textContent).toContain("Workflow dropdown values (read-only)");
    expect(dropdowns.container.textContent).toContain("Operations");
    await dropdowns.unmount();
  });

  test("shows at most six staff columns by default and every column on request", async () => {
    const view = await mountSettings();
    const compact = headerLabels(view.container);
    expect(compact.length).toBeLessThanOrEqual(6);
    expect(compact).toEqual(["Name", "Roles", "Department", "Status", "Action"]);
    expect(view.container.textContent).toContain("nina@citiusholidays.com");
    expect(view.container.textContent).toContain("Active · Pending");

    await act(async () => buttonNamed(view.container, "Show all columns").click());
    const all = headerLabels(view.container);
    expect(all).toHaveLength(12);
    expect(all).toContain("Leave head approver");
    expect(all).toContain("Reporting manager");
    expect(all).toContain("Function");
    expect(all).toContain("Location");
    expect(all).toContain("Additional email alert roles");
    expect(all).toContain("Onboarding");
    expect(all).toContain("Active");
    expect(view.container.textContent).toContain("Operations Head");

    await act(async () => buttonNamed(view.container, "Show fewer columns").click());
    expect(headerLabels(view.container)).toHaveLength(5);
    await view.unmount();
  });

  test("keeps Edit on the row and moves onboarding email and Delete into More", async () => {
    const opened = [];
    const deletes = [];
    const view = await mountSettings({
      deleteItem: (...args) => deletes.push(args),
      openModal: (...args) => opened.push(args),
    });
    const row = view.container.querySelector("table tbody tr");
    expect(buttonNamed(row, "Edit")).toBeTruthy();
    expect(row.textContent).not.toContain("Resend verification");
    expect(row.querySelector('[aria-label="Delete nina@citiusholidays.com"]')).toBeNull();

    await act(async () => buttonNamed(row, "Edit").click());
    expect(opened).toHaveLength(1);
    const [modal, form] = opened[0];
    expect(modal).toBe("staff");
    // Fields the modal does not show must still round-trip through the save.
    expect(form.joiningDate).toBe("2025-10-01");
    expect(form.employmentStatus).toBe("Probation");
    expect(form).toMatchObject({
      emailAlertRoles: ["Operations Head"],
      leaveHeadApproverId: "staff-head",
      staffActive: true,
      staffEmail: "nina@citiusholidays.com",
      staffId: "staff-1",
      staffRoles: ["Sales"],
    });

    await openMenu(row.querySelector('button[aria-label="More actions for Nina Sales"]'));
    const menu = document.querySelector('[role="menu"]');
    expect(menu?.textContent).toContain("Resend verification");
    const deleteItem = menu?.querySelector('[aria-label="Delete nina@citiusholidays.com"]');
    expect(deleteItem).toBeTruthy();
    await act(async () => deleteItem.click());
    expect(deletes).toHaveLength(1);
    expect(deletes[0][0]).toBe("nina@citiusholidays.com");
    expect(deletes[0][2]).toEqual({ staffId: "staff-1" });
    await view.unmount();
  });
});
