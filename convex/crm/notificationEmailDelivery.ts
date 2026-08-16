import { Duration, Effect, Ref, Schedule, Schema } from "effect";
import { isRuntimeNumber, isRuntimeObject, propertiesWhen } from "../lib/runtimeValues";

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
  maxAttempts: number;
  minIntervalMs: number;
}

export interface NotificationEmailDeliveryResult {
  sent: number;
  skipped: number;
}

export const RESEND_DELIVERY_MAX_ATTEMPTS = 4;
export const RESEND_DELIVERY_MIN_INTERVAL_MS = 550;

export type NotificationEmailDeliveryStatus =
  | "queued"
  | "sending"
  | "retrying"
  | "sent"
  | "skipped"
  | "exhausted";

export interface NotificationEmailDeliveryStatusEvent {
  attempts: number;
  error?: NotificationEmailProviderError;
  idempotencyKey: string;
  recipient: string;
  status: NotificationEmailDeliveryStatus;
}

export interface NotificationEmailDeliveryInput {
  config: NotificationEmailDeliveryConfig;
  eventId: string;
  idempotencyNamespace?: string;
  message: NotificationEmailMessage;
  onStatus?: (event: NotificationEmailDeliveryStatusEvent) => Promise<void> | void;
  recipients: string[];
  sendEmail: (
    message: NotificationEmailSendMessage,
    options: NotificationEmailSendOptions
  ) => Promise<NotificationEmailSendResult>;
}

export class NotificationEmailDeliveryFailure extends Schema.TaggedError<NotificationEmailDeliveryFailure>(
  "NotificationEmailDeliveryFailure"
)("NotificationEmailDeliveryFailure", {
  ambiguous: Schema.Boolean,
  providerName: Schema.optional(Schema.String),
  providerStatus: Schema.optional(Schema.Number),
  retryable: Schema.Boolean,
}) {}

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
  return isRateLimitError(error) || (isRuntimeNumber(error.statusCode) && error.statusCode >= 500);
}

function isAmbiguousNetworkError(error: NotificationEmailProviderError) {
  return ["AbortError", "FetchError", "NetworkError", "TimeoutError", "TypeError"].includes(
    error.name ?? ""
  );
}

interface ProviderFailureDetails {
  providerName?: string;
  providerStatus?: number;
}

function deliveryFailure(error: NotificationEmailProviderError) {
  const ambiguous = isAmbiguousNetworkError(error);
  const providerDetails: ProviderFailureDetails = {};
  if (error.name) {
    providerDetails.providerName = error.name;
  }
  if (isRuntimeNumber(error.statusCode)) {
    providerDetails.providerStatus = error.statusCode;
  }
  return new NotificationEmailDeliveryFailure({
    ambiguous,
    ...providerDetails,
    retryable: ambiguous || isRetryableProviderError(error),
  });
}

function providerErrorFromFailure(
  failure: NotificationEmailDeliveryFailure
): NotificationEmailProviderError {
  return {
    ...propertiesWhen(failure.providerName, () => ({ name: failure.providerName })),
    ...propertiesWhen(!(failure.providerStatus === undefined), () => ({
      statusCode: failure.providerStatus,
    })),
  };
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
        return deliveryFailure(error.providerError);
      }
      return deliveryFailure(
        isRuntimeObject(error) && error !== null ? error : { name: String(error) }
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

function statusEffect(
  onStatus: NotificationEmailDeliveryInput["onStatus"],
  event: NotificationEmailDeliveryStatusEvent
) {
  return onStatus ? Effect.promise(() => Promise.resolve(onStatus(event))) : Effect.void;
}

function sendEmailWithRetry(input: {
  config: NotificationEmailDeliveryConfig;
  message: NotificationEmailMessage;
  recipient: string;
  idempotencyKey: string;
  sendEmail: (
    message: NotificationEmailSendMessage,
    options: NotificationEmailSendOptions
  ) => Promise<NotificationEmailSendResult>;
  onStatus?: NotificationEmailDeliveryInput["onStatus"];
}) {
  const maxAttempts = Number.isFinite(input.config.maxAttempts)
    ? Math.max(1, Math.trunc(input.config.maxAttempts))
    : 1;
  const minIntervalMs = Number.isFinite(input.config.minIntervalMs)
    ? Math.max(0, Math.trunc(input.config.minIntervalMs))
    : 0;
  return Effect.gen(function* () {
    const attempts = yield* Ref.make(0);
    const attempt = Ref.updateAndGet(attempts, (current) => current + 1).pipe(
      Effect.flatMap((attemptNumber) =>
        statusEffect(input.onStatus, {
          attempts: attemptNumber,
          idempotencyKey: input.idempotencyKey,
          recipient: input.recipient,
          status: "sending",
        }).pipe(Effect.andThen(sendEmailAttempt(input)))
      ),
      Effect.tapError((failure) =>
        Ref.get(attempts).pipe(
          Effect.flatMap((attemptNumber) =>
            failure.retryable && attemptNumber < maxAttempts
              ? statusEffect(input.onStatus, {
                  attempts: attemptNumber,
                  error: providerErrorFromFailure(failure),
                  idempotencyKey: input.idempotencyKey,
                  recipient: input.recipient,
                  status: "retrying",
                })
              : Effect.void
          )
        )
      )
    );
    return yield* Effect.retry(attempt, {
      schedule: Schedule.spaced(Duration.millis(minIntervalMs)),
      times: maxAttempts - 1,
      while: (failure) => failure.retryable,
    }).pipe(
      Effect.matchEffect({
        onFailure: (failure) =>
          Ref.get(attempts).pipe(
            Effect.flatMap((attemptNumber) =>
              statusEffect(input.onStatus, {
                attempts: attemptNumber,
                error: providerErrorFromFailure(failure),
                idempotencyKey: input.idempotencyKey,
                recipient: input.recipient,
                status: "exhausted",
              })
            ),
            Effect.as(false)
          ),
        onSuccess: () =>
          Ref.get(attempts).pipe(
            Effect.flatMap((attemptNumber) =>
              statusEffect(input.onStatus, {
                attempts: attemptNumber,
                idempotencyKey: input.idempotencyKey,
                recipient: input.recipient,
                status: "sent",
              })
            ),
            Effect.as(true)
          ),
      })
    );
  });
}

export function notificationEmailDeliveryProgram(
  input: NotificationEmailDeliveryInput
): Effect.Effect<NotificationEmailDeliveryResult> {
  return Effect.forEach(
    input.recipients,
    (recipient, index) =>
      Effect.promise(() =>
        notificationEmailIdempotencyKey(input.eventId, recipient, input.idempotencyNamespace)
      ).pipe(
        Effect.tap((idempotencyKey) =>
          statusEffect(input.onStatus, {
            attempts: 0,
            idempotencyKey,
            recipient,
            status: "queued",
          })
        ),
        Effect.flatMap((idempotencyKey) =>
          sendEmailWithRetry({
            config: input.config,
            idempotencyKey,
            message: input.message,
            onStatus: input.onStatus,
            recipient,
            sendEmail: input.sendEmail,
          })
        ),
        Effect.tap(() =>
          index < input.recipients.length - 1
            ? Effect.sleep(
                Duration.millis(
                  Number.isFinite(input.config.minIntervalMs)
                    ? Math.max(0, Math.trunc(input.config.minIntervalMs))
                    : 0
                )
              )
            : Effect.void
        )
      ),
    { concurrency: 1 }
  ).pipe(
    Effect.map((deliveries) => {
      const sent = deliveries.filter(Boolean).length;
      return { sent, skipped: deliveries.length - sent };
    })
  );
}

export function deliverNotificationEmailsSequentially(
  input: NotificationEmailDeliveryInput
): Promise<NotificationEmailDeliveryResult> {
  return Effect.runPromise(notificationEmailDeliveryProgram(input));
}
