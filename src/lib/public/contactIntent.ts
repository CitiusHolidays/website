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

const CONTACT_INTENT_PREFILLS: Record<ContactIntent, { message: string; subject: string }> = {
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
};

export function resolveContactIntent(value: unknown): ContactIntent | null {
  return value === "account-deletion" ||
    value === "mice-proposal" ||
    value === "pilgrimage-callback" ||
    value === "pilgrimage-enquiry"
    ? value
    : null;
}

export function getContactIntentPrefill(intent: ContactIntent | null) {
  return intent ? CONTACT_INTENT_PREFILLS[intent] : { message: "", subject: "" };
}
