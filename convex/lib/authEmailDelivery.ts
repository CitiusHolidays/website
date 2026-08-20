import { makeFunctionReference } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import {
  deliverNotificationEmailsSequentially,
  type NotificationEmailDeliveryStatusEvent,
  RESEND_DELIVERY_MAX_ATTEMPTS,
  RESEND_DELIVERY_MIN_INTERVAL_MS,
} from "../crm/notificationEmailDelivery";
import { AUTH_EMAIL_FROM } from "./emailConfig";
import { isRuntimeNumber, propertiesWhen } from "./runtimeValues";

export type AuthEmailPurpose = "password_reset" | "verification";
export type AuthEmailControlKey =
  | "email.auth.password_reset"
  | "email.auth.staff_setup"
  | "email.auth.verification";
type AuthEmailDeliveryStatus = "queued" | "sending" | "retrying" | "sent" | "skipped" | "exhausted";

export interface AuthEmailDeliveryOutcome {
  attempts: number;
  correlationDigest: string;
  expiresAt: number;
  failureCode?: string;
  providerStatus?: number;
  purpose: AuthEmailPurpose;
  sentAt?: number;
  status: AuthEmailDeliveryStatus;
  updatedAt: number;
}

interface AuthEmailProviderResult {
  error?: { name?: string; statusCode?: number | null } | null;
}

interface DeliverTransactionalAuthEmailInput {
  controlKey?: AuthEmailControlKey;
  correlationSecret: string;
  deliveryConfig?: {
    maxAttempts: number;
    minIntervalMs: number;
  };
  expiresAt: number;
  html: string;
  purpose: AuthEmailPurpose;
  recipient: string;
  sendEmail?: (input: {
    html: string;
    idempotencyKey: string;
    recipient: string;
    subject: string;
    text: string;
  }) => Promise<AuthEmailProviderResult>;
  subject: string;
  text: string;
}

interface AuthEmailStatusInput {
  correlationDigest: string;
  expiresAt: number;
  purpose: AuthEmailPurpose;
}

export interface AuthEmailDeliveryOrchestrationPorts {
  getOutcome: (correlationDigest: string) => Promise<AuthEmailDeliveryOutcome | null>;
  now: () => number;
  providerConfigured: boolean;
  recordStatus: (
    input: AuthEmailStatusInput,
    event: Pick<NotificationEmailDeliveryStatusEvent, "attempts" | "error" | "status">
  ) => Promise<AuthEmailDeliveryOutcome>;
  resolveControl: (controlKey: AuthEmailControlKey) => Promise<boolean>;
  sendEmail: NonNullable<DeliverTransactionalAuthEmailInput["sendEmail"]>;
}

const recordOutcomeRef = makeFunctionReference<
  "mutation",
  {
    attempts: number;
    correlationDigest: string;
    expiresAt: number;
    failureCode?: string;
    providerStatus?: number;
    purpose: AuthEmailPurpose;
    status: AuthEmailDeliveryStatus;
  },
  AuthEmailDeliveryOutcome
>("authEmailDeliveries:recordOutcome");

const getOutcomeRef = makeFunctionReference<
  "query",
  { correlationDigest: string },
  AuthEmailDeliveryOutcome | null
>("authEmailDeliveries:getOutcome");

const prepareIntentRef = makeFunctionReference<
  "mutation",
  {
    controlKey: "email.auth.staff_setup";
    correlationDigest: string;
    expiresAt: number;
    purpose: AuthEmailPurpose;
    recipientDigest: string;
  },
  { prepared: boolean }
>("authEmailDeliveryIntents:prepare");

const resolveIntentRef = makeFunctionReference<
  "query",
  {
    at: number;
    correlationDigest: string;
    purpose: AuthEmailPurpose;
    recipientDigest: string;
  },
  AuthEmailControlKey | null
>("authEmailDeliveryIntents:resolve");

const resolveOperationalControlsRef = makeFunctionReference<
  "query",
  { at: number; keys: [AuthEmailControlKey] },
  {
    controls: Array<{
      blockedBy: string[];
      enabled: boolean;
      key: AuthEmailControlKey;
      reason: string;
    }>;
  }
>("crm/settings:resolveOperationalControlsInternal");

const AUTH_DELIVERY_PARAM = "auth_delivery";
export const AUTH_EMAIL_TOKEN_TTL_SECONDS = 60 * 60;

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function authEmailCorrelationDigest(
  purpose: AuthEmailPurpose,
  correlationSecret: string
) {
  const value = new TextEncoder().encode(`${purpose}:${correlationSecret}`);
  return hex(await globalThis.crypto.subtle.digest("SHA-256", value));
}

async function authEmailRecipientDigest(recipient: string) {
  const value = new TextEncoder().encode(recipient.trim().toLowerCase());
  return hex(await globalThis.crypto.subtle.digest("SHA-256", value));
}

export async function createTrustedAuthEmailCorrelation(
  ctx: ActionCtx,
  purpose: AuthEmailPurpose,
  callbackUrl: string,
  recipient: string,
  controlKey: AuthEmailControlKey
) {
  const correlationSecret = globalThis.crypto.randomUUID();
  const url = new URL(callbackUrl);
  url.searchParams.set(AUTH_DELIVERY_PARAM, correlationSecret);
  const correlationDigest = await authEmailCorrelationDigest(purpose, correlationSecret);
  if (controlKey === "email.auth.staff_setup") {
    await ctx.runMutation(prepareIntentRef, {
      controlKey,
      correlationDigest,
      expiresAt: Date.now() + AUTH_EMAIL_TOKEN_TTL_SECONDS * 1000,
      purpose,
      recipientDigest: await authEmailRecipientDigest(recipient),
    });
  }
  return {
    callbackUrl: url.toString(),
    correlationDigest,
  };
}

export async function resolveAuthEmailControlKey(
  ctx: ActionCtx,
  url: string,
  token: string,
  purpose: AuthEmailPurpose,
  recipient: string
) {
  const standardKey: AuthEmailControlKey =
    purpose === "verification" ? "email.auth.verification" : "email.auth.password_reset";
  const correlationSecret = authEmailCorrelationSecretFromUrl(url, token);
  const trusted = await ctx.runQuery(resolveIntentRef, {
    at: Date.now(),
    correlationDigest: await authEmailCorrelationDigest(purpose, correlationSecret),
    purpose,
    recipientDigest: await authEmailRecipientDigest(recipient),
  });
  return trusted ?? standardKey;
}

export function authEmailCorrelationSecretFromUrl(url: string, token: string) {
  try {
    const deliveryUrl = new URL(url);
    const callback = deliveryUrl.searchParams.get("callbackURL");
    if (callback) {
      const callbackUrl = new URL(callback);
      const correlation = callbackUrl.searchParams.get(AUTH_DELIVERY_PARAM)?.trim();
      if (correlation) {
        return correlation;
      }
    }
  } catch {
    // A malformed provider URL still has a stable token-derived fallback.
  }
  return token;
}

export function normalizeAuthEmailFailure(error?: { name?: string; statusCode?: number | null }) {
  const name = String(error?.name ?? "");
  const status =
    isRuntimeNumber(error?.statusCode) && Number.isFinite(error.statusCode)
      ? Math.trunc(error.statusCode)
      : undefined;
  if (name === "token_expired") {
    return { failureCode: "token_expired", providerStatus: undefined };
  }
  if (name === "provider_not_configured") {
    return { failureCode: "provider_not_configured", providerStatus: undefined };
  }
  if (name === "operator_suppressed") {
    return { failureCode: "operator_suppressed", providerStatus: undefined };
  }
  if (status === 429 || name === "rate_limit_exceeded") {
    return { failureCode: "rate_limited", providerStatus: status };
  }
  if (status !== undefined && status >= 500) {
    return { failureCode: "provider_unavailable", providerStatus: status };
  }
  if (["AbortError", "FetchError", "NetworkError", "TimeoutError", "TypeError"].includes(name)) {
    return { failureCode: "network_error", providerStatus: status };
  }
  if (status !== undefined && status >= 400) {
    return { failureCode: "provider_rejected", providerStatus: status };
  }
  return { failureCode: "provider_error", providerStatus: status };
}

async function sendWithResend(input: {
  html: string;
  idempotencyKey: string;
  recipient: string;
  subject: string;
  text: string;
}): Promise<AuthEmailProviderResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { error: { name: "provider_not_configured" } };
  }
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: AUTH_EMAIL_FROM,
      html: input.html,
      subject: input.subject,
      text: input.text,
      to: [input.recipient],
    }),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    method: "POST",
  });
  return response.ok
    ? { error: null }
    : { error: { name: "provider_rejected", statusCode: response.status } };
}

async function recordStatus(
  ctx: ActionCtx,
  input: {
    correlationDigest: string;
    expiresAt: number;
    purpose: AuthEmailPurpose;
  },
  event: Pick<NotificationEmailDeliveryStatusEvent, "attempts" | "error" | "status">
) {
  const failure = event.error
    ? normalizeAuthEmailFailure(event.error)
    : { failureCode: undefined, providerStatus: undefined };
  return await ctx.runMutation(recordOutcomeRef, {
    attempts: event.attempts,
    correlationDigest: input.correlationDigest,
    expiresAt: input.expiresAt,
    ...propertiesWhen(failure.failureCode, () => ({ failureCode: failure.failureCode })),
    ...propertiesWhen(!(failure.providerStatus === undefined), () => ({
      providerStatus: failure.providerStatus,
    })),
    purpose: input.purpose,
    status: event.status,
  });
}

export async function getAuthEmailDeliveryOutcome(ctx: ActionCtx, correlationDigest: string) {
  return await ctx.runQuery(getOutcomeRef, { correlationDigest });
}

export async function executeAuthEmailDeliveryOrchestration(
  input: Omit<DeliverTransactionalAuthEmailInput, "sendEmail">,
  ports: AuthEmailDeliveryOrchestrationPorts
) {
  const correlationDigest = await authEmailCorrelationDigest(
    input.purpose,
    input.correlationSecret
  );
  const existing = await ports.getOutcome(correlationDigest);
  if (existing && ["exhausted", "sent", "skipped"].includes(existing.status)) {
    return existing;
  }
  const expiresAt = existing?.expiresAt ?? input.expiresAt;
  const base = { correlationDigest, expiresAt, purpose: input.purpose };
  if (!existing) {
    const controlKey =
      input.controlKey ??
      (input.purpose === "verification" ? "email.auth.verification" : "email.auth.password_reset");
    if (!(await ports.resolveControl(controlKey))) {
      return await ports.recordStatus(base, {
        attempts: 0,
        error: { name: "operator_suppressed" },
        status: "skipped",
      });
    }
  }
  if (!ports.providerConfigured) {
    return await ports.recordStatus(base, {
      attempts: 0,
      error: { name: "provider_not_configured" },
      status: "skipped",
    });
  }
  const defaultDeliveryConfig = {
    maxAttempts: RESEND_DELIVERY_MAX_ATTEMPTS,
    minIntervalMs: RESEND_DELIVERY_MIN_INTERVAL_MS,
  };
  const { deliveryConfig = defaultDeliveryConfig } = input;
  await deliverNotificationEmailsSequentially({
    config: deliveryConfig,
    eventId: `${input.purpose}/${correlationDigest}`,
    idempotencyNamespace: "auth-transactional",
    message: {
      from: AUTH_EMAIL_FROM,
      html: input.html,
      subject: input.subject,
      text: input.text,
    },
    onStatus: async (event) => {
      await ports.recordStatus(base, event);
    },
    recipients: [input.recipient],
    sendEmail: (_message, options) => {
      if (ports.now() >= expiresAt) {
        return Promise.resolve({ error: { name: "token_expired", statusCode: 410 } });
      }
      return ports.sendEmail({
        html: input.html,
        idempotencyKey: options.idempotencyKey,
        recipient: input.recipient,
        subject: input.subject,
        text: input.text,
      });
    },
  });
  const outcome = await ports.getOutcome(correlationDigest);
  if (!outcome) {
    throw new Error("AUTH_EMAIL_OUTCOME_MISSING");
  }
  return outcome;
}

export async function deliverTransactionalAuthEmail(
  ctx: ActionCtx,
  input: DeliverTransactionalAuthEmailInput
) {
  const sendEmail = input.sendEmail ?? sendWithResend;
  return await executeAuthEmailDeliveryOrchestration(input, {
    getOutcome: async (correlationDigest) =>
      await getAuthEmailDeliveryOutcome(ctx, correlationDigest),
    now: Date.now,
    providerConfigured: Boolean(process.env.RESEND_API_KEY?.trim() || input.sendEmail),
    recordStatus: async (statusInput, event) => await recordStatus(ctx, statusInput, event),
    resolveControl: async (controlKey) => {
      const resolved = await ctx.runQuery(resolveOperationalControlsRef, {
        at: Date.now(),
        keys: [controlKey],
      });
      return resolved.controls[0]?.enabled === true;
    },
    sendEmail,
  });
}
