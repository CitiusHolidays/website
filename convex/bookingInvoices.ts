import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { bookingOwnerProfile, queueBookingEmail } from "./bookingEmails";
import {
  type BookingInvoiceIssuer,
  bookingInvoiceNumber,
  gstSplitFromInclusiveTotal,
  indianFinancialYear,
  invoiceDateInIndia,
  placeOfSupply,
  readBookingInvoiceIssuer,
} from "./lib/bookingInvoicePolicy";
import {
  type BookingInvoiceSnapshot,
  bookingInvoiceSnapshotValidator,
} from "./lib/bookingInvoiceValidators";
import {
  authorizedCustomerIdentityIds,
  findBookingEntitlement,
} from "./lib/customerIdentityAccess";

/**
 * GST tax invoices for confirmed public website Bookings.
 *
 * - One invoice per confirmed booking payment, created by the follow-up the
 *   confirmation schedules (`bookingPaymentFollowUps`). Replays return the
 *   existing invoice.
 * - Numbers are consecutive per series prefix and Indian financial year. The
 *   series row is read and written in the same serializable transaction that
 *   issues the invoice, so concurrent confirmations cannot share or skip a number.
 * - Missing or invalid company configuration fails closed: the invoice is
 *   recorded as `pending_configuration` and issued later by
 *   `issuePendingBookingInvoices` once the configuration is supplied.
 */

export type BookingInvoiceOutcome =
  | { invoiceNumber: string; status: "issued" }
  | { missingConfiguration: string[]; status: "pending_configuration" }
  | { status: "manual_review" };

const PENDING_BATCH_LIMIT = 50;

type EnvSource = Partial<Record<string, string | undefined>>;

async function invoiceRow(ctx: QueryCtx | MutationCtx, bookingId: Id<"bookings">) {
  return await ctx.db
    .query("bookingInvoices")
    .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
    .first();
}

async function claimNextSequence(ctx: MutationCtx, prefix: string, financialYear: string) {
  const series = await ctx.db
    .query("bookingInvoiceSeries")
    .withIndex("by_prefix_financialYear", (q) =>
      q.eq("prefix", prefix).eq("financialYear", financialYear)
    )
    .unique();
  const now = Date.now();
  if (!series) {
    await ctx.db.insert("bookingInvoiceSeries", {
      financialYear,
      lastSequence: 1,
      prefix,
      updatedAt: now,
    });
    return 1;
  }
  const sequence = series.lastSequence + 1;
  await ctx.db.patch("bookingInvoiceSeries", series._id, {
    lastSequence: sequence,
    updatedAt: now,
  });
  return sequence;
}

async function buildSnapshot(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  issuer: BookingInvoiceIssuer,
  issuedAt: number
): Promise<BookingInvoiceSnapshot> {
  const [trip, profile] = await Promise.all([
    ctx.db.get("trips", booking.tripId),
    bookingOwnerProfile(ctx, booking),
  ]);
  // The booking flow records no customer billing address, so the supplier's
  // location is the place of supply until a recipient state is captured.
  const supply = placeOfSupply({ supplierStateCode: issuer.stateCode });
  const amounts = gstSplitFromInclusiveTotal({
    intraState: supply.intraState,
    rateBasisPoints: issuer.gstRateBasisPoints,
    totalPaise: booking.totalAmount,
  });
  const financialYear = indianFinancialYear(issuedAt);
  const sequence = await claimNextSequence(ctx, issuer.seriesPrefix, financialYear.label);
  const invoiceNumber = bookingInvoiceNumber(issuer.seriesPrefix, financialYear.short, sequence);
  const tripName = trip?.name.trim() || "Tour package";
  const startDate = trip?.startDate ?? "";
  const endDate = trip?.endDate ?? "";
  const dates = [startDate, endDate].filter(Boolean).join(" to ");
  return {
    amounts,
    booking: {
      endDate,
      paidDate: invoiceDateInIndia(booking.confirmedAt ?? issuedAt),
      paymentReference: booking.razorpayPaymentId,
      reference: booking._id,
      startDate,
      tripName,
    },
    currency: "INR",
    financialYear: financialYear.label,
    gstRateBasisPoints: issuer.gstRateBasisPoints,
    invoiceDate: invoiceDateInIndia(issuedAt),
    invoiceNumber,
    issuedAt,
    line: {
      description: dates ? `Tour package: ${tripName} (${dates})` : `Tour package: ${tripName}`,
      quantity: booking.travelers,
      sac: issuer.sac,
    },
    placeOfSupply: {
      basis: supply.basis,
      stateCode: supply.stateCode,
      stateName: supply.stateName,
    },
    recipient: {
      email: profile?.email.trim() ?? "",
      name: profile?.name.trim() || "Customer",
    },
    reverseCharge: false,
    supplier: {
      addressLines: issuer.addressLines,
      gstin: issuer.gstin,
      legalName: issuer.legalName,
      stateCode: issuer.stateCode,
      stateName: issuer.stateName,
    },
  };
}

async function recordNotIssued(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  existing: Doc<"bookingInvoices"> | null,
  value: Pick<Doc<"bookingInvoices">, "missingConfiguration" | "pendingReason" | "status">
) {
  const now = Date.now();
  if (existing) {
    await ctx.db.patch("bookingInvoices", existing._id, { ...value, updatedAt: now });
    return;
  }
  await ctx.db.insert("bookingInvoices", {
    ...value,
    bookingId: booking._id,
    createdAt: now,
    paymentId: booking.razorpayPaymentId,
    updatedAt: now,
  });
}

/**
 * Issue the tax invoice for a confirmed booking, or record why it cannot be
 * issued yet. Idempotent: an issued invoice is returned unchanged.
 */
export async function ensureBookingInvoice(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  env: EnvSource = process.env
): Promise<BookingInvoiceOutcome> {
  if (booking.status !== "confirmed") {
    throw new ConvexError("BOOKING_INVOICE_REQUIRES_CONFIRMED_BOOKING");
  }
  const existing = await invoiceRow(ctx, booking._id);
  if (existing?.status === "issued" && existing.invoiceNumber) {
    return { invoiceNumber: existing.invoiceNumber, status: "issued" };
  }
  if (booking.currency !== "INR") {
    await recordNotIssued(ctx, booking, existing, {
      missingConfiguration: undefined,
      pendingReason: "foreign_currency",
      status: "manual_review",
    });
    return { status: "manual_review" };
  }
  if (!(Number.isSafeInteger(booking.totalAmount) && booking.totalAmount > 0)) {
    await recordNotIssued(ctx, booking, existing, {
      missingConfiguration: undefined,
      pendingReason: "amount_not_invoiceable",
      status: "manual_review",
    });
    return { status: "manual_review" };
  }
  const config = readBookingInvoiceIssuer(env);
  if (!config.ok) {
    const missingConfiguration = [...config.missing, ...config.invalid];
    await recordNotIssued(ctx, booking, existing, {
      missingConfiguration,
      pendingReason: "company_details_not_configured",
      status: "pending_configuration",
    });
    return { missingConfiguration, status: "pending_configuration" };
  }
  const issuedAt = Date.now();
  const snapshot = await buildSnapshot(ctx, booking, config.issuer, issuedAt);
  const issued = {
    invoiceNumber: snapshot.invoiceNumber,
    issuedAt,
    missingConfiguration: undefined,
    pendingReason: undefined,
    snapshot,
    status: "issued" as const,
    updatedAt: issuedAt,
  };
  if (existing) {
    await ctx.db.patch("bookingInvoices", existing._id, issued);
  } else {
    await ctx.db.insert("bookingInvoices", {
      ...issued,
      bookingId: booking._id,
      createdAt: issuedAt,
      paymentId: booking.razorpayPaymentId,
    });
  }
  return { invoiceNumber: snapshot.invoiceNumber, status: "issued" };
}

/**
 * Operator entrypoint, run after the invoice configuration is supplied: issue
 * every invoice still waiting for it (oldest first, bounded per call) and queue
 * one "invoice ready" email for each. Safe to repeat.
 */
export const issuePendingBookingInvoices = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(PENDING_BATCH_LIMIT, Math.max(1, Math.trunc(args.limit ?? 25)));
    const pending = await ctx.db
      .query("bookingInvoices")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "pending_configuration"))
      .take(limit);
    let issued = 0;
    let stillPending = 0;
    let missingConfiguration: string[] = [];
    for (const row of pending) {
      // Sequential on purpose: each issue reads and increments the series counter, so
      // concurrent issues inside one transaction would claim the same serial.
      // biome-ignore lint/performance/noAwaitInLoops: consecutive invoice numbering requires serial issue.
      const booking = await ctx.db.get("bookings", row.bookingId);
      if (booking?.status !== "confirmed") {
        await ctx.db.patch("bookingInvoices", row._id, {
          missingConfiguration: undefined,
          pendingReason: "booking_not_confirmed",
          status: "manual_review",
          updatedAt: Date.now(),
        });
        continue;
      }
      const outcome = await ensureBookingInvoice(ctx, booking);
      if (outcome.status === "issued") {
        issued += 1;
        await queueBookingEmail(ctx, "booking_invoice_ready", booking);
      } else if (outcome.status === "pending_configuration") {
        stillPending += 1;
        ({ missingConfiguration } = outcome);
      }
    }
    return { issued, missingConfiguration, scanned: pending.length, stillPending };
  },
  returns: v.object({
    issued: v.number(),
    missingConfiguration: v.array(v.string()),
    scanned: v.number(),
    stillPending: v.number(),
  }),
});

/** The account download path for a booking's invoice. */
export function bookingInvoiceDownloadPath(bookingId: Id<"bookings">) {
  return `/api/account/journeys/${encodeURIComponent(bookingId)}/invoice`;
}

/** The invoice facts a Customer Travel Account journey may show. */
export async function customerInvoiceSummary(ctx: QueryCtx, booking: Doc<"bookings">) {
  if (!["confirmed", "refunded"].includes(booking.status)) {
    return;
  }
  const row = await invoiceRow(ctx, booking._id);
  if (row?.status === "issued" && row.invoiceNumber && row.issuedAt) {
    return {
      downloadPath: bookingInvoiceDownloadPath(booking._id),
      invoiceNumber: row.invoiceNumber,
      issuedAt: new Date(row.issuedAt).toISOString(),
      status: "issued" as const,
    };
  }
  // Promise an invoice only when one is genuinely on its way. Manual-review cases
  // and bookings confirmed before invoicing existed show no invoice line.
  return row?.status === "pending_configuration" ? { status: "preparing" as const } : undefined;
}

/**
 * The issued invoice document for the signed-in purchaser of a booking. Any other
 * caller—signed out, another account, or a non-purchaser—receives null.
 */
export const getMyBookingInvoice = query({
  args: { bookingId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const bookingId = ctx.db.normalizeId("bookings", args.bookingId);
    if (!(identity && bookingId)) {
      return null;
    }
    const booking = await ctx.db.get("bookings", bookingId);
    if (!booking) {
      return null;
    }
    const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
    const entitlement = await findBookingEntitlement(ctx, identityIds, booking);
    if (entitlement?.role !== "purchaser") {
      return null;
    }
    const row = await invoiceRow(ctx, booking._id);
    if (row?.status === "issued" && row.snapshot) {
      return { invoice: row.snapshot, status: "issued" as const };
    }
    return { status: "preparing" as const };
  },
  returns: v.union(
    v.object({ invoice: bookingInvoiceSnapshotValidator, status: v.literal("issued") }),
    v.object({ status: v.literal("preparing") }),
    v.null()
  ),
});
