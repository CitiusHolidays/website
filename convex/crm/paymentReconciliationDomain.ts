import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { env } from "../_generated/server";

export type PaymentProviderEventSource = "webhook" | "checkout" | "fixture" | "manual";
export type PaymentProviderEventOutcome =
  | "received"
  | "processed"
  | "ignored"
  | "unmatched"
  | "failed";
export type PaymentReconciliationMismatch =
  | "none"
  | "unmatched_provider_event"
  | "missing_provider_event"
  | "amount_currency_mismatch"
  | "status_mismatch"
  | "duplicate_replayed_event"
  | "processing_failure"
  | "stale_pending_state";

export interface ProviderEventInput {
  amount?: number;
  currency?: string;
  errorMessage?: string;
  eventType: string;
  isFixture?: boolean;
  orderId?: string;
  paymentId?: string;
  provider?: string;
  providerEventId: string;
  providerStatus?: string;
  refundId?: string;
  source?: PaymentProviderEventSource;
}

export interface PaymentTransitionMetadata {
  amount?: number;
  currency?: string;
  eventType?: string;
  isFixture?: boolean;
  orderId?: string;
  paymentId?: string;
  provider?: string;
  providerEventId: string;
  providerStatus?: string;
  reason: string;
  source?: PaymentProviderEventSource;
  transition: "authorized" | "confirmed" | "failed" | "refunded";
}

export interface PaymentTransitionResult {
  duplicateEvent?: boolean;
  ignored?: boolean;
  message?: string;
  status?: Doc<"bookings">["status"];
  success?: boolean;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function eventTypeForTransition(transition: PaymentTransitionMetadata["transition"]) {
  switch (transition) {
    case "authorized":
      return "payment.authorized";
    case "confirmed":
      return "payment.captured";
    case "failed":
      return "payment.failed";
    case "refunded":
      return "refund.created";
  }
}

export function expectedStatusForEvent(eventType: string): Doc<"bookings">["status"] | undefined {
  switch (eventType) {
    case "payment.authorized":
      return "pending";
    case "payment.captured":
    case "checkout.payment.confirmed":
      return "confirmed";
    case "payment.failed":
      return "failed";
    case "refund.created":
      return "refunded";
    default:
      return;
  }
}

export function transitionForEvent(eventType: string) {
  switch (eventType) {
    case "payment.authorized":
      return "authorized" as const;
    case "payment.captured":
    case "checkout.payment.confirmed":
      return "confirmed" as const;
    case "payment.failed":
      return "failed" as const;
    case "refund.created":
      return "refunded" as const;
    default:
      return null;
  }
}

export function normalizeProviderEventId(providerEventId: string) {
  return providerEventId.trim();
}

export function classifyPaymentMismatch({
  amount,
  booking,
  duplicateEvent = false,
  eventType,
  outcome,
  statusAfter,
  currency,
  now,
}: {
  amount?: number;
  booking?: Pick<Doc<"bookings">, "createdAt" | "currency" | "status" | "totalAmount"> | null;
  currency?: string;
  duplicateEvent?: boolean;
  eventType: string;
  now?: number;
  outcome: PaymentProviderEventOutcome;
  statusAfter?: Doc<"bookings">["status"];
}): PaymentReconciliationMismatch {
  if (!booking) {
    return "unmatched_provider_event";
  }
  if (outcome === "failed") {
    return "processing_failure";
  }
  if (
    (amount !== undefined && amount !== booking.totalAmount) ||
    (currency !== undefined && currency !== booking.currency)
  ) {
    return "amount_currency_mismatch";
  }
  const expectedStatus = expectedStatusForEvent(eventType);
  if (expectedStatus && statusAfter && expectedStatus !== statusAfter) {
    return "status_mismatch";
  }
  if (duplicateEvent) {
    return "duplicate_replayed_event";
  }
  if (
    now !== undefined &&
    booking.status === "pending" &&
    now - booking.createdAt > ONE_DAY_MS &&
    (!expectedStatus || expectedStatus === "pending")
  ) {
    return "stale_pending_state";
  }
  return "none";
}

async function findBookingForProviderEvent(ctx: QueryCtx | MutationCtx, input: ProviderEventInput) {
  if (input.orderId) {
    const orderId = input.orderId;
    const byOrder = await ctx.db
      .query("bookings")
      .withIndex("by_razorpayOrderId", (q) => q.eq("razorpayOrderId", orderId))
      .take(1);
    if (byOrder[0]) {
      return byOrder[0];
    }
  }
  if (input.paymentId) {
    const paymentId = input.paymentId;
    const byPayment = await ctx.db
      .query("bookings")
      .withIndex("by_razorpayPaymentId", (q) => q.eq("razorpayPaymentId", paymentId))
      .take(1);
    return byPayment[0] ?? null;
  }
  return null;
}

export async function findProviderEvent(ctx: QueryCtx | MutationCtx, providerEventId: string) {
  const normalized = normalizeProviderEventId(providerEventId);
  if (!normalized) {
    return null;
  }
  return await ctx.db
    .query("paymentProviderEvents")
    .withIndex("by_providerEventId", (q) => q.eq("providerEventId", normalized))
    .unique();
}

export async function upsertProviderEvent(ctx: MutationCtx, input: ProviderEventInput) {
  const providerEventId = normalizeProviderEventId(input.providerEventId);
  if (!providerEventId) {
    throw new Error("Provider event identity is required");
  }

  const existing = await findProviderEvent(ctx, providerEventId);
  const booking = await findBookingForProviderEvent(ctx, input);
  const receivedAt = existing?.receivedAt ?? Date.now();
  // A provider event's source is immutable after its first receipt. Manual
  // reprocessing must not rewrite a webhook event as if it were a new source.
  const source = existing?.source ?? input.source ?? "webhook";
  const isFixture = input.isFixture ?? existing?.isFixture ?? source === "fixture";
  const eventType = input.eventType || existing?.eventType || "unknown";
  const expectedStatus = expectedStatusForEvent(eventType);
  const processingFailure = Boolean(input.errorMessage);
  const common = {
    amount: input.amount ?? existing?.amount,
    bookingId: booking?._id ?? existing?.bookingId,
    currency: input.currency ?? existing?.currency,
    errorMessage: input.errorMessage ?? existing?.errorMessage,
    eventType,
    expectedStatus,
    isFixture,
    orderId: input.orderId ?? existing?.orderId,
    paymentId: input.paymentId ?? existing?.paymentId,
    provider: input.provider ?? existing?.provider ?? "razorpay",
    providerEventId,
    providerStatus: input.providerStatus ?? existing?.providerStatus,
    refundId: input.refundId ?? existing?.refundId,
    source,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...common,
      ...(processingFailure
        ? {
            mismatchCategory: "processing_failure" as const,
            outcome: "failed" as const,
            retryCount: existing.retryCount + 1,
          }
        : {}),
    });
    return await ctx.db.get(existing._id);
  }

  const id = await ctx.db.insert("paymentProviderEvents", {
    ...common,
    mismatchCategory: processingFailure
      ? "processing_failure"
      : booking
        ? "none"
        : "unmatched_provider_event",
    outcome: processingFailure ? "failed" : booking ? "received" : "unmatched",
    receivedAt,
    retryCount: processingFailure ? 1 : 0,
  });
  return await ctx.db.get(id as Id<"paymentProviderEvents">);
}

export async function finalizeProviderEvent(
  ctx: MutationCtx,
  metadata: PaymentTransitionMetadata,
  result: PaymentTransitionResult,
  booking: Doc<"bookings"> | null
) {
  const event = await findProviderEvent(ctx, metadata.providerEventId);
  if (!event) {
    return;
  }

  const outcome: PaymentProviderEventOutcome =
    result.success === false
      ? "unmatched"
      : result.duplicateEvent || result.ignored
        ? "ignored"
        : "processed";
  const statusAfter = booking?.status;
  const mismatchCategory = classifyPaymentMismatch({
    amount: event.amount,
    booking,
    currency: event.currency,
    duplicateEvent: Boolean(result.duplicateEvent),
    eventType: event.eventType,
    now: Date.now(),
    outcome,
    statusAfter,
  });

  await ctx.db.patch(event._id, {
    bookingId: booking?._id ?? event.bookingId,
    mismatchCategory,
    outcome,
    processedAt: Date.now(),
    statusAfter,
    updatedAt: Date.now(),
  });
}

export async function markProviderEventProcessingFailure(
  ctx: MutationCtx,
  providerEventId: string,
  error: unknown
) {
  const event = await findProviderEvent(ctx, providerEventId);
  if (!event) {
    return;
  }
  await ctx.db.patch(event._id, {
    errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Processing failed",
    mismatchCategory: "processing_failure",
    outcome: "failed",
    retryCount: event.retryCount + 1,
    updatedAt: Date.now(),
  });
}

export interface PaymentReconciliationFixtureRow {
  amount: number | null;
  bookingId: null;
  bookingStatus: Doc<"bookings">["status"] | null;
  currency: string;
  errorMessage: null;
  eventType: string;
  expectedStatus: Doc<"bookings">["status"] | null;
  id: string;
  isFixture: true;
  mismatchCategory: PaymentReconciliationMismatch;
  orderId: string;
  outcome: PaymentProviderEventOutcome;
  paymentId: string | null;
  processedAt: string | null;
  provider: string;
  providerEventId: string;
  receivedAt: string;
  retryCount: number;
  source: "fixture";
  statusAfter: Doc<"bookings">["status"] | null;
  statusBefore: Doc<"bookings">["status"] | null;
  tripId: null;
  updatedAt: string;
}

const FIXTURE_TIME = Date.UTC(2026, 0, 15, 12, 0, 0);

export function paymentReconciliationFixtures(): PaymentReconciliationFixtureRow[] {
  const make = (
    suffix: string,
    eventType: string,
    outcome: PaymentProviderEventOutcome,
    mismatchCategory: PaymentReconciliationMismatch,
    statusAfter: Doc<"bookings">["status"] | null,
    amount: number | null = 1000
  ): PaymentReconciliationFixtureRow => {
    const providerEventId = `fixture:razorpay:${suffix}`;
    const receivedAt = new Date(FIXTURE_TIME).toISOString();
    return {
      amount,
      bookingId: null,
      bookingStatus: statusAfter,
      currency: "INR",
      errorMessage: null,
      eventType,
      expectedStatus: expectedStatusForEvent(eventType) ?? null,
      id: providerEventId,
      isFixture: true,
      mismatchCategory,
      orderId: `fixture_order_${suffix}`,
      outcome,
      paymentId: `fixture_payment_${suffix}`,
      processedAt: outcome === "received" ? null : receivedAt,
      provider: "razorpay",
      providerEventId,
      receivedAt,
      retryCount: outcome === "failed" ? 1 : 0,
      source: "fixture",
      statusAfter,
      statusBefore: statusAfter === "confirmed" ? "pending" : null,
      tripId: null,
      updatedAt: receivedAt,
    };
  };

  return [
    make("authorized", "payment.authorized", "processed", "none", "pending"),
    make("captured", "payment.captured", "processed", "none", "confirmed"),
    make("failed", "payment.failed", "processed", "processing_failure", "failed"),
    make("refunded", "refund.created", "processed", "none", "refunded"),
    make("unmatched", "payment.captured", "unmatched", "unmatched_provider_event", null),
    make(
      "amount-mismatch",
      "payment.captured",
      "processed",
      "amount_currency_mismatch",
      "confirmed",
      999
    ),
    make("pending", "unknown", "received", "stale_pending_state", "pending"),
  ];
}

export function fixtureModeAllowed() {
  const nonProduction = env.NODE_ENV === "development" || env.NODE_ENV === "test";
  return nonProduction && env.PAYMENT_RECONCILIATION_FIXTURES === "true";
}
