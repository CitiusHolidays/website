import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { projectBookingPaymentState } from "../paymentState";
import { PERMISSIONS, requireStaff } from "./lib";
import { boundedPaginationOptions } from "./paginationPolicy";

const bookingStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("refunded")
);
const outcome = v.union(
  v.literal("accepted"),
  v.literal("ignored"),
  v.literal("review_required"),
  v.literal("unmatched")
);
const paymentState = v.object({
  authorizationStatus: v.union(v.literal("authorized"), v.literal("failed"), v.literal("pending")),
  authorizedAmount: v.number(),
  capturedAmount: v.number(),
  captureStatus: v.union(v.literal("captured"), v.literal("failed"), v.literal("pending")),
  id: v.id("bookings"),
  reconciliationStatus: v.union(v.literal("clear"), v.literal("review_required")),
  refundedAmount: v.number(),
  refundStatus: v.union(
    v.literal("failed"),
    v.literal("none"),
    v.literal("partial"),
    v.literal("pending"),
    v.literal("refunded")
  ),
  remainingAmount: v.number(),
  reservationStatus: v.union(
    v.literal("cancelled"),
    v.literal("not_reserved"),
    v.literal("reserved"),
    v.literal("unavailable")
  ),
  status: bookingStatus,
});
const rowValidator = v.object({
  amount: v.union(v.number(), v.null()),
  booking: v.union(paymentState, v.null()),
  createdAt: v.number(),
  currency: v.union(v.string(), v.null()),
  eventType: v.string(),
  id: v.id("bookingPaymentEvents"),
  needsReview: v.boolean(),
  orderId: v.union(v.string(), v.null()),
  outcome,
  paymentId: v.union(v.string(), v.null()),
  providerEventId: v.string(),
  providerStatus: v.union(v.string(), v.null()),
  reason: v.string(),
  reconciliationReason: v.union(v.string(), v.null()),
  refundId: v.union(v.string(), v.null()),
  source: v.union(v.literal("checkout"), v.literal("webhook")),
  statusAfter: v.union(bookingStatus, v.null()),
  statusBefore: v.union(bookingStatus, v.null()),
  transition: v.union(
    v.literal("authorized"),
    v.literal("confirmed"),
    v.literal("failed"),
    v.literal("refunded")
  ),
});
function normalizedOutcome(
  value: string
): "accepted" | "ignored" | "review_required" | "unmatched" {
  if (value === "accepted" || value === "ignored" || value === "unmatched") {
    return value;
  }
  return "review_required";
}

export function projectPaymentReconciliationRow(
  event: Doc<"bookingPaymentEvents">,
  booking: Doc<"bookings"> | null
) {
  const state = booking ? projectBookingPaymentState(booking) : null;
  const bookingProjection =
    booking && state
      ? {
          ...state,
          id: booking._id,
          reconciliationStatus: booking.reconciliationStatus ?? "clear",
          status: booking.status,
        }
      : null;
  const eventOutcome = normalizedOutcome(event.outcome);
  return {
    amount: event.amount ?? null,
    booking: bookingProjection,
    createdAt: event.createdAt,
    currency: event.currency ?? null,
    eventType: event.eventType ?? event.transition,
    id: event._id,
    needsReview:
      eventOutcome === "review_required" ||
      eventOutcome === "unmatched" ||
      bookingProjection?.reconciliationStatus === "review_required",
    orderId: event.orderId ?? null,
    outcome: eventOutcome,
    paymentId: event.paymentId ?? null,
    providerEventId: event.providerEventId,
    providerStatus: event.providerStatus ?? null,
    reason: event.reason,
    reconciliationReason: event.reconciliationReason ?? null,
    refundId: event.refundId ?? null,
    source: event.source ?? "webhook",
    statusAfter: event.statusAfter ?? null,
    statusBefore: event.statusBefore ?? null,
    transition: event.transition,
  };
}

async function projectRows(
  ctx: Parameters<typeof requireStaff>[0],
  events: Doc<"bookingPaymentEvents">[]
) {
  const bookings = await Promise.all(
    events.map((event) => (event.bookingId ? ctx.db.get("bookings", event.bookingId) : null))
  );
  return events.map((event, index) =>
    projectPaymentReconciliationRow(event, bookings[index] ?? null)
  );
}

export const listInbox = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
    const page = await ctx.db
      .query("bookingPaymentEvents")
      .order("desc")
      .filter((q) =>
        q.or(q.eq(q.field("outcome"), "review_required"), q.eq(q.field("outcome"), "unmatched"))
      )
      .paginate(boundedPaginationOptions(args.paginationOpts));
    return {
      ...page,
      page: await projectRows(ctx, page.page),
    };
  },
  returns: paginationResultValidator(rowValidator),
});

export const getTimeline = query({
  args: { bookingId: v.id("bookings"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
    const page = await ctx.db
      .query("bookingPaymentEvents")
      .withIndex("by_bookingId_createdAt", (q) => q.eq("bookingId", args.bookingId))
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    return {
      ...page,
      page: await projectRows(ctx, page.page),
    };
  },
  returns: paginationResultValidator(rowValidator),
});
