import type { GeolocationErrorCode, LocationReading } from "@convex/crm/officeCheckInVerification";

/** Options sent to the browser for the single reading taken on Clock in / Clock out. */
export const LOCATION_REQUEST_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

/**
 * Upper bound on one Clock in / Clock out location wait. The browser's own
 * `timeout` only starts once permission is granted, so a permission prompt
 * that is dismissed or left open can leave both callbacks uncalled. After
 * this long the press continues without a location, recorded as a timeout.
 */
const LOCATION_WATCHDOG_MS = 30_000;

/**
 * Epoch milliseconds stay below this until about year 5138. Some WebKit builds
 * report `position.timestamp` in microseconds, which the server would reject
 * as a stale reading; those values are scaled back to milliseconds.
 */
const MICROSECOND_TIMESTAMP_FLOOR = 100_000_000_000_000;

function capturedAtMs(timestamp: number) {
  return timestamp >= MICROSECOND_TIMESTAMP_FLOOR ? Math.round(timestamp / 1000) : timestamp;
}

// GeolocationPositionError codes from the Geolocation API specification.
// POSITION_UNAVAILABLE (2) and any unknown code map to "position_unavailable".
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

function errorCodeFor(code: number): GeolocationErrorCode {
  if (code === PERMISSION_DENIED) {
    return "permission_denied";
  }
  return code === TIMEOUT ? "timeout" : "position_unavailable";
}

function geolocationApi(): Geolocation | null {
  const runtimeNavigator: Navigator | undefined = globalThis.navigator;
  return runtimeNavigator?.geolocation ?? null;
}

/**
 * Takes one device location reading. Call only from the Clock in / Clock out
 * press, and only when the office rule needs location. It never watches the
 * position and never rejects: every failure becomes a reading the server
 * records as "uncertain".
 */
export function readLocation(watchdogMs = LOCATION_WATCHDOG_MS): Promise<LocationReading> {
  const geolocation = geolocationApi();
  if (!geolocation) {
    return Promise.resolve({ code: "not_supported", kind: "error" });
  }
  return new Promise((settle) => {
    let settled = false;
    // Whichever comes first wins: the browser's answer or the watchdog.
    const resolve = (reading: LocationReading) => {
      if (!settled) {
        settled = true;
        globalThis.clearTimeout(watchdog);
        settle(reading);
      }
    };
    const watchdog = globalThis.setTimeout(
      () => resolve({ code: "timeout", kind: "error" }),
      watchdogMs
    );
    try {
      geolocation.getCurrentPosition(
        (position) => {
          resolve({
            accuracyMeters: position.coords.accuracy,
            capturedAt: capturedAtMs(position.timestamp),
            kind: "position",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => resolve({ code: errorCodeFor(error.code), kind: "error" }),
        LOCATION_REQUEST_OPTIONS
      );
    } catch {
      resolve({ code: "not_supported", kind: "error" });
    }
  });
}
