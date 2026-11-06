import type {
  CheckInRequirement,
  EnforcementMode,
  GeofenceReason,
  GeolocationErrorCode,
  NetworkEntryKind,
  NetworkReason,
  SignalOutcome,
} from "@convex/crm/officeCheckInVerification";
import { displayDateFromIsoDay } from "@/lib/formatDate";
import type { OfficeCheckInErrorCode } from "./contracts";

/**
 * Plain-language copy and time helpers for the Office check-in view.
 *
 * Every signal is evidence, never proof: the copy says what was observed
 * ("your device reported a location inside the office area") and never
 * claims that a network or a location proves someone was in the office.
 */

export type RuleRequirement = CheckInRequirement | "not_configured";

/**
 * The four answers to "What should we check?", in the order the setup form
 * lists them, each with a one-line explanation for the person choosing.
 */
export const REQUIREMENT_CHOICES = [
  {
    help: "Their phone or laptop must report a location within the radius of the office pin.",
    label: "Location",
    value: "geofence",
  },
  {
    help: "They must be connected through one of the office's internet addresses.",
    label: "Office internet",
    value: "network",
  },
  {
    help: "Passes when either the location or the office internet passes.",
    label: "Either one",
    value: "network_or_geofence",
  },
  {
    help: "Passes only when the location and the office internet both pass.",
    label: "Both",
    value: "network_and_geofence",
  },
] as const satisfies readonly { help: string; label: string; value: CheckInRequirement }[];

/** One line for an office card: what the office checks, in plain words. */
export function describeOfficeCheck(requirement: RuleRequirement) {
  switch (requirement) {
    case "network":
      return "Checks office internet";
    case "geofence":
      return "Checks location";
    case "network_and_geofence":
      return "Checks location and office internet";
    case "network_or_geofence":
      return "Checks location or office internet";
    default:
      return "Nothing to check yet";
  }
}

export function describeRule(requirement: RuleRequirement) {
  switch (requirement) {
    case "network":
      return "This office checks that you're on the office internet.";
    case "geofence":
      return "This office checks your location.";
    case "network_and_geofence":
      return "This office checks your location and that you're on the office internet.";
    case "network_or_geofence":
      return "This office checks your location or the office internet. Either one is enough.";
    default:
      return "This office has no check-in rule yet. Your times are recorded and marked uncertain.";
  }
}

export function describeEnforcement(mode: EnforcementMode) {
  return mode === "enforce"
    ? "If a check doesn't pass, a manager reviews it before it counts."
    : "Results are recorded for review. Nothing is blocked during the pilot.";
}

export const ENFORCEMENT_LABELS = {
  enforce: "Enforce",
  report_only: "Report only",
} satisfies Record<EnforcementMode, string>;

export const NETWORK_KIND_LABELS = {
  office: "Office only",
  office_shared_with_vpn: "Office, shared with VPN",
  vpn_or_proxy_exit: "VPN or proxy",
} satisfies Record<NetworkEntryKind, string>;

export const OUTCOME_LABELS = {
  fail: "Fail",
  pass: "Pass",
  uncertain: "Uncertain",
} satisfies Record<SignalOutcome, string>;

export const OUTCOME_TONES = {
  fail: "red",
  pass: "green",
  uncertain: "amber",
} satisfies Record<SignalOutcome, "green" | "red" | "amber">;

export function describeNetworkReason(reason: NetworkReason, matchedLabel?: string | null) {
  switch (reason) {
    case "matched_office":
      return matchedLabel
        ? `Connected through the office internet (${matchedLabel}).`
        : "Connected through the office internet.";
    case "shared_with_vpn":
      return "Connected through an address the office shares with VPN users, so it can't confirm the office.";
    case "vpn_or_proxy_exit":
      return "Connected through a VPN or proxy, so the internet address can't confirm the office.";
    case "outside_allowlist":
      return "Not connected through the office internet.";
    case "ip_unavailable":
      return "The internet address couldn't be read for this check.";
    default:
      return "No office internet addresses are set up for this office yet.";
  }
}

export const NETWORK_REASON_SHORT = {
  ip_unavailable: "Not readable",
  matched_office: "Office internet",
  no_networks_configured: "No addresses set up",
  outside_allowlist: "Not on the office list",
  shared_with_vpn: "Shared with VPN",
  vpn_or_proxy_exit: "VPN or proxy exit",
} satisfies Record<NetworkReason, string>;

const GEOLOCATION_ERROR_COPY = {
  not_supported: "This browser can't share location.",
  permission_denied: "Location access is turned off for this site in your browser.",
  position_unavailable: "Your device couldn't find its location.",
  timeout: "Your device took too long to find its location.",
} satisfies Record<GeolocationErrorCode, string>;

export function describeGeofenceReason(reason: GeofenceReason, accuracyMeters?: number | null) {
  switch (reason) {
    case "inside":
      return "The device reported a location inside the office area.";
    case "outside":
      return "The device reported a location outside the office area.";
    case "boundary_uncertain":
      return "The location was too close to the edge of the office area to tell.";
    case "accuracy_too_low":
      return accuracyMeters
        ? `The location wasn't precise enough (about ${Math.round(accuracyMeters)} m).`
        : "The location wasn't precise enough.";
    case "stale_reading":
      return "The device sent an old location reading.";
    case "invalid_reading":
      return "The device sent a location that couldn't be used.";
    case "not_provided":
      return "No location was sent with this check.";
    case "no_geofence_configured":
      return "No office location is set up for this office yet.";
    default:
      return GEOLOCATION_ERROR_COPY[reason];
  }
}

/**
 * What the person sees right after the browser declines to give a location.
 * The check-in is still sent; the server records the location as uncertain.
 */
export function describeLocationProblem(code: GeolocationErrorCode) {
  const recovery = {
    not_supported: "Your times were still recorded without a location.",
    permission_denied:
      "Your times were still recorded without a location. To include it next time, allow location for this site in your browser settings.",
    position_unavailable:
      "Your times were still recorded without a location. Check that location services are on for this device.",
    timeout: "Your times were still recorded without a location. Moving near a window can help.",
  } satisfies Record<GeolocationErrorCode, string>;
  return `${GEOLOCATION_ERROR_COPY[code]} ${recovery[code]}`;
}

const CHECK_IN_ERROR_COPY = {
  ALREADY_CLOCKED_OUT: "You've already clocked out today. A manager can correct your times.",
  FORBIDDEN: "This account can't clock in. Contact an admin if that's wrong.",
  INVALID_REQUEST: "The check-in couldn't be sent. Reload the page and try again.",
  NO_OFFICE_ASSIGNED: "You aren't assigned to an office yet. Ask an admin to assign you.",
  NO_STAFF_PROFILE: "Your staff profile isn't active. Contact an admin.",
  NOT_CLOCKED_IN: "You aren't clocked in, so there's nothing to clock out.",
  OFFICE_INACTIVE: "Your office is marked inactive. Ask an admin to check your office.",
  SESSION_LIMIT_REACHED:
    "You've reached the most sessions one day can hold. A manager can correct your times.",
  UNAUTHENTICATED: "Your session has ended. Sign in again, then retry.",
  UNAVAILABLE: "Check-in is unavailable right now. Try again in a minute.",
} satisfies Record<OfficeCheckInErrorCode, string>;

export function describeCheckInError(code: OfficeCheckInErrorCode | null) {
  return code ? CHECK_IN_ERROR_COPY[code] : CHECK_IN_ERROR_COPY.UNAVAILABLE;
}

// ---------------------------------------------------------------------------
// Day status

export type DayStatus =
  | "awaiting_review"
  | "checked_in"
  | "checked_out"
  | "not_checked_in"
  | "rejected";

export interface DayStatusRecord {
  admission: "admitted" | "pending_review" | "rejected";
  status: "closed" | "open";
}

export function dayStatusFor(record: DayStatusRecord | null): DayStatus {
  if (!record) {
    return "not_checked_in";
  }
  if (record.admission === "pending_review") {
    return "awaiting_review";
  }
  if (record.admission === "rejected") {
    return "rejected";
  }
  return record.status === "open" ? "checked_in" : "checked_out";
}

export const DAY_STATUS_LABELS = {
  awaiting_review: "Awaiting review",
  checked_in: "Checked in",
  checked_out: "Checked out",
  not_checked_in: "Not checked in",
  rejected: "Rejected",
} satisfies Record<DayStatus, string>;

export const DAY_STATUS_TONES = {
  awaiting_review: "amber",
  checked_in: "blue",
  checked_out: "gray",
  not_checked_in: "gray",
  rejected: "red",
} satisfies Record<DayStatus, "amber" | "blue" | "gray" | "red">;

export type StatusTone = "amber" | "blue" | "gray" | "green" | "red";

export interface TeamStatus {
  label: string;
  tone: StatusTone;
}

export interface TeamStatusRecord extends DayStatusRecord {
  clockIn: { outcome: SignalOutcome };
  source: "manager_entry" | "self";
}

/**
 * One status per person for the team list, always in words: where they are
 * ("In", "Out", "Not in") and, for their own check-in, how the check went.
 * Review states replace the presence word because they need the manager.
 */
export function teamStatusFor(record: TeamStatusRecord | null): TeamStatus {
  if (!record) {
    return { label: "Not in", tone: "gray" };
  }
  if (record.admission === "pending_review") {
    return { label: "Awaiting review", tone: "amber" };
  }
  if (record.admission === "rejected") {
    return { label: "Rejected", tone: "red" };
  }
  const presence = record.status === "open" ? "In" : "Out";
  if (record.source === "manager_entry") {
    return { label: `${presence} · Manual entry`, tone: "gray" };
  }
  const { outcome } = record.clockIn;
  if (outcome === "pass") {
    return { label: `${presence} · Pass`, tone: record.status === "open" ? "green" : "gray" };
  }
  return { label: `${presence} · ${OUTCOME_LABELS[outcome]}`, tone: OUTCOME_TONES[outcome] };
}

// ---------------------------------------------------------------------------
// Dates and times (always in the office time zone)

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const partFormatters = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(timeZone: string) {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      timeZone,
    });
    timeFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function partFormatter(timeZone: string) {
  let formatter = partFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    });
    partFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** "09:12" in the office time zone, or an em dash when there is no time. */
export function formatOfficeTime(timestamp: number | null | undefined, timeZone: string) {
  if (timestamp === null || timestamp === undefined) {
    return "—";
  }
  return timeFormatter(timeZone).format(new Date(timestamp));
}

/** "DD/MM/YYYY" for a stored `YYYY-MM-DD` work date. */
export function formatWorkDate(workDate: string) {
  return displayDateFromIsoDay(workDate) || workDate;
}

/** "DD/MM/YYYY, HH:MM" in the office time zone. */
export function formatOfficeDateTime(timestamp: number, timeZone: string) {
  const parts = officeParts(timestamp, timeZone);
  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}`;
}

function officeParts(timestamp: number, timeZone: string) {
  const values: Record<string, string> = {};
  for (const part of partFormatter(timeZone).formatToParts(new Date(timestamp))) {
    values[part.type] = part.value;
  }
  return {
    day: values.day ?? "00",
    hour: values.hour === "24" ? "00" : (values.hour ?? "00"),
    minute: values.minute ?? "00",
    month: values.month ?? "00",
    second: values.second ?? "00",
    year: values.year ?? "0000",
  };
}

function zoneOffsetMs(timestamp: number, timeZone: string) {
  const parts = officeParts(timestamp, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - Math.floor(timestamp / 1000) * 1000;
}

const WORK_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Converts a work date and an "HH:MM" wall-clock time in the office time zone
 * into a timestamp. Returns null for malformed input.
 */
export function officeTimeToTimestamp(workDate: string, clockTime: string, timeZone: string) {
  const date = WORK_DATE_PATTERN.exec(workDate);
  const time = CLOCK_TIME_PATTERN.exec(clockTime.trim());
  if (!(date && time)) {
    return null;
  }
  const wallClockAsUtc = Date.UTC(
    Number(date[1]),
    Number(date[2]) - 1,
    Number(date[3]),
    Number(time[1]),
    Number(time[2])
  );
  let candidate = wallClockAsUtc - zoneOffsetMs(wallClockAsUtc, timeZone);
  const corrected = wallClockAsUtc - zoneOffsetMs(candidate, timeZone);
  if (corrected !== candidate) {
    candidate = corrected;
  }
  return candidate;
}

/** "HH:MM" wall-clock time in the office time zone for a time input. */
export function timestampToClockTime(timestamp: number | null | undefined, timeZone: string) {
  if (timestamp === null || timestamp === undefined) {
    return "";
  }
  const parts = officeParts(timestamp, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

/** Validates a manager's reason the same way the server does (3 to 500 characters). */
export function reasonProblem(reason: string) {
  const { length } = reason.trim();
  if (length < 3) {
    return "Enter a reason of at least 3 characters. It's saved in the audit log.";
  }
  if (length > 500) {
    return "Keep the reason under 500 characters.";
  }
  return null;
}
