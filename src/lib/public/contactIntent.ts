import type { JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "@/lib/runtimeValues";
export type ContactIntent =
  | "event-photo-booth"
  | "mice-proposal"
  | "pilgrimage-callback"
  | "pilgrimage-enquiry";

/** Self-service deletion lives in Account settings (ADR 0019). */
export const ACCOUNT_DELETION_HREF = "/account?tab=settings#delete-account";
/** The retired contact intent. Old links keep working by forwarding to ACCOUNT_DELETION_HREF. */
const LEGACY_ACCOUNT_DELETION_INTENT = "account-deletion";
export const MICE_PROPOSAL_CONTACT_HREF = "/contact?intent=mice-proposal";

export const PILGRIMAGE_CONTACT_HREFS = {
  callback: "/contact?intent=pilgrimage-callback",
  enquiry: "/contact?intent=pilgrimage-enquiry",
} as const;

const CONTACT_INTENT_PREFILLS = {
  "event-photo-booth": {
    message: "I would like to plan a trip after trying the Citius Event Photo Booth.",
    subject: "Photo Booth travel enquiry",
  },
  "mice-proposal": {
    message:
      "Please contact me about a proposal for a meeting, incentive, conference, or exhibition programme.",
    subject: "MICE proposal request",
  },
  "pilgrimage-callback": {
    message: "Please contact me about a Citius pilgrimage programme.",
    subject: "Pilgrimage callback request",
  },
  "pilgrimage-enquiry": {
    message: "I would like to learn more about Citius pilgrimage programmes.",
    subject: "Pilgrimage programme enquiry",
  },
} satisfies Record<ContactIntent, { message: string; subject: string }>;

export function isLegacyAccountDeletionIntent(value: JsonValue) {
  return value === LEGACY_ACCOUNT_DELETION_INTENT;
}

export function resolveContactIntent(value: JsonValue): ContactIntent | null {
  return value === "event-photo-booth" ||
    value === "mice-proposal" ||
    value === "pilgrimage-callback" ||
    value === "pilgrimage-enquiry"
    ? value
    : null;
}

const DESTINATION_CONTROL_CHARACTERS = /[\p{C}]/u;

export function resolveContactDestination(value: JsonValue): string {
  if (!isRuntimeString(value)) {
    return "";
  }
  const destination = value.trim();
  return destination.length <= 80 && !DESTINATION_CONTROL_CHARACTERS.test(destination)
    ? destination
    : "";
}

export function getPhotoBoothContactHref(destination: string): string {
  const params = new URLSearchParams({
    destination: resolveContactDestination(destination),
    intent: "event-photo-booth",
  });
  return `/contact?${params}`;
}

export function getContactIntentPrefill(intent: ContactIntent | null, destination = "") {
  const place = resolveContactDestination(destination);
  if (intent === "event-photo-booth" && place) {
    return {
      destination: place,
      message: `I would like to plan a trip to ${place} after trying the Citius Event Photo Booth.`,
      subject: `Travel enquiry: ${place}`,
    };
  }
  return intent ? CONTACT_INTENT_PREFILLS[intent] : { message: "", subject: "" };
}
