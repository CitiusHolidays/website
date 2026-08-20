import { ConvexError } from "convex/values";
import { isRuntimeString } from "../../lib/runtimeValues";

export const INBOUND_HASH_PATTERN = /^[a-f0-9]{64}$/;
const SACRED_CONTEXT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CLIENT_NAME_LENGTH = 160;
const MAX_CONTACT_EMAIL_LENGTH = 254;
const MAX_CONTACT_MOBILE_LENGTH = 50;
const MAX_DESTINATION_LENGTH = 240;
const MAX_NOTES_LENGTH = 5000;
const MAX_PAX_COUNT = 1000;

export interface InboundIntentInput {
  clientName: string;
  consent: true;
  contactEmail?: string;
  contactMobile?: string;
  destination?: string;
  notes?: string;
  paxCount?: number;
  sacredBharatContext?: {
    entryPoint: "journey_planner" | "trail";
    templeId?: string;
    trailSlug?: string;
  };
  source: "Citius Concierge" | "Sacred Bharat" | "Website";
  submissionKeyHash: string;
  travelStartDate?: string;
}

function assertInboundText(value: string | undefined, maxLength: number, label: string) {
  if (value !== undefined && value.length > maxLength) {
    throw new ConvexError(`${label} is too long`);
  }
}

export function normalizeInboundOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function validateInboundIntentInput(args: InboundIntentInput) {
  const clientName = args.clientName.trim();
  if (!clientName) {
    throw new ConvexError("Client name is required");
  }
  assertInboundText(clientName, MAX_CLIENT_NAME_LENGTH, "Client name");
  assertInboundText(args.contactEmail, MAX_CONTACT_EMAIL_LENGTH, "Contact email");
  assertInboundText(args.contactMobile, MAX_CONTACT_MOBILE_LENGTH, "Contact mobile");
  assertInboundText(args.destination, MAX_DESTINATION_LENGTH, "Destination");
  assertInboundText(args.notes, MAX_NOTES_LENGTH, "Notes");
  if (
    args.paxCount !== undefined &&
    !(Number.isInteger(args.paxCount) && args.paxCount >= 1 && args.paxCount <= MAX_PAX_COUNT)
  ) {
    throw new ConvexError("Pax count must be a whole number between 1 and 1,000");
  }
  if (!INBOUND_HASH_PATTERN.test(args.submissionKeyHash)) {
    throw new ConvexError("Invalid inbound submission key");
  }
  const context = args.sacredBharatContext;
  if (args.source !== "Sacred Bharat" && context !== undefined) {
    throw new ConvexError("Sacred Bharat context does not match the inbound source");
  }
  if (args.source === "Sacred Bharat") {
    const validPlanner =
      context?.entryPoint === "journey_planner" &&
      context.trailSlug === undefined &&
      isRuntimeString(context.templeId) &&
      context.templeId.length <= 100 &&
      SACRED_CONTEXT_SLUG_PATTERN.test(context.templeId);
    const validTrail =
      context?.entryPoint === "trail" &&
      context.templeId === undefined &&
      isRuntimeString(context.trailSlug) &&
      context.trailSlug.length <= 100 &&
      SACRED_CONTEXT_SLUG_PATTERN.test(context.trailSlug);
    if (!(validPlanner || validTrail)) {
      throw new ConvexError("Select one valid Sacred Bharat planning context");
    }
  }
  return { clientName };
}

export function buildInboundListSearchText(args: InboundIntentInput) {
  return [
    args.clientName,
    args.contactEmail,
    args.contactMobile,
    args.destination,
    args.notes,
    args.sacredBharatContext?.templeId,
    args.sacredBharatContext?.trailSlug,
    args.source,
  ]
    .filter(Boolean)
    .join(" ");
}
