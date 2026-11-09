import { afterEach, describe, expect, mock, test } from "bun:test";
import { LOCATION_REQUEST_OPTIONS, readLocation } from "./location";
import { pageBlocksLocation, shouldReloadForLocation } from "./pagePolicy";
import {
  checkBadgeFor,
  dayStatusFor,
  describeLocationProblem,
  describeRule,
  formatOfficeTime,
  locationHelpOrder,
  locationHelpPlatform,
  needsLocationHelp,
  officeTimeToTimestamp,
  reasonProblem,
  teamStatusFor,
  timestampToClockTime,
} from "./presentation";
import { parseOfficeCheckInResponse, submitOfficeCheckIn } from "./submit";

const originalNavigator = globalThis.navigator;

function setGeolocation(geolocation) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: geolocation ? { geolocation } : {},
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
});

function position({ accuracy = 18.5, latitude = 12.5, longitude = 77.25, timestamp }) {
  return { coords: { accuracy, latitude, longitude }, timestamp };
}

/**
 * A browser geolocation whose watch the test drives: `emit` delivers a reading,
 * `fail` an error, and `cleared` lists the watch ids the code stopped.
 */
function fakeWatch() {
  const watch = { cleared: [], emit: undefined, fail: undefined, options: undefined };
  setGeolocation({
    clearWatch: (id) => watch.cleared.push(id),
    watchPosition: (success, error, options) => {
      watch.emit = success;
      watch.fail = error;
      watch.options = options;
      return 7;
    },
  });
  return watch;
}

describe("readLocation", () => {
  test("Reports not_supported without a geolocation API", async () => {
    setGeolocation(undefined);
    expect(await readLocation()).toEqual({ code: "not_supported", kind: "error" });
  });

  test("Takes the first fresh high-accuracy reading, keeps its timestamp and stops listening", async () => {
    const watch = fakeWatch();
    const pending = readLocation();
    const takenAt = Date.now();
    watch.emit(position({ timestamp: takenAt }));
    expect(await pending).toEqual({
      accuracyMeters: 18.5,
      capturedAt: takenAt,
      kind: "position",
      latitude: 12.5,
      longitude: 77.25,
    });
    expect(watch.options).toEqual(LOCATION_REQUEST_OPTIONS);
    expect(watch.cleared).toEqual([7]);
    expect(LOCATION_REQUEST_OPTIONS).toEqual({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
  });

  test.each([
    [1, "permission_denied"],
    [2, "position_unavailable"],
    [3, "timeout"],
  ])("Maps error code %i to %s", async (code, expected) => {
    const watch = fakeWatch();
    const pending = readLocation();
    watch.fail({ code });
    expect(await pending).toEqual({ code: expected, kind: "error" });
    expect(watch.cleared).toEqual([7]);
  });

  test("Stops a watch that answered before its id was returned", async () => {
    const cleared = [];
    setGeolocation({
      clearWatch: (id) => cleared.push(id),
      watchPosition: (success) => {
        success(position({ timestamp: Date.now() }));
        return 3;
      },
    });
    expect((await readLocation()).kind).toBe("position");
    expect(cleared).toEqual([3]);
  });
});

describe("readLocation with a remembered position", () => {
  test("Skips the device's old position and waits for one taken after the press", async () => {
    const watch = fakeWatch();
    const pending = readLocation();
    watch.emit(position({ latitude: 1, timestamp: Date.now() - 45 * 60_000 }));
    const takenAt = Date.now();
    watch.emit(position({ latitude: 19.07, timestamp: takenAt }));
    const reading = await pending;
    expect(reading).toMatchObject({ capturedAt: takenAt, latitude: 19.07 });
    expect(watch.cleared).toEqual([7]);
  });

  test("Sends the newest old reading when no fresh one comes in time", async () => {
    const watch = fakeWatch();
    const pending = readLocation(1000, 20);
    const old = Date.now() - 45 * 60_000;
    watch.emit(position({ latitude: 1, timestamp: old }));
    watch.emit(position({ latitude: 2, timestamp: old + 1000 }));
    expect(await pending).toMatchObject({ capturedAt: old + 1000, latitude: 2 });
    expect(watch.cleared).toEqual([7]);
  });

  test("Sends the old reading rather than an error when the browser then gives up", async () => {
    const watch = fakeWatch();
    const pending = readLocation();
    const old = Date.now() - 45 * 60_000;
    watch.emit(position({ timestamp: old }));
    watch.fail({ code: 3 });
    expect(await pending).toMatchObject({ capturedAt: old, kind: "position" });
  });
});

describe("readLocation timestamps", () => {
  test("Scales a microsecond device timestamp back to milliseconds", async () => {
    const watch = fakeWatch();
    const pending = readLocation();
    const takenAt = Date.now();
    watch.emit(position({ timestamp: takenAt * 1000 }));
    expect((await pending).capturedAt).toBe(takenAt);
  });
});

describe("readLocation watchdog", () => {
  test("Reports a timeout when the browser never answers, so the press can finish", async () => {
    const watch = fakeWatch();
    expect(await readLocation(20)).toEqual({ code: "timeout", kind: "error" });
    expect(watch.cleared).toEqual([7]);
  });

  test("Ignores a late browser answer after the watchdog has fired", async () => {
    const watch = fakeWatch();
    const reading = await readLocation(10);
    watch.emit(position({ timestamp: Date.now() }));
    expect(reading).toEqual({ code: "timeout", kind: "error" });
  });
});

describe("submitOfficeCheckIn", () => {
  test("Posts only the action and location, never an IP", async () => {
    const fetcher = mock(async () => Response.json({ ok: true, replayed: false }));
    const request = {
      action: "clock_in",
      ip: "198.51.100.7",
      location: { kind: "not_requested" },
    };
    const result = await submitOfficeCheckIn(request, fetcher);
    expect(result).toEqual({ ok: true, replayed: false });
    const [path, init] = fetcher.mock.calls[0];
    expect(path).toBe("/api/portal/office-check-in");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      action: "clock_in",
      location: { kind: "not_requested" },
    });
  });

  test("Turns network failures and unknown bodies into UNAVAILABLE", async () => {
    const failing = mock(() => Promise.reject(new TypeError("offline")));
    expect(
      await submitOfficeCheckIn(
        { action: "clock_out", location: { kind: "not_requested" } },
        failing
      )
    ).toMatchObject({ code: "UNAVAILABLE", ok: false });
    expect(parseOfficeCheckInResponse({ code: "NOPE", ok: false })).toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(parseOfficeCheckInResponse({ code: "NOT_CLOCKED_IN", error: "x", ok: false })).toEqual({
      code: "NOT_CLOCKED_IN",
      error: "x",
      ok: false,
    });
  });
});

describe("Office check-in presentation", () => {
  test("Converts office wall-clock times both ways in the office time zone", () => {
    const timestamp = officeTimeToTimestamp("2026-11-05", "09:15", "Asia/Kolkata");
    expect(timestamp).toBe(Date.UTC(2026, 10, 5, 3, 45));
    expect(timestampToClockTime(timestamp, "Asia/Kolkata")).toBe("09:15");
    expect(formatOfficeTime(timestamp, "Europe/London")).toBe("03:45");
    expect(officeTimeToTimestamp("2026-11-05", "25:00", "Asia/Kolkata")).toBeNull();
    expect(officeTimeToTimestamp("05/11/2026", "09:00", "Asia/Kolkata")).toBeNull();
  });

  test("Handles a daylight-saving office day", () => {
    const summer = officeTimeToTimestamp("2026-07-01", "09:00", "Europe/London");
    expect(summer).toBe(Date.UTC(2026, 6, 1, 8, 0));
    expect(timestampToClockTime(summer, "Europe/London")).toBe("09:00");
  });

  test("Describes rules and failures without claiming proof", () => {
    expect(describeRule("network_and_geofence")).toBe(
      "This office checks your location and that you're on the office internet."
    );
    expect(describeLocationProblem("permission_denied")).toBe(
      "Recorded without your location, so this check is marked uncertain. Your browser or device blocked location. The steps below turn it on."
    );
    for (const text of [describeRule("network"), describeLocationProblem("timeout")]) {
      expect(text.toLowerCase()).not.toContain("prove");
    }
  });

  test("Derives one day status per record", () => {
    expect(dayStatusFor(null)).toBe("not_checked_in");
    expect(dayStatusFor({ admission: "pending_review", status: "open" })).toBe("awaiting_review");
    expect(dayStatusFor({ admission: "admitted", status: "open" })).toBe("checked_in");
    expect(dayStatusFor({ admission: "admitted", status: "closed" })).toBe("checked_out");
    expect(dayStatusFor({ admission: "rejected", status: "closed" })).toBe("rejected");
  });

  test("Gives each team row one status in words", () => {
    const record = (overrides) => ({
      admission: "admitted",
      clockIn: { outcome: "pass" },
      source: "self",
      status: "open",
      ...overrides,
    });
    const label = (value) => teamStatusFor(value).label;
    expect(label(null)).toBe("Not in");
    expect(label(record())).toBe("In · Pass");
    expect(label(record({ clockIn: { outcome: "uncertain" } }))).toBe("In · Uncertain");
    expect(label(record({ status: "closed" }))).toBe("Out · Pass");
    expect(label(record({ clockIn: { outcome: "fail" }, status: "closed" }))).toBe("Out · Fail");
    expect(label(record({ admission: "pending_review" }))).toBe("Awaiting review");
    expect(label(record({ admission: "rejected" }))).toBe("Rejected");
    expect(label(record({ source: "manager_entry", status: "closed" }))).toBe("Out · Manual entry");
    expect(teamStatusFor(record()).tone).toBe("green");
    expect(teamStatusFor(record({ clockIn: { outcome: "uncertain" } })).tone).toBe("amber");
  });

  test("Shows the person's own answer in place of a check that didn't pass", () => {
    const failed = (overrides) => ({
      admission: "admitted",
      clockIn: { outcome: "fail" },
      source: "self",
      status: "open",
      ...overrides,
    });
    expect(teamStatusFor(failed({ awayReason: "on_tour" }))).toEqual({
      label: "On tour",
      tone: "blue",
    });
    expect(teamStatusFor(failed({ awayReason: "market_visit", status: "closed" }))).toEqual({
      label: "Sales call",
      tone: "gray",
    });
    expect(teamStatusFor(failed({ awayReason: "out_of_office" })).label).toBe("Work from home");
    // A held check-in still says it needs the manager.
    expect(
      teamStatusFor(failed({ admission: "pending_review", awayReason: "on_tour" })).label
    ).toBe("Awaiting review");
    // A pass ignores any stale answer.
    expect(
      teamStatusFor(failed({ awayReason: "on_tour", clockIn: { outcome: "pass" } })).label
    ).toBe("In · Pass");
  });

  test("Requires a 3 to 500 character reason", () => {
    expect(reasonProblem("  ok ")).not.toBeNull();
    expect(reasonProblem("Confirmed with branch")).toBeNull();
    expect(reasonProblem("x".repeat(501))).not.toBeNull();
  });
});

describe("Location help", () => {
  const device = (userAgent, maxTouchPoints = 0) => ({ maxTouchPoints, userAgent });

  test("Picks the steps for the device in use", () => {
    expect(
      locationHelpPlatform(
        device("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141")
      )
    ).toBe("mac");
    expect(
      locationHelpPlatform(device("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141"))
    ).toBe("windows");
    expect(
      locationHelpPlatform(device("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"))
    ).toBe("iphone");
    expect(locationHelpPlatform(device("Mozilla/5.0 (Linux; Android 15; Pixel 9)"))).toBe(
      "android"
    );
    // iPadOS reports a Mac user agent but has a touch screen.
    expect(locationHelpPlatform(device("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5))).toBe(
      "iphone"
    );
    expect(locationHelpPlatform(device("Mozilla/5.0 (X11; Linux x86_64)"))).toBeNull();
  });

  test("Lists the device in use first, then every other one", () => {
    expect(locationHelpOrder("windows")).toEqual(["windows", "mac", "iphone", "android"]);
    expect(locationHelpOrder(null)).toEqual(["mac", "windows", "iphone", "android"]);
  });

  test("Offers help only when location could be turned on", () => {
    expect(needsLocationHelp("permission_denied")).toBe(true);
    expect(needsLocationHelp("position_unavailable")).toBe(true);
    expect(needsLocationHelp("timeout")).toBe(true);
    expect(needsLocationHelp("not_supported")).toBe(false);
  });
});

describe("Page location policy", () => {
  const gate = (allowed) => ({ allowsFeature: (feature) => feature === "geolocation" && allowed });

  test("Reads the page's own policy through either browser API", () => {
    expect(pageBlocksLocation({ permissionsPolicy: gate(false) })).toBe(true);
    expect(pageBlocksLocation({ featurePolicy: gate(false) })).toBe(true);
    expect(pageBlocksLocation({ permissionsPolicy: gate(true) })).toBe(false);
    // Browsers without the API never trigger a reload.
    expect(pageBlocksLocation({})).toBe(false);
  });

  test("Reloads at most once a minute, so a page that still blocks can't loop", () => {
    expect(shouldReloadForLocation(null, 1000)).toBe(true);
    expect(shouldReloadForLocation(1000, 30_000)).toBe(false);
    expect(shouldReloadForLocation(1000, 62_000)).toBe(true);
    expect(shouldReloadForLocation(Number.POSITIVE_INFINITY, 62_000)).toBe(false);
  });
});

describe("Check badges with an away answer", () => {
  test("Says Under review or Not in office instead of Fail, and leaves a pass alone", () => {
    expect(checkBadgeFor("fail", "on_tour")).toEqual({ label: "Under review", tone: "amber" });
    expect(checkBadgeFor("uncertain", "market_visit")).toEqual({
      label: "Under review",
      tone: "amber",
    });
    expect(checkBadgeFor("fail", "out_of_office")).toEqual({
      label: "Not in office",
      tone: "gray",
    });
    expect(checkBadgeFor("fail")).toEqual({ label: "Fail", tone: "red" });
    expect(checkBadgeFor("uncertain")).toEqual({ label: "Uncertain", tone: "amber" });
    expect(checkBadgeFor("pass", "on_tour")).toEqual({ label: "Pass", tone: "green" });
  });
});
