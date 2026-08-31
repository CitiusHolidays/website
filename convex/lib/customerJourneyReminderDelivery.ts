import {
  isRuntimeObject,
  isRuntimeString,
  type RuntimeObject,
  type RuntimeValue,
} from "./runtimeValues";

export const JOURNEY_REMINDER_MILESTONES = [
  "arrival_pack_ready",
  "confirmed_travel_summary_ready",
] as const;

export type JourneyReminderMilestone = (typeof JOURNEY_REMINDER_MILESTONES)[number];
export type JourneyReminderChannel = "rcs" | "whatsapp";

export const JOURNEY_REMINDER_DELIVERY_STATUSES = [
  "queued",
  "accepted",
  "scheduled",
  "routed",
  "sent",
  "delivered",
  "read",
  "failed",
  "filtered",
  "blocked",
  "rejected",
  "ambiguous",
  "suppressed",
] as const;

export type JourneyReminderDeliveryStatus = (typeof JOURNEY_REMINDER_DELIVERY_STATUSES)[number];

export type SentJourneyReminderResult =
  | { kind: "accepted"; providerMessageId: string }
  | { kind: "ambiguous" }
  | { kind: "rejected"; providerStatus: number };

export interface SentMessageWebhookEvent extends Record<string, string | number> {
  channel: JourneyReminderChannel;
  eventAt: number;
  eventKey: string;
  eventType: string;
  messageId: string;
  status: Extract<
    JourneyReminderDeliveryStatus,
    | "blocked"
    | "delivered"
    | "failed"
    | "filtered"
    | "queued"
    | "read"
    | "routed"
    | "scheduled"
    | "sent"
  >;
}

const SENT_MESSAGES_ENDPOINT = "https://api.sent.dm/v3/messages";
const DEFINITIVE_REJECTION_STATUSES = new Set([400, 401, 403, 404]);
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const PROVIDER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;
const SENT_REQUEST_TIMEOUT_MS = 10_000;
const TIMESTAMP_PATTERN = /^\d{10}$/;

const STATUS_RANK = {
  accepted: 2,
  ambiguous: 9,
  blocked: 9,
  delivered: 6,
  failed: 9,
  filtered: 9,
  queued: 0,
  read: 7,
  rejected: 9,
  routed: 3,
  scheduled: 2,
  sent: 5,
  suppressed: 9,
} as const satisfies Record<JourneyReminderDeliveryStatus, number>;

const HARD_TERMINAL_STATUSES = new Set<JourneyReminderDeliveryStatus>([
  "ambiguous",
  "blocked",
  "failed",
  "filtered",
  "read",
  "rejected",
  "suppressed",
]);

const WEBHOOK_STATUS_BY_EVENT = {
  "message.blocked": "blocked",
  "message.delivered": "delivered",
  "message.failed": "failed",
  "message.filtered": "filtered",
  "message.queued": "queued",
  "message.read": "read",
  "message.routed": "routed",
  "message.scheduled": "scheduled",
  "message.sent": "sent",
} as const;

const PROVIDER_STATUS_BY_EVENT = {
  "message.blocked": "BLOCKED",
  "message.delivered": "DELIVERED",
  "message.failed": "FAILED",
  "message.filtered": "FILTERED",
  "message.queued": "QUEUED",
  "message.read": "READ",
  "message.routed": "ROUTED",
  "message.scheduled": "SCHEDULED",
  "message.sent": "SENT",
} as const;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeBase64(value: string) {
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function runtimeObject(value: RuntimeValue) {
  if (
    !isRuntimeObject(value) ||
    Array.isArray(value) ||
    value instanceof Date ||
    value instanceof Error
  ) {
    return null;
  }
  // SAFETY: RuntimeValue's remaining object branch is RuntimeObject after arrays, Date, and Error are excluded.
  return value as RuntimeObject;
}

function isSupportedWebhookEvent(value: string): value is keyof typeof WEBHOOK_STATUS_BY_EVENT {
  return value in WEBHOOK_STATUS_BY_EVENT;
}

export function isJourneyReminderMilestone(value: string): value is JourneyReminderMilestone {
  return JOURNEY_REMINDER_MILESTONES.some((milestone) => milestone === value);
}

export function orderedJourneyReminderMilestones(values: readonly string[]) {
  const selected = new Set(values);
  return JOURNEY_REMINDER_MILESTONES.filter((milestone) => selected.has(milestone));
}

export function isVerifiedPhoneE164(value: RuntimeValue): value is string {
  return isRuntimeString(value) && E164_PATTERN.test(value);
}

export function isSentProviderMessageId(value: RuntimeValue): value is string {
  return isRuntimeString(value) && PROVIDER_UUID_PATTERN.test(value);
}

export function maskVerifiedPhone(value: string) {
  return isVerifiedPhoneE164(value) ? `••••${value.slice(-4)}` : null;
}

export async function journeyReminderLogicalKey(input: {
  entitlementId: string;
  milestone: JourneyReminderMilestone;
  sourceEventId: string;
}) {
  const digest = await sha256Hex(
    `${input.entitlementId}|${input.milestone}|${input.sourceEventId}`
  );
  return `jr_${digest}`;
}

export async function journeyReminderProviderKey(
  logicalKey: string,
  channel: JourneyReminderChannel
) {
  const digest = await sha256Hex(`${logicalKey}|${channel}`);
  return `jr_${digest}_${channel === "whatsapp" ? "wa" : "rcs"}`;
}

/**
 * Monotonic provider-state merge. Terminal outcomes never reopen, and a delivered
 * message may advance only to read. Older or lower-ranked events are ignored.
 */
export function shouldApplyJourneyReminderStatus(input: {
  currentEventAt?: number;
  currentStatus: JourneyReminderDeliveryStatus;
  incomingEventAt: number;
  incomingStatus: SentMessageWebhookEvent["status"];
}) {
  if (
    !Number.isFinite(input.incomingEventAt) ||
    (input.currentEventAt !== undefined && input.incomingEventAt < input.currentEventAt)
  ) {
    return false;
  }
  if (input.currentStatus === input.incomingStatus) {
    return false;
  }
  if (HARD_TERMINAL_STATUSES.has(input.currentStatus)) {
    return false;
  }
  if (input.currentStatus === "delivered") {
    return input.incomingStatus === "read";
  }
  return STATUS_RANK[input.incomingStatus] >= STATUS_RANK[input.currentStatus];
}

function acceptedMessageId(
  value: RuntimeValue,
  channel: JourneyReminderChannel,
  phoneE164: string,
  templateId: string
) {
  const response = runtimeObject(value);
  if (!(response?.success === true && response.error === null)) {
    return null;
  }
  const data = runtimeObject(response.data);
  if (!(data?.status === "QUEUED" && data.template_id === templateId)) {
    return null;
  }
  const recipients = data?.recipients;
  if (!Array.isArray(recipients)) {
    return null;
  }
  if (recipients.length !== 1) {
    return null;
  }
  const [recipient] = recipients;
  const recipientRecord = runtimeObject(recipient);
  if (!recipientRecord) {
    return null;
  }
  return recipientRecord.channel === channel &&
    recipientRecord.to === phoneE164 &&
    isSentProviderMessageId(recipientRecord.message_id)
    ? recipientRecord.message_id
    : null;
}

/** A single direct Sent HTTP binding. Each call is pinned to exactly one channel. */
export async function sendSentJourneyReminder(input: {
  apiKey: string;
  channel: JourneyReminderChannel;
  fetchImpl?: typeof fetch;
  idempotencyKey: string;
  phoneE164: string;
  templateId: string;
  timeoutMs?: number;
}): Promise<SentJourneyReminderResult> {
  if (
    !(
      input.apiKey.trim() &&
      PROVIDER_UUID_PATTERN.test(input.templateId) &&
      isVerifiedPhoneE164(input.phoneE164) &&
      IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)
    )
  ) {
    return { kind: "rejected", providerStatus: 400 };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? SENT_REQUEST_TIMEOUT_MS);
  try {
    const response = await (input.fetchImpl ?? fetch)(SENT_MESSAGES_ENDPOINT, {
      body: JSON.stringify({
        channel: [input.channel],
        template: { id: input.templateId },
        to: [input.phoneE164],
      }),
      headers: {
        "content-type": "application/json",
        "idempotency-key": input.idempotencyKey,
        "x-api-key": input.apiKey,
      },
      method: "POST",
      signal: controller.signal,
    });
    if (response.status !== 202) {
      return DEFINITIVE_REJECTION_STATUSES.has(response.status)
        ? { kind: "rejected", providerStatus: response.status }
        : { kind: "ambiguous" };
    }
    let parsed: RuntimeValue;
    try {
      parsed = await response.json();
    } catch {
      return { kind: "ambiguous" };
    }
    const providerMessageId = acceptedMessageId(
      parsed,
      input.channel,
      input.phoneE164,
      input.templateId
    );
    return providerMessageId ? { kind: "accepted", providerMessageId } : { kind: "ambiguous" };
  } catch {
    // A transport or timeout error cannot prove whether Sent accepted the request.
    return { kind: "ambiguous" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifySentWebhookSignature(input: {
  nowMs?: number;
  rawBody: string;
  secret: string;
  signature: string;
  timestamp: string;
  webhookId: string;
}) {
  if (
    !(
      input.secret.startsWith("whsec_") &&
      input.signature.startsWith("v1,") &&
      TIMESTAMP_PATTERN.test(input.timestamp) &&
      input.webhookId.trim()
    )
  ) {
    return false;
  }
  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_MAX_AGE_SECONDS
  ) {
    return false;
  }
  const keyBytes = decodeBase64(input.secret.slice("whsec_".length));
  const signatureBytes = decodeBase64(input.signature.slice("v1,".length));
  if (!(keyBytes?.length && signatureBytes?.length)) {
    return false;
  }
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["verify"]
    );
    const signed = new TextEncoder().encode(
      `${input.webhookId}.${input.timestamp}.${input.rawBody}`
    );
    return await crypto.subtle.verify("HMAC", key, signatureBytes, signed);
  } catch {
    return false;
  }
}

export async function parseSentMessageWebhook(
  rawBody: string,
  headerEventType: string | null
): Promise<SentMessageWebhookEvent | null> {
  let value: RuntimeValue;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const envelope = runtimeObject(value);
  if (!envelope) {
    return null;
  }
  const { event, field } = envelope;
  const payloadRecord = runtimeObject(envelope.payload);
  if (
    field !== "message" ||
    !isRuntimeString(event) ||
    event !== headerEventType ||
    !isSupportedWebhookEvent(event) ||
    !payloadRecord ||
    !isSentProviderMessageId(payloadRecord.message_id) ||
    !isRuntimeString(payloadRecord.message_status) ||
    !(payloadRecord.channel === "whatsapp" || payloadRecord.channel === "rcs") ||
    !isRuntimeString(payloadRecord.updated_at)
  ) {
    return null;
  }
  if (payloadRecord.message_status !== PROVIDER_STATUS_BY_EVENT[event]) {
    return null;
  }
  const eventAt = Date.parse(payloadRecord.updated_at);
  if (!Number.isFinite(eventAt)) {
    return null;
  }
  return {
    channel: payloadRecord.channel,
    eventAt,
    eventKey: await sha256Hex(`${payloadRecord.message_id}|${payloadRecord.message_status}`),
    eventType: event,
    messageId: payloadRecord.message_id,
    status: WEBHOOK_STATUS_BY_EVENT[event],
  };
}
