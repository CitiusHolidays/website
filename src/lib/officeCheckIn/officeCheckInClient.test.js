import { afterEach, describe, expect, mock, test } from "bun:test";
import { LOCATION_REQUEST_OPTIONS, readLocation } from "./location";
import {
  dayStatusFor,
  describeLocationProblem,
  describeRule,
  formatOfficeTime,
  officeTimeToTimestamp,
  reasonProblem,
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

describe("readLocation", () => {
  test("Reports not_supported without a geolocation API", async () => {
    setGeolocation(undefined);
    expect(await readLocation()).toEqual({ code: "not_supported", kind: "error" });
  });

  test("Takes one fresh high-accuracy reading and keeps the device timestamp", async () => {
    const getCurrentPosition = mock((success, _error, options) => {
      expect(options).toEqual(LOCATION_REQUEST_OPTIONS);
      success({
        coords: { accuracy: 18.5, latitude: 12.5, longitude: 77.25 },
        timestamp: 1_700_000_000_000,
      });
    });
    setGeolocation({ getCurrentPosition });
    expect(await readLocation()).toEqual({
      accuracyMeters: 18.5,
      capturedAt: 1_700_000_000_000,
      kind: "position",
      latitude: 12.5,
      longitude: 77.25,
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
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
    setGeolocation({
      getCurrentPosition: (_success, error) => error?.({ code }),
    });
    expect(await readLocation()).toEqual({ code: expected, kind: "error" });
  });
});

describe("readLocation timestamps", () => {
  test("Scales a microsecond device timestamp back to milliseconds", async () => {
    setGeolocation({
      getCurrentPosition: (success) =>
        success({
          coords: { accuracy: 25, latitude: 18.5, longitude: 73.8 },
          timestamp: 1_793_917_339_994_000,
        }),
    });
    expect((await readLocation()).capturedAt).toBe(1_793_917_339_994);
  });
});

describe("readLocation watchdog", () => {
  test("Reports a timeout when the browser never answers, so the press can finish", async () => {
    setGeolocation({ getCurrentPosition: () => undefined });
    expect(await readLocation(20)).toEqual({ code: "timeout", kind: "error" });
  });

  test("Ignores a late browser answer after the watchdog has fired", async () => {
    let late;
    setGeolocation({
      getCurrentPosition: (success) => {
        late = success;
      },
    });
    const reading = await readLocation(10);
    late({ coords: { accuracy: 5, latitude: 1, longitude: 2 }, timestamp: 1 });
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
      "This office checks the office network and your location."
    );
    expect(describeLocationProblem("permission_denied")).toContain(
      "Your times were still recorded without a location."
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

  test("Requires a 3 to 500 character reason", () => {
    expect(reasonProblem("  ok ")).not.toBeNull();
    expect(reasonProblem("Confirmed with branch")).toBeNull();
    expect(reasonProblem("x".repeat(501))).not.toBeNull();
  });
});
