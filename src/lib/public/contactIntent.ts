import type { JsonValue } from "@/lib/jsonValue";
export type ContactIntent =
  | "account-deletion"
  | "mice-proposal"
  | "pilgrimage-callback"
  | "pilgrimage-enquiry";

export const ACCOUNT_DELETION_CONTACT_HREF = "/contact?intent=account-deletion";
export const MICE_PROPOSAL_CONTACT_HREF = "/contact?intent=mice-proposal";

export const PILGRIMAGE_CONTACT_HREFS = {
  callback: "/contact?intent=pilgrimage-callback",
  enquiry: "/contact?intent=pilgrimage-enquiry",
} as const;

export interface PilgrimageTrailContactContext {
  slug: string;
  status: "comingSoon" | "published";
  title: string;
}

const CONTACT_INTENT_PREFILLS = {
  "account-deletion": {
    message:
      "Please contact me about deleting my Citius account. I understand the team will first confirm any active journeys.",
    subject: "Account deletion request",
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

export function resolveContactIntent(value: JsonValue): ContactIntent | null {
  return value === "account-deletion" ||
    value === "mice-proposal" ||
    value === "pilgrimage-callback" ||
    value === "pilgrimage-enquiry"
    ? value
    : null;
}

export function getContactIntentPrefill(
  intent: ContactIntent | null,
  trail: PilgrimageTrailContactContext | null = null
) {
  if (!(trail && (intent === "pilgrimage-callback" || intent === "pilgrimage-enquiry"))) {
    return intent ? CONTACT_INTENT_PREFILLS[intent] : { message: "", subject: "" };
  }

  if (trail.status === "comingSoon") {
    return {
      message: `I would like to register interest in ${trail.title}. Please contact me about reviewed programme updates.`,
      subject: `${trail.title} interest`,
    };
  }

  return intent === "pilgrimage-callback"
    ? {
        message: `Please contact me about ${trail.title}. I would like to discuss the published programme details.`,
        subject: `${trail.title} callback request`,
      }
    : {
        message: `I would like to learn more about ${trail.title}. Please contact me about the published programme details.`,
        subject: `${trail.title} enquiry`,
      };
}
