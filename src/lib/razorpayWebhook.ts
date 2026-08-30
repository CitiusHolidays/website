import { isRuntimeNumber, isRuntimeString } from "./runtimeValues";
export interface RazorpayPaymentEntity {
  amount?: number;
  currency?: string;
  error_description?: string;
  id?: string;
  order_id?: string;
  status?: string;
}

export interface RazorpayRefundEntity {
  amount?: number;
  currency?: string;
  id?: string;
  payment_id?: string;
  status?: string;
}

export interface RazorpayWebhookPayload {
  event?: unknown;
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
    refund?: {
      entity?: RazorpayRefundEntity;
    };
  };
}

export interface BookingTransitionResult {
  alreadyConfirmed?: boolean;
  booking?: { id?: string } | null;
  duplicateEvent?: boolean;
  id?: string;
  ignored?: boolean;
  message?: string;
  status?: string;
  success?: boolean;
}

export interface RazorpayWebhookDeps {
  confirmBookingByOrderId: (args: {
    amount: number;
    currency: string;
    eventType: string;
    orderId: string;
    paymentId: string;
    providerEventId: string;
    providerStatus: string;
    reason: string;
    serverSecret: string;
    source: "webhook";
  }) => Promise<BookingTransitionResult>;
  getServerSecret: () => string | null;
  markPaymentFailedByOrderId: (args: {
    amount: number;
    currency: string;
    eventType: string;
    orderId: string;
    paymentId: string;
    providerEventId: string;
    providerStatus: string;
    reason: string;
    serverSecret: string;
    source: "webhook";
  }) => Promise<BookingTransitionResult>;
  markRefundedByPaymentId: (args: {
    amount: number;
    currency: string;
    eventType: string;
    paymentId: string;
    providerEventId: string;
    providerStatus: string;
    reason: string;
    refundId: string;
    refundStatus: "failed" | "pending" | "processed";
    serverSecret: string;
    source: "webhook";
  }) => Promise<BookingTransitionResult>;
  recordPaymentAuthorized: (args: {
    amount: number;
    currency: string;
    eventType: string;
    orderId: string;
    paymentId: string;
    providerEventId: string;
    providerStatus: string;
    reason: string;
    serverSecret: string;
    source: "webhook";
  }) => Promise<BookingTransitionResult>;
}

export interface RazorpayWebhookResult {
  action: string;
  event?: string;
  received: true;
}

export interface RazorpayWebhookErrorResponse {
  body: {
    error: string;
  };
  status: 400 | 500;
}

/** A signed request whose provider payload cannot be safely interpreted. */
export class RazorpayWebhookPayloadError extends Error {
  readonly code = "invalid_webhook_payload";

  constructor(message: string) {
    super(message);
    this.name = "RazorpayWebhookPayloadError";
  }
}

/** Server configuration is unavailable, so no payment mutation may run. */
export class RazorpayWebhookConfigurationError extends Error {
  readonly code = "webhook_not_configured";

  constructor(cause?: unknown) {
    super("Payment mutation secret is not configured", cause === undefined ? undefined : { cause });
    this.name = "RazorpayWebhookConfigurationError";
  }
}

/** A payment-state mutation failed after a valid signed provider event. */
export class RazorpayWebhookMutationError extends Error {
  readonly code = "payment_mutation_unavailable";
  readonly operation: string;

  constructor(operation: string, cause: unknown) {
    super("Payment mutation is temporarily unavailable", { cause });
    this.name = "RazorpayWebhookMutationError";
    this.operation = operation;
  }
}

type RazorpayWebhookFailure =
  | { detail: string; tag: "invalid_payload" }
  | { tag: "invalid_configuration" }
  | { tag: "mutation_unavailable" };

function classifyRazorpayWebhookFailure(cause: unknown): RazorpayWebhookFailure {
  if (cause instanceof SyntaxError) {
    return { detail: "Invalid webhook payload", tag: "invalid_payload" };
  }
  if (cause instanceof RazorpayWebhookPayloadError) {
    return { detail: cause.message, tag: "invalid_payload" };
  }
  if (cause instanceof RazorpayWebhookConfigurationError) {
    return { tag: "invalid_configuration" };
  }
  return { tag: "mutation_unavailable" };
}

function assertNever(_value: never): never {
  throw new Error("Unhandled Razorpay webhook failure");
}

export function mapRazorpayWebhookProcessingError(cause: unknown): RazorpayWebhookErrorResponse {
  const failure = classifyRazorpayWebhookFailure(cause);
  switch (failure.tag) {
    case "invalid_payload":
      return { body: { error: failure.detail }, status: 400 };
    case "invalid_configuration":
      return { body: { error: "Webhook not configured" }, status: 500 };
    case "mutation_unavailable":
      return { body: { error: "Webhook processing failed" }, status: 500 };
    default:
      return assertNever(failure);
  }
}

async function runPaymentMutation<Result>(operation: string, run: () => Promise<Result>) {
  try {
    return await run();
  } catch (cause) {
    const data = cause instanceof Object && "data" in cause ? cause.data : undefined;
    if (data === "Invalid payment mutation secret") {
      // biome-ignore lint/style/useErrorCause: the domain wrapper passes this value to ErrorOptions.cause.
      throw new RazorpayWebhookConfigurationError(cause);
    }
    // biome-ignore lint/style/useErrorCause: the domain wrapper passes this value to ErrorOptions.cause.
    throw new RazorpayWebhookMutationError(operation, cause);
  }
}

function webhookEventMetadata(event: string, providerEventId: string, providerStatus: string) {
  return {
    eventType: event,
    providerEventId: `razorpay:webhook:${providerEventId}`,
    providerStatus,
    reason: `Razorpay ${event} webhook`,
    source: "webhook" as const,
  };
}

interface PaymentEntityIdentity {
  amount: number;
  currency: string;
  orderId: string;
  paymentId: string;
  providerStatus: string;
}

interface RefundEntityIdentity {
  amount: number;
  currency: string;
  paymentId: string;
  providerStatus: string;
  refundId: string;
}

function requireIdentifier(
  event: string,
  field: string,
  value: string | undefined,
  maxLength = 256
) {
  if (!isRuntimeString(value) || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new RazorpayWebhookPayloadError(
      `Invalid Razorpay webhook payload: ${event} requires ${field}`
    );
  }
  return value.trim();
}

function requireMoney(event: string, entity: { amount?: number; currency?: string }) {
  if (
    !(isRuntimeNumber(entity.amount) && Number.isSafeInteger(entity.amount)) ||
    entity.amount <= 0
  ) {
    throw new RazorpayWebhookPayloadError(
      `Invalid Razorpay webhook payload: ${event} requires a positive integer entity.amount`
    );
  }
  if (!(isRuntimeString(entity.currency) && ["INR", "USD"].includes(entity.currency))) {
    throw new RazorpayWebhookPayloadError(
      `Invalid Razorpay webhook payload: ${event} requires a supported entity.currency`
    );
  }
  return { amount: entity.amount, currency: entity.currency };
}

function requireProviderStatus(event: string, status: string | undefined) {
  return requireIdentifier(event, "entity.status", status, 64);
}

function requirePaymentEntity(
  event: string,
  payment: RazorpayPaymentEntity | undefined
): PaymentEntityIdentity {
  const orderId = requireIdentifier(event, "payment.entity.order_id", payment?.order_id);
  const paymentId = requireIdentifier(event, "payment.entity.id", payment?.id);
  return {
    ...requireMoney(event, payment ?? {}),
    orderId,
    paymentId,
    providerStatus: requireProviderStatus(event, payment?.status),
  };
}

function requireRefundEntity(
  event: string,
  refund: RazorpayRefundEntity | undefined
): RefundEntityIdentity {
  const paymentId = requireIdentifier(event, "refund.entity.payment_id", refund?.payment_id);
  const refundId = requireIdentifier(event, "refund.entity.id", refund?.id);
  return {
    ...requireMoney(event, refund ?? {}),
    paymentId,
    providerStatus: requireProviderStatus(event, refund?.status),
    refundId,
  };
}

function requireProviderEventId(providerEventId: string | undefined) {
  return requireIdentifier("webhook", "x-razorpay-event-id", providerEventId);
}

function requireServerSecret(deps: RazorpayWebhookDeps) {
  const serverSecret = deps.getServerSecret();
  if (!isRuntimeString(serverSecret) || serverSecret.trim().length === 0) {
    throw new RazorpayWebhookConfigurationError();
  }
  return serverSecret;
}

async function handlePaymentAuthorized(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps,
  providerEventId: string
): Promise<RazorpayWebhookResult> {
  const { amount, currency, orderId, paymentId, providerStatus } = requirePaymentEntity(
    "payment.authorized",
    payment
  );
  const serverSecret = requireServerSecret(deps);

  await runPaymentMutation("record Razorpay payment authorization", () =>
    deps.recordPaymentAuthorized({
      amount,
      currency,
      orderId,
      paymentId,
      ...webhookEventMetadata("payment.authorized", providerEventId, providerStatus),
      serverSecret,
    })
  );
  return { action: "payment.authorized", received: true };
}

async function handlePaymentCaptured(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps,
  providerEventId: string
): Promise<RazorpayWebhookResult> {
  const { amount, currency, orderId, paymentId, providerStatus } = requirePaymentEntity(
    "payment.captured",
    payment
  );
  const serverSecret = requireServerSecret(deps);

  await runPaymentMutation("confirm Razorpay booking from webhook", () =>
    deps.confirmBookingByOrderId({
      amount,
      currency,
      orderId,
      paymentId,
      ...webhookEventMetadata("payment.captured", providerEventId, providerStatus),
      serverSecret,
    })
  );
  return { action: "payment.captured", received: true };
}

async function handlePaymentFailed(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps,
  providerEventId: string
): Promise<RazorpayWebhookResult> {
  const { amount, currency, orderId, paymentId, providerStatus } = requirePaymentEntity(
    "payment.failed",
    payment
  );
  const serverSecret = requireServerSecret(deps);

  await runPaymentMutation("mark Razorpay booking failed", () =>
    deps.markPaymentFailedByOrderId({
      amount,
      currency,
      orderId,
      paymentId,
      ...webhookEventMetadata("payment.failed", providerEventId, providerStatus),
      serverSecret,
    })
  );
  return { action: "payment.failed", received: true };
}

function refundStatusForEvent(
  event: string,
  providerStatus: string
): "failed" | "pending" | "processed" {
  if (event === "refund.processed") {
    return "processed";
  }
  if (event === "refund.failed") {
    return "failed";
  }
  if (
    providerStatus === "failed" ||
    providerStatus === "pending" ||
    providerStatus === "processed"
  ) {
    return providerStatus;
  }
  throw new RazorpayWebhookPayloadError(
    `Invalid Razorpay webhook payload: ${event} has an unsupported refund status`
  );
}

async function handleRefundEvent(
  event: "refund.created" | "refund.failed" | "refund.processed",
  refund: RazorpayRefundEntity | undefined,
  deps: RazorpayWebhookDeps,
  providerEventId: string
): Promise<RazorpayWebhookResult> {
  const { amount, currency, paymentId, providerStatus, refundId } = requireRefundEntity(
    event,
    refund
  );
  const serverSecret = requireServerSecret(deps);

  await runPaymentMutation("mark Razorpay payment refunded", () =>
    deps.markRefundedByPaymentId({
      amount,
      currency,
      paymentId,
      ...webhookEventMetadata(event, providerEventId, providerStatus),
      refundId,
      refundStatus: refundStatusForEvent(event, providerStatus),
      serverSecret,
    })
  );
  return { action: event, received: true };
}

export async function processRazorpayWebhookEvent(
  payload: RazorpayWebhookPayload | null | undefined,
  deps: RazorpayWebhookDeps,
  providerEventId?: string
): Promise<RazorpayWebhookResult> {
  const event = isRuntimeString(payload?.event) ? payload.event : "";
  if (!event) {
    throw new RazorpayWebhookPayloadError("Invalid Razorpay webhook payload: event is required");
  }
  const paymentEntity = payload?.payload?.payment?.entity;
  const eventIdentity = requireProviderEventId(providerEventId);

  const handlers = new Map([
    ["payment.authorized", () => handlePaymentAuthorized(paymentEntity, deps, eventIdentity)],
    ["payment.captured", () => handlePaymentCaptured(paymentEntity, deps, eventIdentity)],
    ["payment.failed", () => handlePaymentFailed(paymentEntity, deps, eventIdentity)],
    [
      "refund.created",
      () =>
        handleRefundEvent("refund.created", payload?.payload?.refund?.entity, deps, eventIdentity),
    ],
    [
      "refund.processed",
      () =>
        handleRefundEvent(
          "refund.processed",
          payload?.payload?.refund?.entity,
          deps,
          eventIdentity
        ),
    ],
    [
      "refund.failed",
      () =>
        handleRefundEvent("refund.failed", payload?.payload?.refund?.entity, deps, eventIdentity),
    ],
  ]);
  const handleEvent = handlers.get(event);
  return handleEvent ? await handleEvent() : { action: "ignored", event, received: true };
}
