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

function classifyRazorpayWebhookFailure(error: unknown): RazorpayWebhookFailure {
  if (error instanceof SyntaxError) {
    return { detail: "Invalid webhook payload", tag: "invalid_payload" };
  }
  if (error instanceof RazorpayWebhookPayloadError) {
    return { detail: error.message, tag: "invalid_payload" };
  }
  if (error instanceof RazorpayWebhookConfigurationError) {
    return { tag: "invalid_configuration" };
  }
  return { tag: "mutation_unavailable" };
}

function assertNever(_value: never): never {
  throw new Error("Unhandled Razorpay webhook failure");
}

export function mapRazorpayWebhookProcessingError(error: unknown): RazorpayWebhookErrorResponse {
  const failure = classifyRazorpayWebhookFailure(error);
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
      return { action: "ignored", event, received: true };
  }
}
