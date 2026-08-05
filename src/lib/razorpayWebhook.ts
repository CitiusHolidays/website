import { Effect } from "effect";
import { buildExternalIoEffect } from "./effectAdoption";

// Effect: external-io, typed-recoverable-errors (see effectAdoption.ts).
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
  id?: unknown;
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
    amount?: number;
    currency?: string;
    eventType?: string;
    orderId: string;
    paymentId: string;
    provider?: string;
    providerEventId: string;
    providerStatus?: string;
    reason: string;
    serverSecret: string;
    source?: "webhook" | "checkout" | "fixture" | "manual";
  }) => Promise<{ alreadyConfirmed?: boolean; booking?: { id?: unknown }; success?: boolean }>;
  getServerSecret: () => string | null;
  markPaymentFailedByOrderId: (args: {
    amount?: number;
    currency?: string;
    eventType?: string;
    orderId: string;
    paymentId: string;
    provider?: string;
    providerEventId: string;
    providerStatus?: string;
    reason: string;
    serverSecret: string;
    source?: "webhook" | "checkout" | "fixture" | "manual";
  }) => Promise<{ id?: unknown; ignored?: boolean; status?: unknown }>;
  markRefundedByPaymentId: (args: {
    amount?: number;
    currency?: string;
    eventType?: string;
    paymentId: string;
    provider?: string;
    providerEventId: string;
    providerStatus?: string;
    reason: string;
    serverSecret: string;
    source?: "webhook" | "checkout" | "fixture" | "manual";
  }) => Promise<unknown>;
  recordPaymentAuthorized: (args: {
    amount?: number;
    currency?: string;
    eventType?: string;
    orderId: string;
    paymentId: string;
    provider?: string;
    providerEventId: string;
    providerStatus?: string;
    reason: string;
    serverSecret: string;
    source?: "webhook" | "checkout" | "fixture" | "manual";
  }) => Promise<unknown>;
  recordProviderEvent?: (args: {
    amount?: number;
    currency?: string;
    errorMessage?: string;
    eventType: string;
    isFixture?: boolean;
    orderId?: string;
    paymentId?: string;
    provider: string;
    providerEventId: string;
    providerStatus?: string;
    refundId?: string;
    serverSecret: string;
    source: "webhook";
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

function webhookEventMetadata(event: string, entityId: string, webhookId?: string) {
  return {
    providerEventId: webhookId ? `razorpay:webhook:${webhookId}` : `razorpay:${event}:${entityId}`,
    reason: `Razorpay ${event} webhook`,
  };
}

function requireServerSecret(deps: RazorpayWebhookDeps) {
  const serverSecret = deps.getServerSecret();
  if (!serverSecret) {
    throw new Error("Payment mutation secret is not configured");
  }
  return serverSecret;
}

async function recordProviderEvent(
  deps: RazorpayWebhookDeps,
  args: Parameters<NonNullable<RazorpayWebhookDeps["recordProviderEvent"]>>[0]
) {
  if (deps.recordProviderEvent) {
    await deps.recordProviderEvent(args);
  }
}

type ProviderEventRecordArgs = Parameters<
  NonNullable<RazorpayWebhookDeps["recordProviderEvent"]>
>[0];

async function recordProviderEventFailure(
  deps: RazorpayWebhookDeps,
  args: ProviderEventRecordArgs,
  error: unknown
) {
  if (!deps.recordProviderEvent) {
    return;
  }
  try {
    await recordProviderEvent(deps, {
      ...args,
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Processing failed",
    });
  } catch (recordError) {
    console.error("Unable to persist Razorpay webhook failure:", recordError);
  }
}

async function runPaymentMutationWithReconciliation<Result>(
  deps: RazorpayWebhookDeps,
  operation: string,
  run: () => Promise<Result>,
  providerEvent: ProviderEventRecordArgs
) {
  try {
    return await runPaymentMutation(operation, run);
  } catch (error) {
    await recordProviderEventFailure(deps, providerEvent, error);
    throw error;
  }
}

async function rejectIncompleteWebhook(
  event: string,
  entityId: string,
  webhookId: string | undefined,
  deps: RazorpayWebhookDeps,
  reason: string
): Promise<never> {
  const serverSecret = requireServerSecret(deps);
  await recordProviderEvent(deps, {
    ...webhookEventMetadata(event, entityId, webhookId),
    errorMessage: reason,
    eventType: event,
    provider: "razorpay",
    serverSecret,
    source: "webhook",
  });
  throw new Error(reason);
}

function withProviderMetadata<T extends object>(
  deps: RazorpayWebhookDeps,
  base: T,
  metadata: Record<string, unknown>
) {
  return deps.recordProviderEvent ? { ...base, ...metadata } : base;
}

async function handlePaymentAuthorized(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps,
  webhookId?: string
): Promise<RazorpayWebhookResult> {
  if (!(payment?.order_id && payment.id)) {
    return await rejectIncompleteWebhook(
      "payment.authorized",
      payment?.id ?? webhookId ?? "unknown",
      webhookId,
      deps,
      "Incomplete Razorpay payment.authorized payload"
    );
  }
  const orderId = payment.order_id;
  const paymentId = payment.id;

  const serverSecret = requireServerSecret(deps);
  const providerEvent = {
    ...webhookEventMetadata("payment.authorized", paymentId, webhookId),
    amount: payment.amount,
    currency: payment.currency,
    eventType: "payment.authorized",
    orderId,
    paymentId,
    provider: "razorpay",
    providerStatus: payment.status,
    serverSecret,
    source: "webhook" as const,
  };

  await recordProviderEvent(deps, providerEvent);

  await runPaymentMutationWithReconciliation(
    deps,
    "record Razorpay payment authorization",
    () =>
      deps.recordPaymentAuthorized(
        withProviderMetadata(
          deps,
          {
            orderId,
            paymentId,
            ...webhookEventMetadata("payment.authorized", paymentId, webhookId),
            reason: "Razorpay payment.authorized webhook",
            serverSecret,
          },
          {
            amount: payment.amount,
            currency: payment.currency,
            eventType: "payment.authorized",
            provider: "razorpay",
            providerStatus: payment.status,
            source: "webhook",
          }
        )
      ),
    providerEvent
  );
  return { action: "payment.authorized", received: true };
}

async function handlePaymentCaptured(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps,
  webhookId?: string
): Promise<RazorpayWebhookResult> {
  if (!(payment?.order_id && payment.id)) {
    return await rejectIncompleteWebhook(
      "payment.captured",
      payment?.id ?? webhookId ?? "unknown",
      webhookId,
      deps,
      "Incomplete Razorpay payment.captured payload"
    );
  }
  const orderId = payment.order_id;
  const paymentId = payment.id;

  const serverSecret = requireServerSecret(deps);
  const providerEvent = {
    ...webhookEventMetadata("payment.captured", paymentId, webhookId),
    amount: payment.amount,
    currency: payment.currency,
    eventType: "payment.captured",
    orderId,
    paymentId,
    provider: "razorpay",
    providerStatus: payment.status,
    serverSecret,
    source: "webhook" as const,
  };

  await recordProviderEvent(deps, providerEvent);

  await runPaymentMutationWithReconciliation(
    deps,
    "confirm Razorpay booking from webhook",
    () =>
      deps.confirmBookingByOrderId(
        withProviderMetadata(
          deps,
          {
            orderId,
            paymentId,
            ...webhookEventMetadata("payment.captured", paymentId, webhookId),
            reason: "Razorpay payment.captured webhook",
            serverSecret,
          },
          {
            amount: payment.amount,
            currency: payment.currency,
            eventType: "payment.captured",
            provider: "razorpay",
            providerStatus: payment.status,
            source: "webhook",
          }
        )
      ),
    providerEvent
  );
  return { action: "payment.captured", received: true };
}

async function handlePaymentFailed(
  payment: RazorpayPaymentEntity | undefined,
  deps: RazorpayWebhookDeps,
  webhookId?: string
): Promise<RazorpayWebhookResult> {
  if (!(payment?.order_id && payment.id)) {
    return await rejectIncompleteWebhook(
      "payment.failed",
      payment?.id ?? webhookId ?? "unknown",
      webhookId,
      deps,
      "Incomplete Razorpay payment.failed payload"
    );
  }
  const orderId = payment.order_id;
  const paymentId = payment.id;

  const serverSecret = requireServerSecret(deps);
  const providerEvent = {
    ...webhookEventMetadata("payment.failed", paymentId, webhookId),
    amount: payment.amount,
    currency: payment.currency,
    eventType: "payment.failed",
    orderId,
    paymentId,
    provider: "razorpay",
    providerStatus: payment.status,
    serverSecret,
    source: "webhook" as const,
  };

  await recordProviderEvent(deps, providerEvent);

  await runPaymentMutationWithReconciliation(
    deps,
    "mark Razorpay booking failed",
    () =>
      deps.markPaymentFailedByOrderId(
        withProviderMetadata(
          deps,
          {
            orderId,
            paymentId,
            ...webhookEventMetadata("payment.failed", paymentId, webhookId),
            reason: "Razorpay payment.failed webhook",
            serverSecret,
          },
          {
            amount: payment.amount,
            currency: payment.currency,
            eventType: "payment.failed",
            provider: "razorpay",
            providerStatus: payment.status,
            source: "webhook",
          }
        )
      ),
    providerEvent
  );
  return { action: "payment.failed", received: true };
}

async function handleRefundCreated(
  refund: RazorpayRefundEntity | undefined,
  deps: RazorpayWebhookDeps,
  webhookId?: string
): Promise<RazorpayWebhookResult> {
  if (!refund?.payment_id) {
    return await rejectIncompleteWebhook(
      "refund.created",
      refund?.id ?? webhookId ?? "unknown",
      webhookId,
      deps,
      "Incomplete Razorpay refund.created payload"
    );
  }
  const paymentId = refund.payment_id;

  const serverSecret = requireServerSecret(deps);
  const providerEvent = {
    ...webhookEventMetadata("refund.created", refund.id ?? paymentId, webhookId),
    amount: refund.amount,
    currency: refund.currency,
    eventType: "refund.created",
    paymentId,
    provider: "razorpay",
    providerStatus: refund.status,
    refundId: refund.id,
    serverSecret,
    source: "webhook" as const,
  };

  await recordProviderEvent(deps, providerEvent);

  await runPaymentMutationWithReconciliation(
    deps,
    "mark Razorpay payment refunded",
    () =>
      deps.markRefundedByPaymentId(
        withProviderMetadata(
          deps,
          {
            paymentId,
            ...webhookEventMetadata("refund.created", refund.id ?? paymentId, webhookId),
            reason: "Razorpay refund.created webhook",
            serverSecret,
          },
          {
            amount: refund.amount,
            currency: refund.currency,
            eventType: "refund.created",
            provider: "razorpay",
            providerStatus: refund.status,
            source: "webhook",
          }
        )
      ),
    providerEvent
  );
  return { action: "refund.created", received: true };
}

export async function processRazorpayWebhookEvent(
  payload: RazorpayWebhookPayload,
  deps: RazorpayWebhookDeps
): Promise<RazorpayWebhookResult> {
  const event = typeof payload.event === "string" ? payload.event : "";
  const webhookId = typeof payload.id === "string" ? payload.id : undefined;
  const paymentEntity = payload.payload?.payment?.entity;

  switch (event) {
    case "payment.authorized":
      return await handlePaymentAuthorized(paymentEntity, deps, webhookId);
    case "payment.captured":
      return await handlePaymentCaptured(paymentEntity, deps, webhookId);
    case "payment.failed":
      return await handlePaymentFailed(paymentEntity, deps, webhookId);
    case "refund.created":
      return await handleRefundCreated(payload.payload?.refund?.entity, deps, webhookId);
    default:
      if (deps.recordProviderEvent && webhookId) {
        const serverSecret = requireServerSecret(deps);
        await recordProviderEvent(deps, {
          eventType: event || "unknown",
          provider: "razorpay",
          providerEventId: `razorpay:webhook:${webhookId}`,
          serverSecret,
          source: "webhook",
        });
        return { action: "unhandled", received: true };
      }
      if (deps.recordProviderEvent) {
        throw new Error("Unidentified Razorpay webhook event");
      }
      return { action: "unhandled", received: true };
  }
}
