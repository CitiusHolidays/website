import { ConvexError } from "convex/values";
import {
  buildInboundReceiptReference,
  type InboundEnquiryBrief,
  normalizeInboundEnquiryBrief,
  type WebsiteSourceContext,
} from "../../../src/lib/contact/inboundIntentContract";
import { isRuntimeString } from "../../lib/runtimeValues";

export const INBOUND_HASH_PATTERN = /^[a-f0-9]{64}$/;
const SACRED_CONTEXT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CLIENT_NAME_LENGTH = 160;
const MAX_CONTACT_EMAIL_LENGTH = 254;
const MAX_CONTACT_MOBILE_LENGTH = 50;
const MAX_NOTES_LENGTH = 5000;
const MAX_WEBSITE_SOURCE_LABEL_LENGTH = 240;

export interface InboundIntentInput {
  brief?: InboundEnquiryBrief;
  clientName: string;
  consent: true;
  contactEmail?: string;
  contactMobile?: string;
  notes?: string;
  sacredBharatContext?: {
    entryPoint: "journey_planner" | "trail";
    templeId?: string;
    trailSlug?: string;
  };
  source: "Citius Concierge" | "Sacred Bharat" | "Website";
  submissionKeyHash: string;
  websiteSourceContext?: WebsiteSourceContext;
}

export interface PreparedInboundIntentRecord {
  brief?: InboundEnquiryBrief;
  clientName: string;
  consentAt: number;
  contactEmail?: string;
  contactEmailNormalized?: string;
  contactMobile?: string;
  createdAt: number;
  listSearchText: string;
  notes?: string;
  receiptReference: string;
  sacredBharatContext?: InboundIntentInput["sacredBharatContext"];
  source: InboundIntentInput["source"];
  status: "pending";
  submissionKeyHash: string;
  websiteSourceContext?: WebsiteSourceContext;
}

export interface InboundNotificationPlan<IntentId> {
  additionalEmailRecipients: string[];
  body: string;
  intentId: IntentId;
  recipientRoles: string[];
  title: string;
}

export interface InboundIntentOrchestrationPorts<IntentId, NotificationResult> {
  persistIntent: (record: PreparedInboundIntentRecord) => Promise<IntentId>;
  publishNotification: (plan: InboundNotificationPlan<IntentId>) => Promise<NotificationResult>;
  recordCreatedIntent: (intentId: IntentId) => Promise<void>;
}

const INBOUND_RECIPIENT_ROLES = ["Sales", "Sales Head"];
const WEBSITE_CONTACT_EMAIL = "info@citius.in";

function assertInboundText(value: string | undefined, maxLength: number, label: string) {
  if (value !== undefined && value.length > maxLength) {
    throw new ConvexError(`${label} is too long`);
  }
}

export function normalizeInboundOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function validateWebsiteSourceContext(args: InboundIntentInput) {
  const websiteContext = args.websiteSourceContext;
  if (args.source !== "Website" && websiteContext !== undefined) {
    throw new ConvexError("Website context does not match the inbound source");
  }
  if (!websiteContext) {
    return;
  }
  const validIntent =
    websiteContext.intent === "account-deletion" ||
    websiteContext.intent === "mice-proposal" ||
    websiteContext.intent === "pilgrimage-callback" ||
    websiteContext.intent === "pilgrimage-enquiry";
  const validLabel =
    websiteContext.label.trim().length > 0 &&
    websiteContext.label.length <= MAX_WEBSITE_SOURCE_LABEL_LENGTH;
  const isPilgrimage =
    websiteContext.intent === "pilgrimage-callback" ||
    websiteContext.intent === "pilgrimage-enquiry";
  const validTrail =
    websiteContext.trailSlug === undefined ||
    (isPilgrimage &&
      websiteContext.trailSlug.length <= 100 &&
      SACRED_CONTEXT_SLUG_PATTERN.test(websiteContext.trailSlug));
  if (!(validIntent && validLabel && validTrail)) {
    throw new ConvexError("Invalid website enquiry source");
  }
}

export function validateInboundIntentInput(args: InboundIntentInput) {
  const clientName = args.clientName.trim();
  if (!clientName) {
    throw new ConvexError("Client name is required");
  }
  assertInboundText(clientName, MAX_CLIENT_NAME_LENGTH, "Client name");
  assertInboundText(args.contactEmail, MAX_CONTACT_EMAIL_LENGTH, "Contact email");
  assertInboundText(args.contactMobile, MAX_CONTACT_MOBILE_LENGTH, "Contact mobile");
  assertInboundText(args.notes, MAX_NOTES_LENGTH, "Notes");
  const briefResult = normalizeInboundEnquiryBrief(args.brief);
  if (!briefResult.ok) {
    throw new ConvexError(briefResult.error);
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
  validateWebsiteSourceContext(args);
  return { brief: briefResult.value, clientName };
}

export function buildInboundListSearchText(
  args: InboundIntentInput,
  receiptReference: string,
  brief: InboundEnquiryBrief | undefined
) {
  return [
    args.clientName,
    args.contactEmail,
    args.contactMobile,
    brief?.destination,
    brief?.serviceType,
    brief?.travelStartDate,
    args.notes,
    receiptReference,
    args.sacredBharatContext?.templeId,
    args.sacredBharatContext?.trailSlug,
    args.source,
    args.websiteSourceContext?.intent,
    args.websiteSourceContext?.label,
    args.websiteSourceContext?.trailSlug,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function executeInboundIntentOrchestration<IntentId, NotificationResult>(
  args: InboundIntentInput,
  now: number,
  ports: InboundIntentOrchestrationPorts<IntentId, NotificationResult>
) {
  const { brief, clientName } = validateInboundIntentInput(args);
  const contactEmail = normalizeInboundOptional(args.contactEmail);
  const receiptReference = buildInboundReceiptReference(args.submissionKeyHash, now);
  const intentId = await ports.persistIntent({
    brief,
    clientName,
    consentAt: now,
    contactEmail,
    contactEmailNormalized: contactEmail?.toLowerCase(),
    contactMobile: normalizeInboundOptional(args.contactMobile),
    createdAt: now,
    listSearchText: buildInboundListSearchText({ ...args, clientName }, receiptReference, brief),
    notes: normalizeInboundOptional(args.notes),
    receiptReference,
    sacredBharatContext: args.sacredBharatContext,
    source: args.source,
    status: "pending",
    submissionKeyHash: args.submissionKeyHash,
    websiteSourceContext: args.websiteSourceContext,
  });
  await ports.recordCreatedIntent(intentId);
  const notification = await ports.publishNotification({
    additionalEmailRecipients: args.source === "Website" ? [WEBSITE_CONTACT_EMAIL] : [],
    body: `New inbound lead from ${args.source}: ${clientName}`,
    intentId,
    recipientRoles: [...INBOUND_RECIPIENT_ROLES],
    title: args.source === "Website" ? "New website enquiry" : "Qualified inbound query",
  });
  return { intentId, notification, receiptReference };
}
