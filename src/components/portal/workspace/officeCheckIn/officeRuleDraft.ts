import {
  type CheckInRequirement,
  type EnforcementMode,
  type GeofenceRule,
  type NetworkEntryKind,
  validateBranchRule,
} from "@convex/crm/officeCheckInVerification";
import type { OfficeRule } from "./officeCheckInTypes";

export interface NetworkDraft {
  cidr: string;
  key: string;
  kind: NetworkEntryKind;
  label: string;
}

export interface RuleDraft {
  accuracy: string;
  latitude: string;
  longitude: string;
  mode: EnforcementMode;
  networks: NetworkDraft[];
  radius: string;
  reason: string;
  requirement: CheckInRequirement | "";
  timeZone: string;
}

function numberText(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

export function draftFromRule(rule: OfficeRule | null): RuleDraft {
  return {
    accuracy: numberText(rule?.geofence?.maxAccuracyMeters),
    latitude: numberText(rule?.geofence?.latitude),
    longitude: numberText(rule?.geofence?.longitude),
    mode: rule?.enforcementMode ?? "report_only",
    networks: (rule?.networks ?? []).map((entry, index) => ({ ...entry, key: `saved-${index}` })),
    radius: numberText(rule?.geofence?.radiusMeters),
    reason: "",
    requirement: rule?.requirement ?? "",
    timeZone: rule?.timeZone ?? "",
  };
}

function parseNumber(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Turns the four geofence fields into a rule, or explains what is missing. */
function parseGeofence(
  draft: Pick<RuleDraft, "accuracy" | "latitude" | "longitude" | "radius">
): { geofence: GeofenceRule | null; problem: null } | { geofence: null; problem: string } {
  const fields = [draft.latitude, draft.longitude, draft.radius, draft.accuracy];
  if (fields.every((field) => !field.trim())) {
    return { geofence: null, problem: null };
  }
  const [latitude, longitude, radiusMeters, maxAccuracyMeters] = fields.map(parseNumber);
  if (
    latitude === null ||
    longitude === null ||
    radiusMeters === null ||
    maxAccuracyMeters === null
  ) {
    return {
      geofence: null,
      problem:
        "Fill in latitude, longitude, radius and accuracy limit as numbers, or leave all four empty.",
    };
  }
  return { geofence: { latitude, longitude, maxAccuracyMeters, radiusMeters }, problem: null };
}

export interface RuleSubmission {
  enablingEnforce: boolean;
  geofence: GeofenceRule | null;
  networks: { cidr: string; kind: NetworkEntryKind; label: string }[];
  requirement: CheckInRequirement;
}

export interface RuleDraftCheck {
  problems: string[];
  submission: RuleSubmission | null;
}

/** Drops rows with neither a range nor a label, and trims what is kept. */
function filledNetworks(drafts: NetworkDraft[]): RuleSubmission["networks"] {
  return drafts.flatMap((entry) => {
    const cidr = entry.cidr.trim();
    const label = entry.label.trim();
    return cidr || label ? [{ cidr, kind: entry.kind, label }] : [];
  });
}

/** Client-side check that mirrors the server's validation before anything is sent. */
export function checkRuleDraft(
  draft: RuleDraft,
  savedMode: EnforcementMode | null
): RuleDraftCheck {
  const problems: string[] = [];
  if (!draft.requirement) {
    problems.push("Choose what this office checks.");
  }
  const networks = filledNetworks(draft.networks);
  const geofence = parseGeofence(draft);
  if (geofence.problem) {
    problems.push(geofence.problem);
  }
  if (!draft.requirement || geofence.problem) {
    return { problems, submission: null };
  }
  problems.push(
    ...validateBranchRule({
      enforcementMode: draft.mode,
      geofence: geofence.geofence,
      networks,
      requirement: draft.requirement,
    })
  );
  if (problems.length > 0) {
    return { problems, submission: null };
  }
  return {
    problems,
    submission: {
      enablingEnforce: draft.mode === "enforce" && savedMode !== "enforce",
      geofence: geofence.geofence,
      networks,
      requirement: draft.requirement,
    },
  };
}
