import { v } from "convex/values";

const bookingStatusValidator = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("refunded")
);

const paymentEventOutcomeValidator = v.union(
  v.literal("received"),
  v.literal("processed"),
  v.literal("ignored"),
  v.literal("unmatched"),
  v.literal("failed")
);

const paymentEventSourceValidator = v.union(
  v.literal("webhook"),
  v.literal("checkout"),
  v.literal("fixture"),
  v.literal("manual")
);

const paymentMismatchValidator = v.union(
  v.literal("none"),
  v.literal("unmatched_provider_event"),
  v.literal("missing_provider_event"),
  v.literal("amount_currency_mismatch"),
  v.literal("status_mismatch"),
  v.literal("duplicate_replayed_event"),
  v.literal("processing_failure"),
  v.literal("stale_pending_state")
);

const nullableStringValidator = v.union(v.string(), v.null());
const nullableNumberValidator = v.union(v.number(), v.null());

export const paymentReconciliationRowValidator = v.object({
  amount: nullableNumberValidator,
  bookingId: v.union(v.id("bookings"), v.null()),
  bookingStatus: v.union(bookingStatusValidator, v.null()),
  currency: v.string(),
  errorMessage: nullableStringValidator,
  eventType: v.string(),
  expectedStatus: v.union(bookingStatusValidator, v.null()),
  id: v.string(),
  isFixture: v.boolean(),
  mismatchCategory: paymentMismatchValidator,
  orderId: v.string(),
  outcome: paymentEventOutcomeValidator,
  paymentId: nullableStringValidator,
  processedAt: nullableStringValidator,
  provider: v.string(),
  providerEventId: v.string(),
  receivedAt: v.string(),
  retryCount: v.number(),
  source: paymentEventSourceValidator,
  statusAfter: v.union(bookingStatusValidator, v.null()),
  statusBefore: v.union(bookingStatusValidator, v.null()),
  tripId: v.union(v.id("trips"), v.null()),
  updatedAt: v.string(),
});

export const paymentReconciliationListResultValidator = v.object({
  dataMode: v.union(v.literal("production"), v.literal("fixtures")),
  fixtureModeAllowed: v.boolean(),
  fixtureRowCount: v.number(),
  hasMore: v.boolean(),
  productionRowCount: v.number(),
  rows: v.array(paymentReconciliationRowValidator),
});

export const paymentReconciliationAuditValidator = v.object({
  action: v.union(
    v.literal("reprocess_requested"),
    v.literal("reprocess_completed"),
    v.literal("reprocess_failed")
  ),
  actorAuthUserId: v.string(),
  actorName: v.string(),
  afterOutcome: nullableStringValidator,
  beforeOutcome: nullableStringValidator,
  createdAt: v.string(),
  reason: v.string(),
  result: nullableStringValidator,
});

export const paymentReconciliationDetailResultValidator = v.object({
  audits: v.array(paymentReconciliationAuditValidator),
  event: v.union(paymentReconciliationRowValidator, v.null()),
  history: v.array(paymentReconciliationRowValidator),
});

export const paymentProviderEventWriteResultValidator = v.object({
  duplicate: v.boolean(),
  id: v.id("paymentProviderEvents"),
  outcome: paymentEventOutcomeValidator,
});

export const paymentReconciliationRequestResultValidator = v.object({
  duplicateEvent: v.boolean(),
  eventId: v.string(),
  mismatchCategory: paymentMismatchValidator,
  outcome: paymentEventOutcomeValidator,
  status: v.union(bookingStatusValidator, v.null()),
});
