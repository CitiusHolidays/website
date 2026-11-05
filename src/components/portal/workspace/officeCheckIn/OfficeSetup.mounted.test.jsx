import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { act } from "react";
import { findButton, installPortalDom, typeInto } from "./officeCheckInTestHarness";

const dom = installPortalDom("https://citiusholidays.com/portal/office-check-in");

let createRoot;
let OfficeSetupPanel;
let PortalConfirmProvider;
const saveRule = mock(async () => 3);
const assignStaffOffice = mock(async () => null);
const createOffice = mock(async () => "offices_new");
const toastSuccess = mock(() => undefined);

const JARGON = /CIDR|geofence|proxy/i;

const MUTATIONS = {
  "crm/officeCheckInAdmin:assignStaffOffice": assignStaffOffice,
  "crm/officeCheckInAdmin:createOffice": createOffice,
  "crm/officeCheckInAdmin:saveRule": saveRule,
};

function rule(overrides = {}) {
  return {
    _creationTime: 1,
    _id: "officeCheckInRules_1",
    enforcementMode: "report_only",
    geofence: { latitude: 18.5204, longitude: 73.8567, maxAccuracyMeters: 75, radiusMeters: 150 },
    networks: [{ cidr: "203.0.113.0/24", kind: "office", label: "Main line" }],
    officeId: "offices_pune",
    requirement: "network_and_geofence",
    timeZone: "Asia/Kolkata",
    updatedAt: 1,
    version: 2,
    ...overrides,
  };
}

function overview(ruleOverrides = {}) {
  return {
    offices: [
      {
        active: true,
        assignedStaff: 2,
        city: "Pune",
        code: "PUN",
        id: "offices_pune",
        name: "Pune office",
        rule: rule(ruleOverrides),
      },
      {
        active: true,
        assignedStaff: 1,
        city: "Thane",
        code: "THN",
        id: "offices_thane",
        name: "Thane office",
        rule: null,
      },
    ],
    recentAudit: [
      {
        actorName: "Priya Nair",
        at: Date.UTC(2026, 10, 5, 5, 10),
        id: "a1",
        kind: "rule_saved",
        reason: "Added backup fibre",
        summary: "PUN v2",
      },
    ],
    staff: [
      { freeTextLocation: null, id: "staff_asha", name: "Asha Rao", officeId: "offices_pune" },
      { freeTextLocation: null, id: "staff_dev", name: "Dev Patel", officeId: null },
      { freeTextLocation: null, id: "staff_meera", name: "Meera Iyer", officeId: "offices_pune" },
      { freeTextLocation: null, id: "staff_sam", name: "Sam Fernandes", officeId: "offices_thane" },
    ],
    unmatchedNetworks: [
      {
        count: 4,
        lastWorkDate: "2026-11-05",
        officeId: "offices_pune",
        prefix: "198.51.100.0/24",
        reasons: ["outside_allowlist"],
      },
    ],
  };
}

beforeAll(async () => {
  mock.module("convex/react", () => ({
    useMutation: (reference) => MUTATIONS[getFunctionName(reference)] ?? mock(async () => null),
    usePaginatedQuery: () => ({ loadMore: () => undefined, results: [], status: "Exhausted" }),
    useQuery: () => undefined,
  }));
  mock.module("@/components/portal/PortalToast", () => ({
    usePortalToast: () => ({ error: () => undefined, success: toastSuccess }),
  }));
  ({ createRoot } = await import("react-dom/client"));
  ({ OfficeSetupPanel } = await import("./OfficeSetupPanel"));
  ({ PortalConfirmProvider } = await import("@/components/portal/PortalConfirmDialog"));
});

beforeEach(() => {
  for (const fn of [saveRule, assignStaffOffice, createOffice, toastSuccess]) {
    fn.mockClear();
  }
  assignStaffOffice.mockImplementation(async () => null);
  document.body.innerHTML = "";
});

afterAll(() => {
  mock.restore();
  dom.window.close();
});

async function mount(data = overview()) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PortalConfirmProvider>
        <OfficeSetupPanel overview={data} timeZone="Asia/Kolkata" />
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
  // Dialogs open through Base UI roots and move focus a few frames later.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
}

function dialog() {
  return document.querySelector('[role="dialog"]');
}

async function openEditor(container, name = "Pune office") {
  await settle(() => findButton(container, `Edit ${name}`).click());
  return dialog();
}

function inputLabelled(root, text) {
  const label = [...root.querySelectorAll("label")].find((node) => node.textContent === text);
  return label ? document.getElementById(label.getAttribute("for")) : null;
}

describe("Office setup", () => {
  test("Lists each office with what it checks, its mode and its staff", async () => {
    const view = await mount();
    const cards = [...view.container.querySelectorAll("li")];
    expect(cards[0].textContent).toContain("Pune office");
    expect(cards[0].textContent).toContain("Checks location and office internet");
    expect(cards[0].textContent).toContain("Report only");
    expect(findButton(cards[0], "Staff (2)")).toBeTruthy();
    expect(cards[1].textContent).toContain("Not set up");
    // History stays folded away until asked for.
    const history = view.container.querySelector("details");
    expect(history.open).toBe(false);
    expect(history.textContent).toContain("History and pilot networks");
    await view.unmount();
  });

  test("Opens a focused editor with Advanced settings closed", async () => {
    const view = await mount();
    const editor = await openEditor(view.container);
    expect(editor.textContent).toContain("What should we check?");
    for (const choice of ["Location", "Office internet", "Either one", "Both"]) {
      expect(editor.textContent).toContain(choice);
    }
    const advanced = editor.querySelector("details");
    expect(advanced.querySelector("summary").textContent).toBe("Advanced settings");
    expect(advanced.open).toBe(false);
    // The main path names no networking jargon.
    const mainPath = editor.textContent.replace(advanced.textContent, "");
    expect(mainPath).not.toMatch(JARGON);
    await view.unmount();
  });

  test("Saves in one click with the pre-filled reason", async () => {
    const view = await mount();
    const editor = await openEditor(view.container);
    await settle(() => findButton(editor, "Save").click());
    expect(saveRule).toHaveBeenCalledTimes(1);
    expect(saveRule.mock.calls[0][0]).toEqual({
      confirmEnforcement: false,
      enforcementMode: "report_only",
      expectedVersion: 2,
      geofence: { latitude: 18.5204, longitude: 73.8567, maxAccuracyMeters: 75, radiusMeters: 150 },
      networks: [{ cidr: "203.0.113.0/24", kind: "office", label: "Main line" }],
      officeId: "offices_pune",
      reason: "Updated Pune office settings",
      requirement: "network_and_geofence",
      timeZone: "Asia/Kolkata",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Pune office saved.");
    await view.unmount();
  });

  test("Reads pasted coordinates and fixes a swapped pair", async () => {
    const view = await mount();
    const editor = await openEditor(view.container);
    const location = inputLabelled(editor, "Office location");

    await act(async () => typeInto(dom, location, "Thane station"));
    expect(editor.textContent).toContain("Paste two numbers separated by a comma");
    expect(location.getAttribute("aria-invalid")).toBe("true");

    await act(async () => typeInto(dom, location, "151.2093, -33.8688"));
    expect(editor.textContent).toContain("These look the wrong way round.");
    await settle(() => findButton(editor, "Use -33.8688, 151.2093").click());
    expect(location.value).toBe("-33.8688, 151.2093");

    await act(async () => typeInto(dom, location, "19.2183687, 72.9705434"));
    expect(editor.textContent).toContain("Pin set at 19.2183687, 72.9705434.");
    expect(location.getAttribute("aria-invalid")).toBeNull();
    await settle(() => findButton(editor, "Save").click());
    expect(saveRule.mock.calls[0][0].geofence).toEqual({
      latitude: 19.218_368_7,
      longitude: 72.970_543_4,
      maxAccuracyMeters: 75,
      radiusMeters: 150,
    });
    await view.unmount();
  });

  test("Blocks a save with a broken location and says why", async () => {
    const view = await mount();
    const editor = await openEditor(view.container);
    await act(async () => typeInto(dom, inputLabelled(editor, "Office location"), "19.21"));
    await settle(() => findButton(editor, "Save").click());
    expect(saveRule).not.toHaveBeenCalled();
    expect(editor.querySelector('[role="alert"]').textContent).toContain(
      "Paste two numbers separated by a comma"
    );
    await view.unmount();
  });

  test("Asks for confirmation before turning on Enforce", async () => {
    const view = await mount();
    const editor = await openEditor(view.container);
    await settle(() => editor.querySelector('input[name="mode"][value="enforce"]').click());
    expect(editor.textContent).toContain("Turning on Enforce affects everyone");

    await settle(() => findButton(editor, "Save").click());
    const confirmDialog = document.querySelector('[data-testid="portal-confirm-dialog"]');
    expect(confirmDialog?.textContent).toContain("Turn on Enforce for Pune office?");
    expect(saveRule).not.toHaveBeenCalled();

    await settle(() => document.querySelector('[data-testid="portal-confirm-cancel"]').click());
    expect(saveRule).not.toHaveBeenCalled();

    await settle(() => findButton(editor, "Save").click());
    await settle(() => document.querySelector('[data-testid="portal-confirm-submit"]').click());
    expect(saveRule).toHaveBeenCalledTimes(1);
    expect(saveRule.mock.calls[0][0]).toMatchObject({
      confirmEnforcement: true,
      enforcementMode: "enforce",
    });
    await view.unmount();
  });

  test("Confirms again when saving an office that already enforces, as the server requires", async () => {
    const view = await mount(overview({ enforcementMode: "enforce" }));
    const editor = await openEditor(view.container);
    await settle(() => findButton(editor, "Save").click());
    expect(document.querySelector('[data-testid="portal-confirm-dialog"]')?.textContent).toContain(
      "Save Pune office with Enforce on?"
    );
    await settle(() => document.querySelector('[data-testid="portal-confirm-submit"]').click());
    expect(saveRule.mock.calls[0][0]).toMatchObject({
      confirmEnforcement: true,
      enforcementMode: "enforce",
    });
    await view.unmount();
  });

  test("Saves staff changes one person at a time and shows who failed", async () => {
    assignStaffOffice.mockImplementation(({ staffId }) =>
      staffId === "staff_sam"
        ? Promise.reject(new Error("Staff member not found."))
        : Promise.resolve(null)
    );
    const view = await mount();
    await settle(() => findButton(view.container, "Staff (2)").click());
    const checklist = dialog();
    const box = (name) => findCheckbox(checklist, name);
    expect(checklist.textContent).toContain("Now at Thane office");

    // Tick Dev (no office) and Sam (from Thane); untick Meera.
    await act(async () => box("Dev Patel").click());
    await act(async () => box("Sam Fernandes").click());
    await act(async () => box("Meera Iyer").click());
    expect(checklist.textContent).toContain("2 people to add · 1 person to remove");
    expect(checklist.textContent).toContain("can't clock in until they're assigned again");

    await settle(() => findButton(checklist, "Save changes").click());
    expect(assignStaffOffice).toHaveBeenCalledTimes(3);
    expect(assignStaffOffice.mock.calls.map(([args]) => args)).toEqual([
      {
        officeId: "offices_pune",
        reason: "Assigned to Pune office in office setup",
        staffId: "staff_dev",
      },
      {
        officeId: null,
        reason: "Removed from Pune office in office setup",
        staffId: "staff_meera",
      },
      {
        officeId: "offices_pune",
        reason: "Assigned to Pune office in office setup",
        staffId: "staff_sam",
      },
    ]);
    expect(checklist.textContent).toContain("Not saved: Staff member not found.");
    expect(toastSuccess).not.toHaveBeenCalled();

    // Saving again retries only the person who failed.
    assignStaffOffice.mockClear();
    assignStaffOffice.mockImplementation(async () => null);
    await settle(() => findButton(checklist, "Save changes").click());
    expect(assignStaffOffice).toHaveBeenCalledTimes(1);
    expect(assignStaffOffice.mock.calls[0][0].staffId).toBe("staff_sam");
    expect(toastSuccess).toHaveBeenCalledWith("Staff updated for Pune office.");
    await view.unmount();
  });

  test("Filters the staff checklist by name", async () => {
    const view = await mount();
    await settle(() => findButton(view.container, "Staff (2)").click());
    const checklist = dialog();
    await act(async () => typeInto(dom, checklist.querySelector('input[type="search"]'), "sam"));
    const names = [...checklist.querySelectorAll('input[type="checkbox"]')].map(
      (input) => input.closest("label").textContent
    );
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("Sam Fernandes");
    await view.unmount();
  });
});

function findCheckbox(root, name) {
  return [...root.querySelectorAll('input[type="checkbox"]')].find((input) =>
    input.closest("label").textContent.includes(name)
  );
}
