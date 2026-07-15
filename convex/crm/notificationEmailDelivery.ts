import { Effect } from "effect";

// Effect: external-io, retry-or-throttle, typed-recoverable-errors,
// test-time-dependency-substitution (see src/lib/effectAdoption.ts).
export interface NotificationEmailMessage {
  from: string;
  html: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export interface NotificationEmailSendMessage extends NotificationEmailMessage {
  to: string[];
}

export interface NotificationEmailSendOptions {
  idempotencyKey: string;
}

export interface NotificationEmailProviderError {
  name?: string;
  statusCode?: number | null;
}

export interface NotificationEmailSendResult {
  error?: NotificationEmailProviderError | null;
}

export interface NotificationEmailDeliveryConfig {
  maxRetries: number;
  minIntervalMs: number;
}

export interface NotificationEmailDeliveryResult {
  sent: number;
  skipped: number;
}

export interface NotificationEmailDeliveryInput {
  config: NotificationEmailDeliveryConfig;
  eventId: string;
  idempotencyNamespace?: string;
  message: NotificationEmailMessage;
  recipients: string[];
  sendEmail: (
    message: NotificationEmailSendMessage,
    options: NotificationEmailSendOptions
  ) => Promise<NotificationEmailSendResult>;
  sleep: (ms: number) => Promise<void>;
}

class NotificationEmailDeliveryFailure {
  readonly _tag = "NotificationEmailDeliveryFailure";
  readonly error: NotificationEmailProviderError;
  readonly ambiguous: boolean;

  constructor(error: NotificationEmailProviderError, ambiguous: boolean) {
    this.error = error;
    this.ambiguous = ambiguous;
  }
}

class NotificationEmailProviderResponseFailure extends Error {
  readonly providerError: NotificationEmailProviderError;

  constructor(error: NotificationEmailProviderError) {
    super(error.name ?? "Notification email provider rejected the request");
    this.providerError = error;
  }
}

function isRateLimitError(error: NotificationEmailProviderError) {
  return error.statusCode === 429 || error.name === "rate_limit_exceeded";
}

function isRetryableProviderError(error: NotificationEmailProviderError) {
  return isRateLimitError(error) || (error.statusCode != null && error.statusCode >= 500);
}

function isAmbiguousNetworkError(error: NotificationEmailProviderError) {
  return ["AbortError", "FetchError", "NetworkError", "TimeoutError", "TypeError"].includes(
    error.name ?? ""
  );
}

export async function notificationEmailIdempotencyKey(
  eventId: string,
  recipient: string,
  namespace = "crm-notification"
) {
  const normalized = new TextEncoder().encode(recipient.trim().toLowerCase());
  const digest = await globalThis.crypto.subtle.digest("SHA-256", normalized);
  const recipientDigest = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  )
    .join("")
    .slice(0, 32);
  return `${namespace}/${eventId}/${recipientDigest}`;
}

function sendEmailAttempt(input: {
  message: NotificationEmailMessage;
  recipient: string;
  idempotencyKey: string;
  sendEmail: (
    message: NotificationEmailSendMessage,
    options: NotificationEmailSendOptions
  ) => Promise<NotificationEmailSendResult>;
}) {
  return Effect.tryPromise({
    catch: (error) => {
      if (error instanceof NotificationEmailProviderResponseFailure) {
        return new NotificationEmailDeliveryFailure(error.providerError, false);
      }
      return new NotificationEmailDeliveryFailure(
        typeof error === "object" && error !== null
          ? (error as NotificationEmailProviderError)
          : { name: String(error) },
        true
      );
    },
    try: async () => {
      const result = await input.sendEmail(
        {
          ...input.message,
          to: [input.recipient],
        },
        { idempotencyKey: input.idempotencyKey }
      );
      if (result.error) {
        throw new NotificationEmailProviderResponseFailure(result.error);
      }
      return true;
    },
  });
}

async function sendEmailWithRetry(input: {
  config: NotificationEmailDeliveryConfig;
  message: NotificationEmailMessage;
  recipient: string;
  idempotencyKey: string;
  sendEmail: (
    message: NotificationEmailSendMessage,
    options: NotificationEmailSendOptions
  ) => Promise<NotificationEmailSendResult>;
  sleep: (ms: number) => Promise<void>;
}) {
  for (let attempt = 0; attempt < input.config.maxRetries; attempt += 1) {
    const result = await Effect.runPromise(
      Effect.match(sendEmailAttempt(input), {
        onFailure: (failure) => ({
          ambiguous: failure.ambiguous,
          error: failure.error,
          ok: false as const,
        }),
        onSuccess: () => ({ ok: true as const }),
      })
    );
    if (result.ok) {
      return true;
    }

    const canRetry =
      (result.ambiguous ||
        isAmbiguousNetworkError(result.error) ||
        isRetryableProviderError(result.error)) &&
      attempt < input.config.maxRetries - 1;
    if (!canRetry) {
      return false;
    }
    await input.sleep(input.config.minIntervalMs * (attempt + 1));
  }
  return false;
}

export async function deliverNotificationEmailsSequentially(
  input: NotificationEmailDeliveryInput
): Promise<NotificationEmailDeliveryResult> {
  let sent = 0;

  for (const [index, recipient] of input.recipients.entries()) {
    const idempotencyKey = await notificationEmailIdempotencyKey(
      input.eventId,
      recipient,
      input.idempotencyNamespace
    );
    const delivered = await sendEmailWithRetry({
      config: input.config,
      idempotencyKey,
      message: input.message,
      recipient,
      sendEmail: input.sendEmail,
      sleep: input.sleep,
    });
    if (delivered) {
      sent += 1;
    }
    if (input.recipients.length > 1 && index < input.recipients.length - 1) {
      await input.sleep(input.config.minIntervalMs);
    }
  }

  return { sent, skipped: input.recipients.length - sent };
}
