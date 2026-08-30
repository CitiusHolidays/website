import { isJsonObject, type JsonObject, type JsonValue } from "../jsonValue";
import { isRuntimeNumber, isRuntimeString } from "../runtimeValues";

export const INBOUND_BRIEF_SERVICE_TYPES = [
  "leisure_travel",
  "meetings_events",
  "pilgrimage",
  "other",
] as const;

export const INBOUND_BRIEF_DATE_FLEXIBILITY = ["fixed", "flexible", "not_sure"] as const;

export const INBOUND_BRIEF_CONTACT_WINDOWS = [
  "morning",
  "afternoon",
  "evening",
  "anytime",
] as const;

const INBOUND_RECEIPT_REFERENCE_PATTERN = /^ENQ-[0-9A-Z]{1,16}-[A-F0-9]{8}$/;

export type InboundBriefServiceType = (typeof INBOUND_BRIEF_SERVICE_TYPES)[number];
export type InboundBriefDateFlexibility = (typeof INBOUND_BRIEF_DATE_FLEXIBILITY)[number];
export type InboundBriefContactWindow = (typeof INBOUND_BRIEF_CONTACT_WINDOWS)[number];

export interface InboundEnquiryBrief {
  contactWindow?: InboundBriefContactWindow;
  dateFlexibility?: InboundBriefDateFlexibility;
  destination?: string;
  paxCount?: number;
  serviceType?: InboundBriefServiceType;
  travelStartDate?: string;
}

export type WebsiteContactIntent =
  | "account-deletion"
  | "mice-proposal"
  | "pilgrimage-callback"
  | "pilgrimage-enquiry";

export interface WebsiteSourceContext {
  intent: WebsiteContactIntent;
  label: string;
  trailSlug?: string;
}

interface BriefError {
  error: string;
  field?: keyof InboundEnquiryBrief;
  ok: false;
}

interface BriefSuccess {
  ok: true;
  value?: InboundEnquiryBrief;
}

interface OptionalStringResult {
  error?: BriefError;
  value?: string;
}

const BRIEF_FIELDS = new Set<string>([
  "contactWindow",
  "dateFlexibility",
  "destination",
  "paxCount",
  "serviceType",
  "travelStartDate",
]);
const BRIEF_SERVICE_TYPES = new Set<string>(INBOUND_BRIEF_SERVICE_TYPES);
const BRIEF_DATE_FLEXIBILITY_VALUES = new Set<string>(INBOUND_BRIEF_DATE_FLEXIBILITY);
const BRIEF_CONTACT_WINDOWS = new Set<string>(INBOUND_BRIEF_CONTACT_WINDOWS);
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DESTINATION_MAX_LENGTH = 240;
const MAX_PAX_COUNT = 1000;

function isDateOnly(value: string) {
  const match = value.match(DATE_ONLY_PATTERN);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function hasUnsupportedBriefField(input: JsonObject) {
  return Object.keys(input).some((field) => !BRIEF_FIELDS.has(field));
}

function optionalString(
  value: JsonValue,
  field: keyof InboundEnquiryBrief,
  label: string
): OptionalStringResult {
  if (value === undefined || value === null || value === "") {
    return {};
  }
  if (!isRuntimeString(value)) {
    return { error: { error: `${label} must be text.`, field, ok: false } };
  }
  const normalized = value.trim();
  return normalized ? { value: normalized } : {};
}

function isInboundBriefServiceType(value: JsonValue): value is InboundBriefServiceType {
  return isRuntimeString(value) && BRIEF_SERVICE_TYPES.has(value);
}

function isInboundBriefDateFlexibility(value: JsonValue): value is InboundBriefDateFlexibility {
  return isRuntimeString(value) && BRIEF_DATE_FLEXIBILITY_VALUES.has(value);
}

function isInboundBriefContactWindow(value: JsonValue): value is InboundBriefContactWindow {
  return isRuntimeString(value) && BRIEF_CONTACT_WINDOWS.has(value);
}

function normalizeBriefText(input: JsonObject) {
  const destination = optionalString(input.destination, "destination", "Destination");
  if (destination.error) {
    return destination.error;
  }
  if ((destination.value?.length ?? 0) > DESTINATION_MAX_LENGTH) {
    return { error: "Destination is too long.", field: "destination" as const, ok: false as const };
  }
  const travelStartDate = optionalString(
    input.travelStartDate,
    "travelStartDate",
    "Preferred travel date"
  );
  if (travelStartDate.error) {
    return travelStartDate.error;
  }
  if (travelStartDate.value && !isDateOnly(travelStartDate.value)) {
    return {
      error: "Preferred travel date must be a valid date in YYYY-MM-DD format.",
      field: "travelStartDate" as const,
      ok: false as const,
    };
  }
  return {
    destination: destination.value,
    ok: true as const,
    travelStartDate: travelStartDate.value,
  };
}

function normalizeServiceType(
  value: JsonValue
): BriefError | { ok: true; value?: InboundBriefServiceType } {
  if (value === undefined || value === null || value === "") {
    return { ok: true };
  }
  if (!isInboundBriefServiceType(value)) {
    return { error: "Select a valid enquiry type.", field: "serviceType", ok: false };
  }
  return { ok: true, value };
}

function normalizeDateFlexibility(value: JsonValue):
  | BriefError
  | {
      ok: true;
      value?: InboundBriefDateFlexibility;
    } {
  if (value === undefined || value === null || value === "") {
    return { ok: true };
  }
  if (!isInboundBriefDateFlexibility(value)) {
    return {
      error: "Select a valid date flexibility.",
      field: "dateFlexibility",
      ok: false,
    };
  }
  return { ok: true, value };
}

function normalizeContactWindow(value: JsonValue):
  | BriefError
  | {
      ok: true;
      value?: InboundBriefContactWindow;
    } {
  if (value === undefined || value === null || value === "") {
    return { ok: true };
  }
  if (!isInboundBriefContactWindow(value)) {
    return { error: "Select a valid contact window.", field: "contactWindow", ok: false };
  }
  return { ok: true, value };
}

function normalizePaxCount(value: JsonValue, allowPaxString: boolean) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: undefined };
  }
  const normalized = allowPaxString && isRuntimeString(value) ? Number(value) : value;
  if (
    !(
      isRuntimeNumber(normalized) &&
      Number.isInteger(normalized) &&
      normalized >= 1 &&
      normalized <= MAX_PAX_COUNT
    )
  ) {
    return {
      error: "Group size must be a whole number between 1 and 1,000.",
      field: "paxCount" as const,
      ok: false as const,
    };
  }
  return { ok: true as const, value: normalized };
}

export function normalizeInboundEnquiryBrief(
  input: JsonValue | InboundEnquiryBrief,
  options: { allowPaxString?: boolean } = {}
): BriefError | BriefSuccess {
  if (input === undefined || input === null) {
    return { ok: true };
  }
  if (!isJsonObject(input)) {
    return { error: "Enquiry brief must be an object.", ok: false };
  }
  if (hasUnsupportedBriefField(input)) {
    return { error: "Enquiry brief contains unsupported fields.", ok: false };
  }

  const textValues = normalizeBriefText(input);
  if (!textValues.ok) {
    return textValues;
  }

  const {
    contactWindow: rawContactWindow,
    dateFlexibility: rawDateFlexibility,
    serviceType: rawServiceType,
  } = input;
  const serviceType = normalizeServiceType(rawServiceType);
  if (!serviceType.ok) {
    return serviceType;
  }
  const dateFlexibility = normalizeDateFlexibility(rawDateFlexibility);
  if (!dateFlexibility.ok) {
    return dateFlexibility;
  }
  const contactWindow = normalizeContactWindow(rawContactWindow);
  if (!contactWindow.ok) {
    return contactWindow;
  }
  const paxCount = normalizePaxCount(input.paxCount, options.allowPaxString === true);
  if (!paxCount.ok) {
    return paxCount;
  }

  const value: InboundEnquiryBrief = {};
  if (contactWindow.value) {
    value.contactWindow = contactWindow.value;
  }
  if (dateFlexibility.value) {
    value.dateFlexibility = dateFlexibility.value;
  }
  if (textValues.destination) {
    value.destination = textValues.destination;
  }
  if (paxCount.value !== undefined) {
    value.paxCount = paxCount.value;
  }
  if (serviceType.value) {
    value.serviceType = serviceType.value;
  }
  if (textValues.travelStartDate) {
    value.travelStartDate = textValues.travelStartDate;
  }
  return Object.keys(value).length > 0 ? { ok: true, value } : { ok: true };
}

export function buildInboundReceiptReference(submissionKeyHash: string, createdAt: number) {
  const timePart = Math.max(0, Math.floor(createdAt)).toString(36).toUpperCase();
  return `ENQ-${timePart}-${submissionKeyHash.slice(0, 8).toUpperCase()}`;
}

export function isInboundReceiptReference(value: JsonValue): value is string {
  return isRuntimeString(value) && INBOUND_RECEIPT_REFERENCE_PATTERN.test(value);
}

export function inboundBriefServiceLabel(value: InboundBriefServiceType | undefined) {
  switch (value) {
    case "leisure_travel":
      return "Leisure travel";
    case "meetings_events":
      return "Meetings and events";
    case "pilgrimage":
      return "Pilgrimage";
    case "other":
      return "Other enquiry";
    default:
      return "";
  }
}

export function inboundBriefDateFlexibilityLabel(value: InboundBriefDateFlexibility | undefined) {
  switch (value) {
    case "fixed":
      return "Date is fixed";
    case "flexible":
      return "Dates are flexible";
    case "not_sure":
      return "Not sure yet";
    default:
      return "";
  }
}

export function inboundBriefContactWindowLabel(value: InboundBriefContactWindow | undefined) {
  switch (value) {
    case "morning":
      return "Morning";
    case "afternoon":
      return "Afternoon";
    case "evening":
      return "Evening";
    case "anytime":
      return "Any time";
    default:
      return "";
  }
}
