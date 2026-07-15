import { Effect } from "effect";
import { buildExternalIoEffect } from "./effectAdoption";

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

export function mapRazorpayWebhookProcessingError(error: unknown): RazorpayWebhookErrorResponse {
  if (error instanceof SyntaxError) {
    return { body: { error: "Invalid webhook payload" }, status: 400 };
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

async function handlePaymentAuthorized(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps
): Promise<RazorpayWebhookResult> {
  if (!(payment?.order_id && payment.id)) {
    return { action: "payment.authorized.skipped-missing-payment", received: true };
  }
  const orderId = payment.order_id;
  const paymentId = payment.id;

  const serverSecret = deps.getServerSecret();
  if (!serverSecret) {
    return { action: "payment.authorized.skipped-missing-secret", received: true };
  }

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
  if (!(payment?.order_id && payment.id)) {
    return { action: "payment.captured.skipped-missing-payment", received: true };
  }
  const orderId = payment.order_id;
  const paymentId = payment.id;

  const serverSecret = deps.getServerSecret();
  if (!serverSecret) {
    return { action: "payment.captured.skipped-missing-secret", received: true };
  }

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
  if (!(payment?.order_id && payment.id)) {
    return { action: "payment.failed.skipped-missing-payment", received: true };
  }
  const orderId = payment.order_id;
  const paymentId = payment.id;

  const serverSecret = deps.getServerSecret();
  if (!serverSecret) {
    return { action: "payment.failed.skipped-missing-secret", received: true };
  }

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
  if (!refund?.payment_id) {
    return { action: "refund.created.skipped-missing-refund", received: true };
  }
  const paymentId = refund.payment_id;

  const serverSecret = deps.getServerSecret();
  if (!serverSecret) {
    return { action: "refund.created.skipped-missing-secret", received: true };
  }

  await runPaymentMutation("mark Razorpay payment refunded", () =>
    deps.markRefundedByPaymentId({
      paymentId,
      ...webhookEventMetadata("refund.created", refund.id ?? paymentId),
      serverSecret,
    })
  );
  return { action: "refund.created", received: true };
}

export async function processRazorpayWebhookEvent(
  payload: RazorpayWebhookPayload,
  deps: RazorpayWebhookDeps
): Promise<RazorpayWebhookResult> {
  const event = typeof payload.event === "string" ? payload.event : "";
  const paymentEntity = payload.payload?.payment?.entity;

  switch (event) {
    case "payment.authorized":
      return await handlePaymentAuthorized(paymentEntity, deps);
    case "payment.captured":
      return await handlePaymentCaptured(paymentEntity, deps);
    case "payment.failed":
      return await handlePaymentFailed(paymentEntity, deps);
    case "refund.created":
      return await handleRefundCreated(payload.payload?.refund?.entity, deps);
    default:
      return { action: "unhandled", received: true };
  }
}
