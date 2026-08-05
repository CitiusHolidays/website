import { Effect } from "effect";
import { buildExternalIoEffect, ExternalIoFailure } from "./effectAdoption";

// Effect: external-io, typed-recoverable-errors (see effectAdoption.ts).
export interface RazorpayPaymentEntity {
  error_description?: string;
  id?: string;
  order_id?: string;
}

export interface RazorpayRefundEntity {
  id?: string;
  payment_id?: string;
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

export interface RazorpayWebhookDeps {
  confirmBookingByOrderId: (args: {
    orderId: string;
    paymentId: string;
    providerEventId: string;
    reason: string;
    serverSecret: string;
  }) => Promise<{ alreadyConfirmed?: boolean; booking?: { id?: unknown }; success?: boolean }>;
  getServerSecret: () => string | null;
  markPaymentFailedByOrderId: (args: {
    orderId: string;
    paymentId: string;
    providerEventId: string;
    reason: string;
    serverSecret: string;
  }) => Promise<{ id?: unknown; ignored?: boolean; status?: unknown }>;
  markRefundedByPaymentId: (args: {
    paymentId: string;
    providerEventId: string;
    reason: string;
    serverSecret: string;
  }) => Promise<unknown>;
  recordPaymentAuthorized: (args: {
    orderId: string;
    paymentId: string;
    providerEventId: string;
    reason: string;
    serverSecret: string;
  }) => Promise<unknown>;
}

export interface RazorpayWebhookResult {
  action: string;
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

  constructor() {
    super("Payment mutation secret is not configured");
    this.name = "RazorpayWebhookConfigurationError";
  }
}

export function mapRazorpayWebhookProcessingError(error: unknown): RazorpayWebhookErrorResponse {
  if (error instanceof SyntaxError) {
    return { body: { error: "Invalid webhook payload" }, status: 400 };
  }
  if (error instanceof RazorpayWebhookPayloadError) {
    return { body: { error: error.message }, status: 400 };
  }
  if (error instanceof RazorpayWebhookConfigurationError) {
    return { body: { error: "Webhook not configured" }, status: 500 };
  }
  if (
    error instanceof ExternalIoFailure &&
    String(error.cause).toLowerCase().includes("payment mutation secret")
  ) {
    // Convex rejects a server-secret mismatch inside the external mutation.
    // Keep the response safe while preserving the configuration diagnosis in
    // logs (the route logs the original error).
    return { body: { error: "Webhook not configured" }, status: 500 };
  }
  return { body: { error: "Webhook processing failed" }, status: 500 };
}

async function runPaymentMutation<Result>(operation: string, run: () => Promise<Result>) {
  return await Effect.runPromise(buildExternalIoEffect(operation, run));
}

function webhookEventMetadata(event: string, entityId: string) {
  return {
    providerEventId: `razorpay:${event}:${entityId}`,
    reason: `Razorpay ${event} webhook`,
  };
}

function requirePaymentEntity(
  event: string,
  payment: RazorpayPaymentEntity | undefined
): { orderId: string; paymentId: string } {
  const orderId = payment?.order_id;
  const paymentId = payment?.id;
  if (typeof orderId !== "string" || orderId.trim().length === 0) {
    throw new RazorpayWebhookPayloadError(
      `Invalid Razorpay webhook payload: ${event} requires payment.entity.order_id`
    );
  }
  if (typeof paymentId !== "string" || paymentId.trim().length === 0) {
    throw new RazorpayWebhookPayloadError(
      `Invalid Razorpay webhook payload: ${event} requires payment.entity.id`
    );
  }
  return { orderId, paymentId };
}

function requireRefundEntity(
  event: string,
  refund: RazorpayRefundEntity | undefined
): { paymentId: string; refundId: string } {
  const paymentId = refund?.payment_id;
  const refundId = refund?.id;
  if (typeof paymentId !== "string" || paymentId.trim().length === 0) {
    throw new RazorpayWebhookPayloadError(
      `Invalid Razorpay webhook payload: ${event} requires refund.entity.payment_id`
    );
  }
  if (typeof refundId !== "string" || refundId.trim().length === 0) {
    throw new RazorpayWebhookPayloadError(
      `Invalid Razorpay webhook payload: ${event} requires refund.entity.id`
    );
  }
  return { paymentId, refundId };
}

function requireServerSecret(deps: RazorpayWebhookDeps) {
  const serverSecret = deps.getServerSecret();
  if (typeof serverSecret !== "string" || serverSecret.trim().length === 0) {
    throw new RazorpayWebhookConfigurationError();
  }
  return serverSecret;
}

async function handlePaymentAuthorized(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps
): Promise<RazorpayWebhookResult> {
  const { orderId, paymentId } = requirePaymentEntity("payment.authorized", payment);
  const serverSecret = requireServerSecret(deps);

  await runPaymentMutation("record Razorpay payment authorization", () =>
    deps.recordPaymentAuthorized({
      orderId,
      paymentId,
      ...webhookEventMetadata("payment.authorized", paymentId),
      serverSecret,
    })
  );
  return { action: "payment.authorized", received: true };
}

async function handlePaymentCaptured(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps
): Promise<RazorpayWebhookResult> {
  const { orderId, paymentId } = requirePaymentEntity("payment.captured", payment);
  const serverSecret = requireServerSecret(deps);

  await runPaymentMutation("confirm Razorpay booking from webhook", () =>
    deps.confirmBookingByOrderId({
      orderId,
      paymentId,
      ...webhookEventMetadata("payment.captured", paymentId),
      serverSecret,
    })
  );
  return { action: "payment.captured", received: true };
}

async function handlePaymentFailed(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps
): Promise<RazorpayWebhookResult> {
  const { orderId, paymentId } = requirePaymentEntity("payment.failed", payment);
  const serverSecret = requireServerSecret(deps);

  await runPaymentMutation("mark Razorpay booking failed", () =>
    deps.markPaymentFailedByOrderId({
      orderId,
      paymentId,
      ...webhookEventMetadata("payment.failed", paymentId),
      serverSecret,
    })
  );
  return { action: "payment.failed", received: true };
}

async function handleRefundCreated(
  refund: RazorpayRefundEntity | undefined,
  deps: RazorpayWebhookDeps
): Promise<RazorpayWebhookResult> {
  const { paymentId, refundId } = requireRefundEntity("refund.created", refund);
  const serverSecret = requireServerSecret(deps);

  await runPaymentMutation("mark Razorpay payment refunded", () =>
    deps.markRefundedByPaymentId({
      paymentId,
      ...webhookEventMetadata("refund.created", refundId),
      serverSecret,
    })
  );
  return { action: "refund.created", received: true };
}

export async function processRazorpayWebhookEvent(
  payload: RazorpayWebhookPayload | null | undefined,
  deps: RazorpayWebhookDeps
): Promise<RazorpayWebhookResult> {
  const event = typeof payload?.event === "string" ? payload.event : "";
  if (!event) {
    throw new RazorpayWebhookPayloadError("Invalid Razorpay webhook payload: event is required");
  }
  const paymentEntity = payload?.payload?.payment?.entity;

  switch (event) {
    case "payment.authorized":
      return await handlePaymentAuthorized(paymentEntity, deps);
    case "payment.captured":
      return await handlePaymentCaptured(paymentEntity, deps);
    case "payment.failed":
      return await handlePaymentFailed(paymentEntity, deps);
    case "refund.created":
      return await handleRefundCreated(payload?.payload?.refund?.entity, deps);
    default:
      throw new RazorpayWebhookPayloadError(`Unsupported Razorpay webhook event: ${event}`);
  }
}
