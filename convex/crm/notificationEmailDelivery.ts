import { Effect } from "effect";

// Effect: external-io, retry-or-throttle, typed-recoverable-errors,
// test-time-dependency-substitution (see src/lib/effectAdoption.ts).
export interface NotificationEmailMessage {
  from: string;
  html: string;
  subject: string;
  text: string;
}

export interface NotificationEmailSendMessage extends NotificationEmailMessage {
  to: string[];
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
  message: NotificationEmailMessage;
  recipients: string[];
  sendEmail: (message: NotificationEmailSendMessage) => Promise<NotificationEmailSendResult>;
  sleep: (ms: number) => Promise<void>;
}

class NotificationEmailDeliveryFailure {
  readonly _tag = "NotificationEmailDeliveryFailure";
  readonly error: NotificationEmailProviderError;

  constructor(error: NotificationEmailProviderError) {
    this.error = error;
  }
}

function isRateLimitError(error: NotificationEmailProviderError) {
  return error.statusCode === 429 || error.name === "rate_limit_exceeded";
}

function sendEmailAttempt(input: {
  message: NotificationEmailMessage;
  recipient: string;
  sendEmail: (message: NotificationEmailSendMessage) => Promise<NotificationEmailSendResult>;
}) {
  return Effect.tryPromise({
    catch: (error) =>
      new NotificationEmailDeliveryFailure(
        typeof error === "object" && error !== null
          ? (error as NotificationEmailProviderError)
          : { name: String(error) }
      ),
    try: async () => {
      const result = await input.sendEmail({
        ...input.message,
        to: [input.recipient],
      });
      if (result.error) {
        throw result.error;
      }
      return true;
    },
  });
}

async function sendEmailWithRetry(input: {
  config: NotificationEmailDeliveryConfig;
  message: NotificationEmailMessage;
  recipient: string;
  sendEmail: (message: NotificationEmailSendMessage) => Promise<NotificationEmailSendResult>;
  sleep: (ms: number) => Promise<void>;
}) {
  for (let attempt = 0; attempt < input.config.maxRetries; attempt += 1) {
    const result = await Effect.runPromise(
      Effect.match(sendEmailAttempt(input), {
        onFailure: (failure) => ({ error: failure.error, ok: false as const }),
        onSuccess: () => ({ ok: true as const }),
      })
    );
    if (result.ok) {
      return true;
    }

    const canRetry = isRateLimitError(result.error) && attempt < input.config.maxRetries - 1;
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
    const delivered = await sendEmailWithRetry({
      config: input.config,
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
