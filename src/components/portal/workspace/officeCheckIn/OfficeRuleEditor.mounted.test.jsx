import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { act } from "react";
import { findButton, installPortalDom, typeInto } from "./officeCheckInTestHarness";

const dom = installPortalDom("https://citiusholidays.com/portal/office-check-in");

let createRoot;
let OfficeRuleEditor;
let PortalConfirmProvider;
let checkRuleDraft;
const saveRule = mock(async () => 3);
const toastSuccess = mock(() => undefined);

function office(ruleOverrides = {}) {
  return {
    active: true,
    assignedStaff: 4,
    city: "Pune",
    code: "PUN",
    id: "offices_1",
    name: "Pune office",
    rule: {
      _creationTime: 1,
      _id: "officeCheckInRules_1",
      enforcementMode: "report_only",
      networks: [{ cidr: "203.0.113.0/24", kind: "office", label: "Main line" }],
      officeId: "offices_1",
      requirement: "network",
      timeZone: "Asia/Kolkata",
      updatedAt: 1,
      version: 2,
      ...ruleOverrides,
    },
  };
}

beforeAll(async () => {
  mock.module("convex/react", () => ({
    useMutation: () => saveRule,
    usePaginatedQuery: () => ({ loadMore: () => undefined, results: [], status: "Exhausted" }),
    useQuery: () => undefined,
  }));
  mock.module("@/components/portal/PortalToast", () => ({
    usePortalToast: () => ({ error: () => undefined, success: toastSuccess }),
  }));
  ({ createRoot } = await import("react-dom/client"));
  ({ OfficeRuleEditor } = await import("./OfficeRuleEditor"));
  ({ checkRuleDraft } = await import("./officeRuleDraft"));
  ({ PortalConfirmProvider } = await import("@/components/portal/PortalConfirmDialog"));
});

beforeEach(() => {
  saveRule.mockClear();
  toastSuccess.mockClear();
  document.body.innerHTML = "";
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mount(target) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PortalConfirmProvider>
        <OfficeRuleEditor office={target} />
      </PortalConfirmProvider>
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

async function settle(action) {
  await act(() => {
    action();
  });
  // The confirm dialog opens through a triggerless Base UI root and moves focus a few frames later.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
}

async function chooseEnforceWithReason(container) {
  await settle(() => container.querySelector('input[name="mode"][value="enforce"]').click());
  await act(async () =>
    typeInto(dom, container.querySelector("textarea"), "Pilot finished; office ranges confirmed")
  );
}

describe("Office rule editor", () => {
  test("Starts a new office's rule empty, with documentation placeholders only", async () => {
    const view = await mount({ ...office(), rule: null });
    const values = [...view.container.querySelectorAll("input:not([type=radio])")].map(
      (input) => input.value
    );
    expect(values.every((value) => value === "")).toBe(true);
    expect(view.container.textContent).toContain("203.0.113.0/24");
    expect(view.container.textContent).toContain(
      "Staff can't pick a different or easier method when they clock in."
    );
    await view.unmount();
  });

  test("Warns and asks for confirmation before turning on Enforce", async () => {
    const view = await mount(office());
    await chooseEnforceWithReason(view.container);
    expect(view.container.textContent).toContain("Turning on Enforce affects everyone");

    await settle(() => findButton(view.container, "Save rule").click());
    const confirmDialog = document.querySelector('[data-testid="portal-confirm-dialog"]');
    expect(confirmDialog?.textContent).toContain("Turn on Enforce for Pune office?");
    expect(saveRule).not.toHaveBeenCalled();

    await settle(() => document.querySelector('[data-testid="portal-confirm-cancel"]').click());
    expect(saveRule).not.toHaveBeenCalled();

    await settle(() => findButton(view.container, "Save rule").click());
    await settle(() => document.querySelector('[data-testid="portal-confirm-submit"]').click());

    expect(saveRule).toHaveBeenCalledTimes(1);
    expect(saveRule.mock.calls[0][0]).toMatchObject({
      confirmEnforcement: true,
      enforcementMode: "enforce",
      expectedVersion: 2,
      networks: [{ cidr: "203.0.113.0/24", kind: "office", label: "Main line" }],
      officeId: "offices_1",
      reason: "Pilot finished; office ranges confirmed",
      requirement: "network",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Rule saved for Pune office (version 3).");
    await view.unmount();
  });

  test("Saves an already-enforced rule without asking again", async () => {
    const view = await mount(office({ enforcementMode: "enforce" }));
    await act(async () =>
      typeInto(dom, view.container.querySelector("textarea"), "Added the second floor range")
    );
    await settle(() => findButton(view.container, "Save rule").click());
    expect(
      document.querySelector('[data-testid="portal-confirm-dialog"]')?.textContent ?? ""
    ).not.toContain("Turn on Enforce");
    expect(saveRule.mock.calls[0][0]).toMatchObject({ confirmEnforcement: false });
    await view.unmount();
  });

  test("Blocks a save without a reason and focuses the field", async () => {
    const view = await mount(office());
    await settle(() => findButton(view.container, "Save rule").click());
    const reason = view.container.querySelector("textarea");
    expect(saveRule).not.toHaveBeenCalled();
    expect(reason.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(reason);
    await view.unmount();
  });

  test("Lists rule problems in a focused alert and does not save", async () => {
    const view = await mount(office());
    await act(async () =>
      typeInto(dom, view.container.querySelector("textarea"), "Adding a location check")
    );
    const latitude = [...view.container.querySelectorAll("label")].find(
      (label) => label.textContent === "Latitude"
    );
    await act(async () => typeInto(dom, document.getElementById(latitude.htmlFor), "18.5"));
    await settle(() => findButton(view.container, "Save rule").click());
    const alert = view.container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      "Fill in latitude, longitude, radius and accuracy limit as numbers, or leave all four empty."
    );
    expect(document.activeElement).toBe(alert);
    expect(saveRule).not.toHaveBeenCalled();
    await view.unmount();
  });

  test("Sends trimmed network ranges and drops blank rows", () => {
    const result = checkRuleDraft(
      {
        accuracy: "",
        latitude: "",
        longitude: "",
        mode: "report_only",
        networks: [
          { cidr: " 203.0.113.0/24 ", key: "a", kind: "office", label: " Main line " },
          { cidr: "   ", key: "b", kind: "vpn", label: "" },
          { cidr: "", key: "c", kind: "shared", label: " Lobby Wi-Fi " },
        ],
        radius: "",
        reason: "x",
        requirement: "network",
        timeZone: "",
      },
      "report_only"
    );
    // A row with only a label is kept, so the missing range is reported rather than dropped.
    expect(result.problems).toEqual(['"" is not a valid IPv4 or IPv6 address or CIDR range.']);
    const valid = checkRuleDraft(
      {
        accuracy: "",
        latitude: "",
        longitude: "",
        mode: "report_only",
        networks: [
          { cidr: " 203.0.113.0/24 ", key: "a", kind: "office", label: " Main line " },
          { cidr: "   ", key: "b", kind: "vpn", label: "" },
        ],
        radius: "",
        reason: "x",
        requirement: "network",
        timeZone: "",
      },
      "report_only"
    );
    expect(valid.submission?.networks).toEqual([
      { cidr: "203.0.113.0/24", kind: "office", label: "Main line" },
    ]);
  });

  test("Mirrors the server's rule validation before sending", () => {
    const base = {
      accuracy: "",
      latitude: "",
      longitude: "",
      mode: "report_only",
      networks: [],
      radius: "",
      reason: "x",
      requirement: "network_and_geofence",
      timeZone: "",
    };
    const result = checkRuleDraft(base, null);
    expect(result.submission).toBeNull();
    expect(result.problems).toContain(
      "This rule checks the office network, so add at least one network range."
    );
    expect(result.problems).toContain(
      "This rule checks location, so set office coordinates and a radius."
    );
    expect(checkRuleDraft({ ...base, latitude: "18.5" }, null).problems).toContain(
      "Fill in latitude, longitude, radius and accuracy limit as numbers, or leave all four empty."
    );
  });
});
