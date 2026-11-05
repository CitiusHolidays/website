import type { LocationReading } from "@convex/crm/officeCheckInVerification";
import { isRuntimeNumber } from "@convex/lib/runtimeValues";
import { isJsonObject } from "@/lib/jsonValue";

export const OFFICE_CHECK_IN_PATH = "/api/portal/office-check-in";
export const OFFICE_CHECK_IN_BODY_LIMIT_BYTES = 2048;

export type OfficeCheckInAction = "clock_in" | "clock_out";

/**
 * Browser request body. It carries the device location reading only. The
 * client IP is never part of the body: the route reads it from the edge.
 */
export interface OfficeCheckInRequest {
  action: OfficeCheckInAction;
  location: LocationReading;
}

export const OFFICE_CHECK_IN_ERROR_CODES = [
  "ALREADY_CLOCKED_OUT",
  "FORBIDDEN",
  "INVALID_REQUEST",
  "NO_OFFICE_ASSIGNED",
  "NO_STAFF_PROFILE",
  "NOT_CLOCKED_IN",
  "OFFICE_INACTIVE",
  "UNAUTHENTICATED",
  "UNAVAILABLE",
] as const;
export type OfficeCheckInErrorCode = (typeof OFFICE_CHECK_IN_ERROR_CODES)[number];

export type OfficeCheckInResponse =
  | { ok: true; replayed: boolean }
  | { code: OfficeCheckInErrorCode; error: string; ok: false };

const GEOLOCATION_ERRORS = [
  "permission_denied",
  "position_unavailable",
  "timeout",
  "not_supported",
] as const;

function finiteNumber<Value>(value: Value): number | null {
  return isRuntimeNumber(value) && Number.isFinite(value) ? value : null;
}

function parseLocation<Value>(value: Value): LocationReading | null {
  if (!isJsonObject(value)) {
    return null;
  }
  if (value.kind === "not_requested") {
    return { kind: "not_requested" };
  }
  if (value.kind === "error") {
    const code = GEOLOCATION_ERRORS.find((known) => known === value.code);
    return code ? { code, kind: "error" } : null;
  }
  if (value.kind !== "position") {
    return null;
  }
  const latitude = finiteNumber(value.latitude);
  const longitude = finiteNumber(value.longitude);
  const accuracyMeters = finiteNumber(value.accuracyMeters);
  const capturedAt = finiteNumber(value.capturedAt);
  if (latitude === null || longitude === null || accuracyMeters === null || capturedAt === null) {
    return null;
  }
  return { accuracyMeters, capturedAt, kind: "position", latitude, longitude };
}

/**
 * Parses a JSON body at the route boundary. Only the action and a rebuilt
 * location reading survive; unknown keys (including any `ip`) are dropped.
 */
export function parseOfficeCheckInRequest<Value>(value: Value): OfficeCheckInRequest | null {
  if (!isJsonObject(value)) {
    return null;
  }
  const action = value.action === "clock_in" || value.action === "clock_out" ? value.action : null;
  const location = parseLocation(value.location);
  return action && location ? { action, location } : null;
}
