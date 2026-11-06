import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { act } from "react";
import { findButton, installPortalDom, typeInto } from "./officeCheckInTestHarness";

const dom = installPortalDom("https://citiusholidays.com/portal/office-check-in");

let createRoot;
let OfficeCheckInView;
let state;
const review = mock(async () => null);
const correctTimes = mock(async () => null);
const recordManualEntry = mock(async () => "officeCheckIns_new");
const deleteCheckIn = mock(async () => ({ mode: "erase" }));
const toastSuccess = mock(() => undefined);
const fetchMock = mock(async () => Response.json({ ok: true, replayed: false }));
const getCurrentPosition = mock(() => undefined);
const originalFetch = globalThis.fetch;
const originalNavigator = globalThis.navigator;

function verification(outcome, reason) {
  return {
    enforcementMode: "report_only",
    evaluatedAt: 1,
    network: { outcome, reason },
    outcome,
    requirement: "network",
    wouldBlock: outcome !== "pass",
  };
}

function checkIn(staffId, overrides = {}) {
  return {
    _creationTime: 1,
    _id: `officeCheckIns_${staffId}`,
    admission: "admitted",
    clockIn: verification("pass", "matched_office"),
    clockInAt: Date.UTC(2026, 10, 5, 3, 45),
    createdAt: 1,
    officeId: "offices_1",
    source: "self",
    staffId,
    status: "open",
    updatedAt: 1,
    workDate: "2026-11-05",
    ...overrides,
  };
}

function myStatus(overrides = {}) {
  const sessions = overrides.sessions ?? (overrides.today ? [overrides.today] : []);
  return {
    canOversee: false,
    deletion: null,
    hasOpenSession: sessions.some((session) => session.status === "open"),
    hasStaffProfile: true,
    office: { active: true, city: "Pune", id: "offices_1", name: "Pune office" },
    openFromEarlierDay: null,
    rule: {
      configured: true,
      enforcementMode: "report_only",
      needsLocation: false,
      requirement: "network",
    },
    sessions,
    timeZone: "Asia/Kolkata",
    today: sessions[0] ?? null,
    workDate: "2026-11-05",
    ...overrides,
  };
}

/** `sessions` is newest first, like the server; `checkIn` is the newest. */
function teamRow(staffId, name, record, earlier = []) {
  const sessions = record ? [record, ...earlier] : [];
  return {
    canReview: true,
    checkIn: record,
    department: "Sales",
    name,
    officeId: "offices_1",
    officeName: "Pune office",
    sessions,
    staffId,
    timeZone: "Asia/Kolkata",
  };
}

function team() {
  return {
    offices: [{ id: "offices_1", name: "Pune office", timeZone: "Asia/Kolkata" }],
    rows: [
      teamRow("staff_asha", "Asha Rao", checkIn("staff_asha")),
      teamRow(
        "staff_vikram",
        "Vikram Shah",
        checkIn("staff_vikram", {
          admission: "pending_review",
          clockIn: verification("fail", "outside_allowlist"),
        })
      ),
      teamRow(
        "staff_meera",
        "Meera Iyer",
        checkIn("staff_meera", { clockOutAt: Date.UTC(2026, 10, 5, 12, 30), status: "closed" })
      ),
      teamRow("staff_dev", "Dev Patel", null),
    ],
    truncated: false,
    workDate: "2026-11-05",
  };
}

const MUTATIONS = {
  "crm/officeCheckIns:correctTimes": correctTimes,
  "crm/officeCheckIns:deleteCheckIn": deleteCheckIn,
  "crm/officeCheckIns:recordManualEntry": recordManualEntry,
  "crm/officeCheckIns:review": review,
};

beforeAll(async () => {
  mock.module("convex/react", () => ({
    useMutation: (reference) => MUTATIONS[getFunctionName(reference)] ?? mock(async () => null),
    usePaginatedQuery: () => ({ loadMore: () => undefined, results: [], status: "Exhausted" }),
    useQuery: (reference, args) => {
      if (args === "skip") {
        return;
      }
      switch (getFunctionName(reference)) {
        case "crm/officeCheckIns:myStatus":
          return state.status;
        case "crm/officeCheckIns:teamDay":
          return state.team;
        case "crm/officeCheckIns:history":
          return [];
        case "crm/officeCheckInAdmin:overview":
          state.overviewReads += 1;
          return state.overview;
        default:
          return;
      }
    },
  }));
  mock.module("@/components/portal/PortalToast", () => ({
    usePortalToast: () => ({ error: () => undefined, success: toastSuccess }),
  }));
  globalThis.fetch = fetchMock;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { geolocation: { getCurrentPosition }, userAgent: "bun-test" },
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ OfficeCheckInView } = await import("./OfficeCheckInView"));
});

beforeEach(() => {
  state = {
    overview: { offices: [], recentAudit: [], staff: [], unmatchedNetworks: [] },
    overviewReads: 0,
    status: myStatus(),
    team: { ...team(), rows: [] },
  };
  for (const fn of [
    review,
    correctTimes,
    recordManualEntry,
    deleteCheckIn,
    toastSuccess,
    fetchMock,
  ]) {
    fn.mockClear();
  }
  getCurrentPosition.mockReset();
  document.body.innerHTML = "";
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
  mock.restore();
  dom.window.close();
});

async function mount({ admin = false } = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const has = (permission) => admin && permission === "manage:staff";
  await act(async () =>
    root.render(<OfficeCheckInView access={{ roles: ["Sales"] }} allowed canFetch has={has} />)
  );
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

async function press(button) {
  await act(() => {
    button.click();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function postedBody() {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(init.body);
}

describe("Office check-in: my day", () => {
  test("Clock in without a location rule sends not_requested and no IP", async () => {
    const view = await mount();
    expect(view.container.textContent).toContain(
      "This office checks that you're on the office internet."
    );
    expect(view.container.textContent).toContain("Nothing is blocked during the pilot.");

    await press(findButton(view.container, "Clock in"));

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/portal/office-check-in");
    const body = postedBody();
    expect(body).toEqual({ action: "clock_in", location: { kind: "not_requested" } });
    expect(Object.keys(body)).not.toContain("ip");
    expect(view.container.querySelector('[role="status"][aria-live="polite"]').textContent).toBe(
      "Clock-in recorded."
    );
    await view.unmount();
  });

  test("Asks for location only on the press, when the rule needs it", async () => {
    state.status = myStatus({
      rule: {
        configured: true,
        enforcementMode: "enforce",
        needsLocation: true,
        requirement: "network_and_geofence",
      },
    });
    getCurrentPosition.mockImplementation((success) =>
      success({
        coords: { accuracy: 12, latitude: 18.52, longitude: 73.85 },
        timestamp: 1_762_300_000_000,
      })
    );
    const view = await mount();

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain(
      "Your browser asks for your location once, when you press the button."
    );
    expect(view.container.textContent).toContain("a manager reviews it before it counts");

    await press(findButton(view.container, "Clock in"));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(postedBody()).toEqual({
      action: "clock_in",
      location: {
        accuracyMeters: 12,
        capturedAt: 1_762_300_000_000,
        kind: "position",
        latitude: 18.52,
        longitude: 73.85,
      },
    });
    await view.unmount();
  });

  test("Keeps the busy Clock in button focusable and ignores a repeat press", async () => {
    state.status = myStatus({
      rule: {
        configured: true,
        enforcementMode: "report_only",
        needsLocation: true,
        requirement: "geofence",
      },
    });
    let answer;
    getCurrentPosition.mockImplementation((_success, error) => {
      answer = error;
    });
    const view = await mount();
    const button = findButton(view.container, "Clock in");
    expect(document.getElementById(button.getAttribute("aria-describedby")).textContent).toContain(
      "Your browser asks for your location once"
    );

    button.focus();
    await press(button);
    // Native disabled would drop keyboard focus to the page mid-press.
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(button);
    await press(button);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer({ code: 3 });
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-disabled")).toBeNull();
    await view.unmount();
  });

  test("Denied permission shows a plain message and still submits the reading", async () => {
    state.status = myStatus({
      rule: {
        configured: true,
        enforcementMode: "report_only",
        needsLocation: true,
        requirement: "geofence",
      },
    });
    getCurrentPosition.mockImplementation((_success, error) => error({ code: 1 }));
    const view = await mount();

    await press(findButton(view.container, "Clock in"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(postedBody()).toEqual({
      action: "clock_in",
      location: { code: "permission_denied", kind: "error" },
    });
    const status = view.container.querySelector('[role="status"][aria-live="polite"]').textContent;
    expect(status).toContain("Location access is turned off for this site in your browser.");
    expect(status).toContain("Your times were still recorded without a location.");
    await view.unmount();
  });

  test("Shows the route's refusal as an alert", async () => {
    fetchMock.mockImplementationOnce(async () =>
      Response.json(
        { code: "NO_OFFICE_ASSIGNED", error: "NO_OFFICE_ASSIGNED", ok: false },
        { status: 409 }
      )
    );
    const view = await mount();
    await press(findButton(view.container, "Clock in"));
    expect(view.container.querySelector('[role="alert"]').textContent).toBe(
      "You aren't assigned to an office yet. Ask an admin to assign you."
    );
    await view.unmount();
  });

  test("Offers Clock out with today's result once clocked in", async () => {
    state.status = myStatus({ today: checkIn("staff_me") });
    const view = await mount();
    expect(findButton(view.container, "Clock out")).toBeTruthy();
    expect(view.container.textContent).toContain("09:15");
    expect(view.container.textContent).toContain("Clock-in checkPass");
    await view.unmount();
  });

  test("Explains a check that didn't pass in plain words", async () => {
    state.status = myStatus({
      today: checkIn("staff_me", { clockIn: verification("fail", "outside_allowlist") }),
    });
    const view = await mount();
    expect(view.container.textContent).toContain("Not connected through the office internet.");
    await view.unmount();
  });
});

describe("Office check-in: Today and Office setup", () => {
  test("Shows no section switch to people who can't set up offices", async () => {
    state.status = myStatus({ canOversee: true });
    state.team = team();
    const view = await mount();
    expect(findButton(view.container, "Office setup")).toBeUndefined();
    expect(view.container.textContent).toContain("My day");
    expect(state.overviewReads).toBe(0);
    await view.unmount();
  });

  test("Lets an admin switch to Office setup, which reads the overview only then", async () => {
    const view = await mount({ admin: true });
    const setup = findButton(view.container, "Office setup");
    expect(findButton(view.container, "Today").getAttribute("aria-pressed")).toBe("true");
    expect(setup.getAttribute("aria-pressed")).toBe("false");
    expect(state.overviewReads).toBe(0);

    await press(setup);
    expect(setup.getAttribute("aria-pressed")).toBe("true");
    expect(view.container.textContent).toContain("Offices");
    expect(view.container.textContent).not.toContain("My day");
    expect(state.overviewReads).toBeGreaterThan(0);

    await press(findButton(view.container, "Today"));
    expect(view.container.textContent).toContain("My day");
    await view.unmount();
  });
});

describe("Office check-in: team today", () => {
  test("Hides the team list from people who oversee no one", async () => {
    const view = await mount();
    expect(view.container.textContent).not.toContain("Team today");
    await view.unmount();
  });

  test("Gives each person one status in words, times in and out, and one action", async () => {
    state.status = myStatus({ canOversee: true });
    state.team = team();
    const view = await mount();
    const table = view.container.querySelector("table");
    const rowFor = (name) =>
      [...table.querySelectorAll("tbody tr")].find((row) => row.textContent.includes(name));

    expect(view.container.textContent).toContain("Team today");
    expect(rowFor("Asha Rao").textContent).toContain("In · Pass");
    expect(rowFor("Vikram Shah").textContent).toContain("Awaiting review");
    expect(rowFor("Meera Iyer").textContent).toContain("Out · Pass");
    expect(rowFor("Meera Iyer").textContent).toContain("09:15 → 18:00");
    expect(rowFor("Dev Patel").textContent).toContain("Not in");
    for (const name of ["Asha Rao", "Vikram Shah", "Meera Iyer", "Dev Patel"]) {
      const buttons = rowFor(name).querySelectorAll("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0].getAttribute("aria-label")).toBe(`Open ${name}`);
      expect(buttons[0].textContent).toBe("Open");
    }
    expect(view.container.textContent).toContain("1 in · 1 out · 1 awaiting review · 1 not in");
    // One office: no office filter, and no department or office sublines.
    expect(view.container.querySelector("#office-check-in-team-office")).toBeNull();
    expect(table.textContent).not.toContain("Sales");
    await view.unmount();
  });

  test("Opens a pending check-in straight into a review that needs a reason", async () => {
    state.status = myStatus({ canOversee: true });
    state.team = team();
    const view = await mount();

    await press(findButton(view.container, "Open Vikram Shah"));
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("Vikram Shah");
    expect(dialog.textContent).toContain("Not connected through the office internet.");

    await act(() => {
      dialog.querySelector('input[value="accepted"]').click();
    });
    await press(findButton(dialog, "Save review"));

    const reason = dialog.querySelector("textarea");
    expect(review).not.toHaveBeenCalled();
    expect(reason.getAttribute("aria-invalid")).toBe("true");
    expect(dialog.textContent).toContain("Enter a reason of at least 3 characters.");

    await act(async () => typeInto(dom, reason, "Confirmed with the branch manager"));
    await press(findButton(dialog, "Save review"));

    expect(review).toHaveBeenCalledWith({
      checkInId: "officeCheckIns_staff_vikram",
      decision: "accepted",
      reason: "Confirmed with the branch manager",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Review saved for Vikram Shah.");
    await view.unmount();
  });

  test("Offers Review and Correct times from one record dialog", async () => {
    state.status = myStatus({ canOversee: true });
    state.team = team();
    const view = await mount();

    await press(findButton(view.container, "Open Asha Rao"));
    const dialog = document.querySelector('[role="dialog"]');
    expect(findButton(dialog, "Review")).toBeTruthy();
    expect(findButton(dialog, "Correct times")).toBeTruthy();

    await press(findButton(dialog, "Correct times"));
    const [clockIn] = dialog.querySelectorAll('input[type="time"]');
    expect(clockIn.value).toBe("09:15");
    await act(async () => typeInto(dom, clockIn, "09:05"));
    await act(async () => typeInto(dom, dialog.querySelector("textarea"), "Badge time was late"));
    await press(findButton(dialog, "Save times"));
    expect(correctTimes).toHaveBeenCalledWith({
      checkInId: "officeCheckIns_staff_asha",
      clockInAt: Date.UTC(2026, 10, 5, 3, 35),
      clockOutAt: null,
      reason: "Badge time was late",
    });
    await view.unmount();
  });

  test("Adds an entry for someone with no check-in, with a reason", async () => {
    state.status = myStatus({ canOversee: true });
    state.team = team();
    const view = await mount();

    await press(findButton(view.container, "Open Dev Patel"));
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("Add an entry for Dev Patel");
    const [clockIn] = dialog.querySelectorAll('input[type="time"]');
    await act(async () => typeInto(dom, clockIn, "09:30"));
    await press(findButton(dialog, "Add entry"));
    expect(recordManualEntry).not.toHaveBeenCalled();

    await act(async () => typeInto(dom, dialog.querySelector("textarea"), "Badge reader was down"));
    await press(findButton(dialog, "Add entry"));
    expect(recordManualEntry).toHaveBeenCalledWith({
      clockInAt: Date.UTC(2026, 10, 5, 4, 0),
      clockOutAt: null,
      reason: "Badge reader was down",
      staffId: "staff_dev",
      workDate: "2026-11-05",
    });
    await view.unmount();
  });
});

// 09:15 → 13:00 and 14:05 → 18:00 IST.
const MORNING = {
  _id: "officeCheckIns_morning",
  clockInAt: Date.UTC(2026, 10, 5, 3, 45),
  clockOutAt: Date.UTC(2026, 10, 5, 7, 30),
  status: "closed",
};
const AFTERNOON = { _id: "officeCheckIns_afternoon", clockInAt: Date.UTC(2026, 10, 5, 8, 35) };

function daySessions(staffId, { afternoonOpen = false } = {}) {
  const afternoon = afternoonOpen
    ? checkIn(staffId, AFTERNOON)
    : checkIn(staffId, {
        ...AFTERNOON,
        clockOutAt: Date.UTC(2026, 10, 5, 12, 30),
        status: "closed",
      });
  return [afternoon, checkIn(staffId, MORNING)];
}

function dialogEl() {
  return document.querySelector('[role="dialog"]');
}

describe("Office check-in: several sessions a day", () => {
  test("Offers Clock in again after clocking out and lists today's sessions", async () => {
    state.status = myStatus({ sessions: daySessions("staff_me") });
    const view = await mount();

    expect(findButton(view.container, "Clock out")).toBeUndefined();
    expect(findButton(view.container, "Clock in")).toBeUndefined();
    expect(view.container.textContent).toContain("Today: 09:15 → 13:00 · 14:05 → 18:00");
    // Plain staff get no delete action on their own sessions.
    expect(findButton(view.container, "Delete")).toBeUndefined();

    await press(findButton(view.container, "Clock in again"));
    expect(postedBody()).toEqual({ action: "clock_in", location: { kind: "not_requested" } });
    expect(view.container.querySelector('[role="status"][aria-live="polite"]').textContent).toBe(
      "Clock-in recorded."
    );
    await view.unmount();
  });

  test("Shows a still-open second session as open, with Clock out", async () => {
    state.status = myStatus({ sessions: daySessions("staff_me", { afternoonOpen: true }) });
    const view = await mount();
    expect(findButton(view.container, "Clock out")).toBeTruthy();
    expect(view.container.textContent).toContain("09:15 → 13:00 · 14:05 → open");
    await view.unmount();
  });

  test("Lets an Admin delete their own session behind a confirmation", async () => {
    state.status = myStatus({ deletion: "erase", sessions: daySessions("staff_me") });
    const view = await mount();
    expect(view.container.textContent).toContain("Today's sessions");

    await press(findButton(view.container, "Delete session 09:15 → 13:00"));
    const dialog = dialogEl();
    expect(dialog.textContent).toContain("Delete session?");
    expect(dialog.textContent).toContain("This removes the session and its history completely.");
    expect(deleteCheckIn).not.toHaveBeenCalled();

    // The reason is optional for Admin.
    await press(findButton(dialog, "Delete session"));
    expect(deleteCheckIn).toHaveBeenCalledWith({ checkInId: "officeCheckIns_morning" });
    expect(toastSuccess).toHaveBeenCalledWith("Session deleted.");
    await view.unmount();
  });

  test("Never offers a Director a delete on their own sessions", async () => {
    state.status = myStatus({ deletion: "trail", sessions: daySessions("staff_me") });
    const view = await mount();
    expect(view.container.querySelector('button[aria-label^="Delete session"]')).toBeNull();
    await view.unmount();
  });

  test("Shows first in to last out with a sessions hint, and each session in the dialog", async () => {
    state.status = myStatus({ canOversee: true });
    state.team = {
      ...team(),
      rows: [
        teamRow("staff_asha", "Asha Rao", ...splitSessions(daySessions("staff_asha"))),
        teamRow("staff_dev", "Dev Patel", null),
      ],
    };
    const view = await mount();
    const asha = [...view.container.querySelectorAll("tbody tr")].find((row) =>
      row.textContent.includes("Asha Rao")
    );
    expect(asha.textContent).toContain("09:15 → 18:00");
    expect(asha.textContent).toContain("2 sessions");
    expect(asha.querySelectorAll("button")).toHaveLength(1);

    await press(findButton(view.container, "Open Asha Rao"));
    const dialog = dialogEl();
    const sessions = [...dialog.querySelectorAll("section[aria-label]")].map((section) =>
      section.getAttribute("aria-label")
    );
    expect(sessions).toEqual(["Session 14:05 → 18:00", "Session 09:15 → 13:00"]);
    expect(dialog.querySelectorAll('section button[type="button"]')).toHaveLength(4);
    // Nobody but Admin and Directors sees a delete.
    expect(findButton(dialog, "Delete session")).toBeUndefined();
    expect(findButton(dialog, "Add a session")).toBeTruthy();
    await view.unmount();
  });

  test("Lets a Director delete one session with a required reason", async () => {
    deleteCheckIn.mockImplementationOnce(async () => ({ mode: "trail" }));
    state.status = myStatus({ canOversee: true, deletion: "trail" });
    state.team = {
      ...team(),
      rows: [teamRow("staff_asha", "Asha Rao", ...splitSessions(daySessions("staff_asha")))],
    };
    const view = await mount();
    await press(findButton(view.container, "Open Asha Rao"));
    const morning = dialogEl().querySelector('section[aria-label="Session 09:15 → 13:00"]');
    await press(findButton(morning, "Delete session"));

    const dialog = dialogEl();
    expect(dialog.textContent).toContain(
      "This removes the session. A record of the deletion and your reason is kept."
    );
    await press(findButton(dialog, "Delete session"));
    const reason = dialog.querySelector("textarea");
    expect(deleteCheckIn).not.toHaveBeenCalled();
    expect(reason.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(reason);

    await act(async () => typeInto(dom, reason, "Duplicate from a test"));
    await press(findButton(dialog, "Delete session"));
    expect(deleteCheckIn).toHaveBeenCalledWith({
      checkInId: "officeCheckIns_morning",
      reason: "Duplicate from a test",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Session deleted for Asha Rao.");
    await view.unmount();
  });

  test("Keeps the delete dialog open and usable when the delete fails", async () => {
    deleteCheckIn.mockImplementationOnce(() => Promise.reject(new Error("Network down")));
    toastSuccess.mockClear();
    state.status = myStatus({ deletion: "erase", sessions: daySessions("staff_me") });
    const view = await mount();
    await press(findButton(view.container, "Delete session 09:15 → 13:00"));
    const dialog = dialogEl();
    await press(findButton(dialog, "Delete session"));
    expect(deleteCheckIn).toHaveBeenCalledWith({ checkInId: "officeCheckIns_morning" });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(dialogEl()).toBe(dialog);
    expect(dialog.textContent).toContain("Network down");
    expect(findButton(dialog, "Delete session").disabled).toBe(false);
    await view.unmount();
  });
});

/** [newest, ...earlier] as teamRow's record and earlier arguments. */
function splitSessions([newest, ...earlier]) {
  return [newest, earlier];
}
