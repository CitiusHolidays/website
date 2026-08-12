export type ContactIntent = "pilgrimage-callback" | "pilgrimage-enquiry";

export const PILGRIMAGE_CONTACT_HREFS = {
  callback: "/contact?intent=pilgrimage-callback",
  enquiry: "/contact?intent=pilgrimage-enquiry",
} as const;

const CONTACT_INTENT_PREFILLS: Record<ContactIntent, { message: string; subject: string }> = {
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
  return value === "pilgrimage-callback" || value === "pilgrimage-enquiry" ? value : null;
}

export function getContactIntentPrefill(intent: ContactIntent | null) {
  return intent ? CONTACT_INTENT_PREFILLS[intent] : { message: "", subject: "" };
}
