import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { queueBookingEmail } from "./bookingEmails";
import { ensureBookingInvoice } from "./bookingInvoices";

/**
 * Customer-facing work that follows an accepted payment transition: the GST tax
 * invoice and the confirmation or refund email.
 *
 * It runs as its own scheduled mutation so that nothing here—invoice-series
 * contention, configuration, or an outbox conflict—can fail or roll back a real
 * payment transition. The payment mutation schedules it only on the accepted
 * transition, Convex runs a scheduled mutation exactly once, and every step is
 * idempotent per booking, so retries and replays never add a second invoice or email.
 */

type FollowUp = "confirmed" | "refunded";

const followUpRef = makeFunctionReference<
  "mutation",
  { bookingId: Id<"bookings">; transition: FollowUp },
  null
>("bookingPaymentFollowUps:afterBookingPaymentTransition");

export async function scheduleBookingPaymentFollowUp(
  ctx: MutationCtx,
  bookingId: Id<"bookings">,
  transition: FollowUp
) {
  await ctx.scheduler.runAfter(0, followUpRef, { bookingId, transition });
}

export const afterBookingPaymentTransition = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    transition: v.union(v.literal("confirmed"), v.literal("refunded")),
  },
  handler: async (ctx, { bookingId, transition }) => {
    const booking = await ctx.db.get("bookings", bookingId);
    if (!booking) {
      return null;
    }
    if (transition === "confirmed" && booking.status === "confirmed") {
      await ensureBookingInvoice(ctx, booking);
      await queueBookingEmail(ctx, "booking_confirmation", booking);
    }
    if (transition === "refunded" && booking.status === "refunded") {
      await queueBookingEmail(ctx, "booking_refund", booking);
    }
    return null;
  },
  returns: v.null(),
});
