import {
  type CheckInRequirement,
  DEFAULT_OFFICE_TIME_ZONE,
  type EnforcementMode,
  type GeofenceRule,
  type NetworkEntryKind,
  parseCidr,
  requiresLocation,
  requiresNetwork,
  validateBranchRule,
} from "@convex/crm/officeCheckInVerification";
import { reasonProblem } from "./presentation";

/**
 * The office settings form as plain text, and the checks that turn it into a
 * `saveRule` payload. Kept out of the component so the parsing is testable on
 * its own and the form stays a thin view.
 */

const DEFAULT_RADIUS_METERS = 150;
const DEFAULT_ACCURACY_METERS = 75;

export interface NetworkDraft {
  cidr: string;
  key: string;
  kind: NetworkEntryKind;
  label: string;
}

export interface RuleDraft {
  accuracy: string;
  location: string;
  mode: EnforcementMode;
  networks: NetworkDraft[];
  radius: string;
  reason: string;
  requirement: CheckInRequirement | "";
  timeZone: string;
}

interface SavedRule {
  enforcementMode: EnforcementMode;
  geofence?: GeofenceRule | null;
  networks: { cidr: string; kind: NetworkEntryKind; label: string }[];
  requirement: CheckInRequirement;
  timeZone: string;
}

export type CoordinatesResult =
  | { kind: "empty" }
  | { kind: "invalid"; message: string }
  | { kind: "ok"; latitude: number; longitude: number }
  | { kind: "swapped"; latitude: number; longitude: number };

const NUMBER = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
// "19.2183687, 72.9705434", "19.2183687 72.9705434", "(19.21, 72.97)"
const PAIR_PATTERN = new RegExp(String.raw`^\(?\s*${NUMBER}\s*(?:,\s*|\s+)${NUMBER}\s*\)?$`);
// A pasted Google Maps link: ".../@19.2183687,72.9705434,17z" or "?q=19.21,72.97"
const MAP_LINK_PATTERN = new RegExp(String.raw`(?:@|[?&]q=|[?&]ll=)${NUMBER},\s*${NUMBER}`);

const isLatitude = (value: number) => value >= -90 && value <= 90;
const isLongitude = (value: number) => value >= -180 && value <= 180;

/**
 * Reads the coordinates people copy from Google Maps (right-click on the pin,
 * then click the numbers). Latitude comes first. When the first number can
 * only be a longitude, the pair is reported as swapped with the corrected order.
 */
export function parseCoordinates(text: string): CoordinatesResult {
  const trimmed = text.trim().replaceAll("°", "");
  if (!trimmed) {
    return { kind: "empty" };
  }
  const match = PAIR_PATTERN.exec(trimmed) ?? MAP_LINK_PATTERN.exec(trimmed);
  if (!match) {
    return {
      kind: "invalid",
      message:
        "Paste two numbers separated by a comma, as Google Maps shows them, for example 19.2183687, 72.9705434.",
    };
  }
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (isLatitude(first) && isLongitude(second)) {
    return { kind: "ok", latitude: first, longitude: second };
  }
  if (isLatitude(second) && isLongitude(first)) {
    return { kind: "swapped", latitude: second, longitude: first };
  }
  return {
    kind: "invalid",
    message: "These numbers aren't a place on the map. Copy them again from Google Maps.",
  };
}

export function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude}, ${longitude}`;
}

export function mapLinkFor(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function numberText(value: number | undefined, fallback: number) {
  return String(value ?? fallback);
}

export function draftFromRule(rule: SavedRule | null, officeName: string): RuleDraft {
  const geofence = rule?.geofence ?? null;
  return {
    accuracy: numberText(geofence?.maxAccuracyMeters, DEFAULT_ACCURACY_METERS),
    location: geofence ? formatCoordinates(geofence.latitude, geofence.longitude) : "",
    mode: rule?.enforcementMode ?? "report_only",
    networks: (rule?.networks ?? []).map((entry, index) => ({ ...entry, key: `saved-${index}` })),
    radius: numberText(geofence?.radiusMeters, DEFAULT_RADIUS_METERS),
    reason: rule ? `Updated ${officeName} settings` : `Set up ${officeName}`,
    requirement: rule?.requirement ?? "",
    timeZone: rule?.timeZone ?? DEFAULT_OFFICE_TIME_ZONE,
  };
}

function wholeNumber(text: string) {
  const trimmed = text.trim();
  const value = Number(trimmed);
  return trimmed && Number.isFinite(value) ? value : null;
}

function geofenceFromDraft(draft: RuleDraft, problems: string[]): GeofenceRule | null {
  const coordinates = parseCoordinates(draft.location);
  if (coordinates.kind === "empty") {
    problems.push("Paste the office's location from Google Maps.");
  } else if (coordinates.kind === "invalid") {
    problems.push(coordinates.message);
  } else if (coordinates.kind === "swapped") {
    problems.push(
      `The location numbers look the wrong way round. Latitude comes first: ${formatCoordinates(coordinates.latitude, coordinates.longitude)}.`
    );
  }
  const radiusMeters = wholeNumber(draft.radius);
  const maxAccuracyMeters = wholeNumber(draft.accuracy);
  if (radiusMeters === null) {
    problems.push("Enter the radius in metres, for example 150.");
  }
  if (maxAccuracyMeters === null) {
    problems.push("Enter the accuracy limit in metres under Advanced settings, for example 75.");
  }
  if (coordinates.kind !== "ok" || radiusMeters === null || maxAccuracyMeters === null) {
    return null;
  }
  const { latitude, longitude } = coordinates;
  return { latitude, longitude, maxAccuracyMeters, radiusMeters };
}

function networksFromDraft(draft: RuleDraft, problems: string[]) {
  const networks = draft.networks.flatMap((entry) => {
    const cidr = entry.cidr.trim();
    const label = entry.label.trim();
    return cidr || label ? [{ cidr, kind: entry.kind, label }] : [];
  });
  for (const entry of networks) {
    if (!parseCidr(entry.cidr)) {
      problems.push(
        `"${entry.cidr || entry.label}" isn't an internet address. Ask IT for the office's public address, for example 203.0.113.10.`
      );
    } else if (!entry.label) {
      problems.push(`Give ${entry.cidr} a name, for example "Main line".`);
    }
  }
  return networks;
}

export interface RuleSubmission {
  enforcementMode: EnforcementMode;
  geofence: GeofenceRule | null;
  networks: { cidr: string; kind: NetworkEntryKind; label: string }[];
  reason: string;
  requirement: CheckInRequirement;
  timeZone: string;
}

export interface RuleDraftCheck {
  problems: string[];
  submission: RuleSubmission | null;
}

/**
 * Checks the form the way the server will, in plain words. A part the chosen
 * check doesn't use is hidden in the form, so the saved values for it are sent
 * back unchanged rather than silently cleared.
 */
export function checkRuleDraft(draft: RuleDraft, saved: SavedRule | null): RuleDraftCheck {
  const problems: string[] = [];
  const { requirement } = draft;
  if (!requirement) {
    problems.push("Choose what this office should check.");
  }
  const usesLocation = requirement !== "" && requiresLocation(requirement);
  const usesNetwork = requirement !== "" && requiresNetwork(requirement);
  const geofence = usesLocation ? geofenceFromDraft(draft, problems) : (saved?.geofence ?? null);
  const networks = usesNetwork ? networksFromDraft(draft, problems) : (saved?.networks ?? []);
  const reasonError = reasonProblem(draft.reason);
  if (reasonError) {
    problems.push(reasonError);
  }
  if (!requirement || problems.length > 0) {
    return { problems, submission: null };
  }
  problems.push(
    ...validateBranchRule({ enforcementMode: draft.mode, geofence, networks, requirement })
  );
  if (problems.length > 0) {
    return { problems, submission: null };
  }
  return {
    problems,
    submission: {
      enforcementMode: draft.mode,
      geofence,
      networks,
      reason: draft.reason.trim(),
      requirement,
      timeZone: draft.timeZone.trim() || DEFAULT_OFFICE_TIME_ZONE,
    },
  };
}
