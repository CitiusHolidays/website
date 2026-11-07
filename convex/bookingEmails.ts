import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  enqueueNotificationEmailOutbox,
  isCustomerBookingJob,
} from "./crm/notificationEmailOutbox";
import type { BookingEmailContent, BookingEmailKind } from "./lib/bookingEmailContent";

/**
 * Customer booking emails ride the durable notification outbox: one job per
 * (event, recipient), the opaque delivery ledger, Resend idempotency keys, and
 * the `email.customer_booking` Live Feature Control checked when a job is claimed.
 *
 * Each email kind has one event identity per booking, so a replayed webhook or a
 * second confirmation path can never queue a second message.
 */

export const BOOKING_EMAIL_CONTROL_KEY = "email.customer_booking" as const;
const BOOKING_EMAIL_KINDS = new Set<string>([
  "booking_confirmation",
  "booking_invoice_ready",
  "booking_refund",
]);

export function bookingEmailEventId(kind: BookingEmailKind, bookingId: Id<"bookings">) {
  return `${kind}/${bookingId}`;
}

/**
 * The purchaser's current profile: the oldest live row for their identity, as
 * auth sync chooses it. Archived or merged duplicates never supply an address.
 */
export async function bookingOwnerProfile(
  ctx: QueryCtx | MutationCtx,
  booking: Pick<Doc<"bookings">, "userId">
) {
  const profiles = await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", booking.userId))
    .take(10);
  return (
    profiles
      .filter((profile) => !(profile.archivedAt || profile.mergedIntoProfileId))
      .sort(
        (left, right) =>
          left.createdAt - right.createdAt || String(left._id).localeCompare(String(right._id))
      )[0] ?? null
  );
}

/**
 * Queue one customer email for a booking in the caller's transaction. Returns
 * no job when the purchaser has no email on record.
 */
export async function queueBookingEmail(
  ctx: MutationCtx,
  kind: BookingEmailKind,
  booking: Doc<"bookings">
) {
  const profile = await bookingOwnerProfile(ctx, booking);
  const recipient = profile?.email.trim();
  if (!recipient) {
    return [];
  }
  return await enqueueNotificationEmailOutbox(ctx, {
    body: "",
    controlKeys: [BOOKING_EMAIL_CONTROL_KEY],
    entityId: booking._id,
    entityType: "booking",
    eventId: bookingEmailEventId(kind, booking._id),
    recipientPurpose: { kind: "customer_booking" },
    recipients: [recipient],
    title: kind,
  });
}

function isBookingEmailKind(value: string): value is BookingEmailKind {
  return BOOKING_EMAIL_KINDS.has(value);
}

const contentValidator = v.object({
  booking: v.object({
    amountMinor: v.number(),
    currency: v.string(),
    endDate: v.string(),
    paymentReference: v.string(),
    reference: v.string(),
    startDate: v.string(),
    travellers: v.number(),
    tripName: v.string(),
  }),
  invoice: v.union(
    v.object({ invoiceNumber: v.string(), status: v.literal("issued") }),
    v.object({ status: v.literal("preparing") }),
    v.null()
  ),
  kind: v.union(
    v.literal("booking_confirmation"),
    v.literal("booking_invoice_ready"),
    v.literal("booking_refund")
  ),
  recipientName: v.string(),
  refund: v.union(
    v.object({ amountMinor: v.optional(v.number()), reference: v.optional(v.string()) }),
    v.null()
  ),
});

/**
 * What the email may say about the invoice. Only an invoice waiting for company
 * configuration is promised by email; a manual-review case is not.
 */
async function invoiceFact(ctx: QueryCtx, bookingId: Id<"bookings">) {
  const invoice = await ctx.db
    .query("bookingInvoices")
    .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
    .first();
  if (invoice?.status === "issued" && invoice.invoiceNumber) {
    return { invoiceNumber: invoice.invoiceNumber, status: "issued" as const };
  }
  return invoice?.status === "pending_configuration" ? { status: "preparing" as const } : null;
}

/**
 * The facts an outbox job's message is rendered from. Read once, at the first
 * delivery attempt; the rendered message is then frozen for every retry.
 */
export const getBookingEmailContent = internalQuery({
  args: { jobId: v.id("notificationEmailOutbox") },
  handler: async (ctx, { jobId }): Promise<BookingEmailContent | null> => {
    const job = await ctx.db.get("notificationEmailOutbox", jobId);
    if (!(job && isCustomerBookingJob(job) && isBookingEmailKind(job.title))) {
      return null;
    }
    const bookingId = ctx.db.normalizeId("bookings", job.entityId ?? "");
    const booking = bookingId ? await ctx.db.get("bookings", bookingId) : null;
    if (!booking) {
      return null;
    }
    const [trip, profile, invoice] = await Promise.all([
      ctx.db.get("trips", booking.tripId),
      bookingOwnerProfile(ctx, booking),
      invoiceFact(ctx, booking._id),
    ]);
    let refund: BookingEmailContent["refund"] = null;
    if (job.title === "booking_refund") {
      refund = {};
      if (booking.refundAmount !== undefined) {
        refund.amountMinor = booking.refundAmount;
      }
      if (booking.refundReference) {
        refund.reference = booking.refundReference;
      }
    }
    return {
      booking: {
        amountMinor: booking.totalAmount,
        currency: booking.currency,
        endDate: trip?.endDate ?? "",
        paymentReference: booking.razorpayPaymentId,
        reference: booking._id,
        startDate: trip?.startDate ?? "",
        travellers: booking.travelers,
        tripName: trip?.name.trim() || "your Citius trip",
      },
      invoice: job.title === "booking_refund" ? null : invoice,
      kind: job.title,
      recipientName: profile?.name.trim() || "traveller",
      refund,
    };
  },
  returns: v.union(contentValidator, v.null()),
});
