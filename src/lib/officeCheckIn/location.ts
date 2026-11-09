import type { GeolocationErrorCode, LocationReading } from "@convex/crm/officeCheckInVerification";

/** Options sent to the browser while reading the location for Clock in / Clock out. */
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
 * A reading counts as taken for this press when the device stamped it no more
 * than this long before the press. Older ones are the device's remembered
 * position (macOS hands that back first after a sleep, even with
 * `maximumAge: 0`), so the wait continues for a fresh one.
 */
const FRESH_READING_SLACK_MS = 10_000;

/**
 * Once only an old reading has arrived, how long to keep waiting for a fresh
 * one before sending the old one, which the server records as uncertain.
 */
const STALE_FALLBACK_WAIT_MS = 10_000;

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

type PositionReading = Extract<LocationReading, { kind: "position" }>;

function readingFrom(position: GeolocationPosition): PositionReading {
  return {
    accuracyMeters: position.coords.accuracy,
    capturedAt: capturedAtMs(position.timestamp),
    kind: "position",
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

/**
 * Takes one device location reading for a Clock in / Clock out or away-answer
 * press, and only when the office rule needs location. It listens only until
 * that press has its reading, then stops, and never rejects: every failure
 * becomes a reading the server records as "uncertain".
 *
 * The first answer a browser gives can be the device's remembered position
 * with its old timestamp, so readings stamped before the press are held back
 * while a fresh one arrives. If none does, the newest old reading is sent and
 * the server's freshness check marks it uncertain, as before.
 */
export function readLocation(
  watchdogMs = LOCATION_WATCHDOG_MS,
  staleWaitMs = STALE_FALLBACK_WAIT_MS
): Promise<LocationReading> {
  const geolocation = geolocationApi();
  if (!geolocation) {
    return Promise.resolve({ code: "not_supported", kind: "error" });
  }
  const pressedAt = Date.now();
  return new Promise((settle) => {
    let settled = false;
    let watchId: number | null = null;
    let staleReading: PositionReading | null = null;
    let staleTimer: ReturnType<typeof setTimeout> | undefined;
    // Whichever comes first wins: a fresh reading, the browser's error, or a deadline.
    const resolve = (reading: LocationReading) => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(watchdog);
      globalThis.clearTimeout(staleTimer);
      if (watchId !== null) {
        geolocation.clearWatch(watchId);
      }
      settle(reading);
    };
    const watchdog = globalThis.setTimeout(
      () => resolve(staleReading ?? { code: "timeout", kind: "error" }),
      watchdogMs
    );
    const onPosition = (position: GeolocationPosition) => {
      const reading = readingFrom(position);
      if (reading.capturedAt >= pressedAt - FRESH_READING_SLACK_MS) {
        resolve(reading);
        return;
      }
      staleReading = reading;
      staleTimer ??= globalThis.setTimeout(() => resolve(staleReading ?? reading), staleWaitMs);
    };
    const onError = (error: GeolocationPositionError) =>
      resolve(staleReading ?? { code: errorCodeFor(error.code), kind: "error" });
    try {
      const id = geolocation.watchPosition(onPosition, onError, LOCATION_REQUEST_OPTIONS);
      if (settled) {
        // The browser answered synchronously, before the id existed to clear.
        geolocation.clearWatch(id);
      } else {
        watchId = id;
      }
    } catch {
      resolve({ code: "not_supported", kind: "error" });
    }
  });
}
