import { makeFunctionReference } from "convex/server";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { internalMutation, internalQuery } from "../../_generated/server";
import { scheduleCrmMetricSync } from "../financeMetricSync";
import { deleteEntityNotifications } from "../lib/notifications";
import {
  decodePhaseCursor,
  nextPhaseCursor,
  type RetentionDecision,
  type RetentionPlan,
  reportRetentionPage,
  retentionContinuationArgs,
  retentionReportArgs,
  retentionReportResult,
  retentionRunResult,
  runRetentionPage,
} from "../lib/retentionRun";
import {
  RETENTION_PERIODS,
  type RetentionCutoff,
  retentionCutoff,
  tripEndDate,
  tripRetentionVerdict,
} from "../lib/retentionSchedule";
import { tripEndLookup } from "../lib/retentionTrips";
import { workDateFor } from "../officeCheckInVerification";

/**
 * Bookings and invoices (director decision, 7 Nov 2026) are kept for eight years for tax. A
 * record is past the period when both its own date and its trip's end are before the cutoff.
 *
 * Website bookings are anonymised, not deleted: amounts, status, currency, traveller count,
 * the trip and the Razorpay order and payment ids stay as the payment record; the traveller
 * details, notes, payment signature and the link to the customer account go, and so do the
 * account's journey entitlements for the booking. CRM invoices hold amounts and an invoice
 * number but no personal data; one past the period is deleted with its bell rows, and the CRM
 * metrics are told. A trip without dates, a booking whose trip is gone, and an invoice whose Job
 * Card is gone keep their records. Run by
 * `jobs.retire_financial_records`, which is off until the owner switches it on.
 */
export const ANONYMISED_BOOKING_USER_ID = "retention:anonymised";
const PAGE_SIZE = 50;
const ENTITLEMENT_LIMIT = 32;
const PHASES = ["bookings", "invoices"] as const;

const continuePurgeRef = makeFunctionReference<"mutation", { asOf: number; cursor: string }>(
  "crm/retention/financialRecords:continuePurge"
);

async function anonymiseBooking(ctx: MutationCtx, booking: Doc<"bookings">) {
  const entitlements = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_bookingId_authUserId", (q) => q.eq("bookingId", booking._id))
    .take(ENTITLEMENT_LIMIT);
  await Promise.all(
    entitlements.map((entitlement) => ctx.db.delete("customerJourneyEntitlements", entitlement._id))
  );
  const now = Date.now();
  await ctx.db.patch("bookings", booking._id, {
    notes: undefined,
    razorpaySignature: undefined,
    retentionAnonymisedAt: entitlements.length < ENTITLEMENT_LIMIT ? now : undefined,
    travelerDetails: undefined,
    updatedAt: now,
    userId: ANONYMISED_BOOKING_USER_ID,
  });
}

async function decideBooking(
  ctx: QueryCtx,
  booking: Doc<"bookings">,
  cutoff: RetentionCutoff
): Promise<RetentionDecision> {
  if (booking.retentionAnonymisedAt !== undefined) {
    return { outcome: "already_anonymised_booking" };
  }
  if (workDateFor(booking.createdAt) >= cutoff.date) {
    return { outcome: "kept_booking_recent" };
  }
  const trip = await ctx.db.get("trips", booking.tripId);
  if (!trip) {
    return { outcome: "kept_booking_no_trip" };
  }
  const verdict = tripRetentionVerdict(
    tripEndDate({ travelEndDate: trip.endDate, travelStartDate: trip.startDate }),
    cutoff
  );
  if (verdict === "kept_undated") {
    return { outcome: "kept_booking_undated" };
  }
  if (verdict === "kept_trip_recent") {
    return { outcome: "kept_booking_recent" };
  }
  return {
    apply: async (writer) => await anonymiseBooking(writer, booking),
    outcome: "anonymised_booking",
  };
}

async function deleteInvoice(ctx: MutationCtx, invoice: Doc<"invoices">) {
  await deleteEntityNotifications(ctx, "invoice", String(invoice._id));
  await ctx.db.delete("invoices", invoice._id);
  await scheduleCrmMetricSync(ctx, "invoices", String(invoice._id));
}

async function plan(ctx: QueryCtx, asOf: number, cursor: string | null): Promise<RetentionPlan> {
  const cutoff = retentionCutoff(asOf, RETENTION_PERIODS.bookingRecords);
  const position = decodePhaseCursor(cursor, PHASES);
  if (position.phase === "bookings") {
    // Few rows; anonymised bookings stay, so the scan uses a cursor over the whole table.
    const page = await ctx.db
      .query("bookings")
      .paginate({ cursor: position.cursor, numItems: PAGE_SIZE });
    return {
      continueCursor: nextPhaseCursor(PHASES, position.phase, page),
      decisions: await Promise.all(page.page.map((row) => decideBooking(ctx, row, cutoff))),
    };
  }
  const trips = tripEndLookup(ctx);
  const page = await ctx.db
    .query("invoices")
    .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff.startMs))
    .paginate({ cursor: position.cursor, numItems: PAGE_SIZE });
  const decisions = await Promise.all(
    page.page.map(async (invoice): Promise<RetentionDecision> => {
      const end = await trips.forJobCard(invoice.jobCardId);
      if (end === "missing") {
        return { outcome: "kept_invoice_no_job_card" };
      }
      const verdict = tripRetentionVerdict(end, cutoff);
      if (verdict === "kept_undated") {
        return { outcome: "kept_invoice_undated" };
      }
      if (verdict === "kept_trip_recent") {
        return { outcome: "kept_invoice_trip_recent" };
      }
      return {
        apply: async (writer) => await deleteInvoice(writer, invoice),
        outcome: "deleted_invoice",
      };
    })
  );
  return { continueCursor: nextPhaseCursor(PHASES, position.phase, page), decisions };
}

const JOB = {
  continueRef: continuePurgeRef,
  controlKey: "jobs.retire_financial_records",
  planner: plan,
} as const;

/** Entrypoint dispatched by the `jobs.retire_financial_records` scheduled job. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => await runRetentionPage(ctx, JOB, Date.now(), null),
  returns: retentionRunResult,
});

/** Continues one run in a fresh transaction with the run's fixed `asOf`. */
export const continuePurge = internalMutation({
  args: retentionContinuationArgs,
  handler: async (ctx, args) => await runRetentionPage(ctx, JOB, args.asOf, args.cursor),
  returns: retentionRunResult,
});

/** Dry run: what one page of the job would do at `asOf`, as content-free counts. */
export const dryRun = internalQuery({
  args: retentionReportArgs,
  handler: async (ctx, args) =>
    await reportRetentionPage(args.secret, () => plan(ctx, args.asOf, args.cursor)),
  returns: retentionReportResult,
});
