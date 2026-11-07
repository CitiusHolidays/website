import { type Infer, v } from "convex/values";

/**
 * The immutable GST tax-invoice document. Every supplier fact is copied from the
 * configuration in force at issue time, so a later configuration change never
 * rewrites an issued invoice.
 */
export const bookingInvoiceSnapshotValidator = v.object({
  amounts: v.object({
    cgstPaise: v.number(),
    igstPaise: v.number(),
    sgstPaise: v.number(),
    taxablePaise: v.number(),
    totalPaise: v.number(),
  }),
  booking: v.object({
    endDate: v.string(),
    paymentReference: v.string(),
    reference: v.string(),
    startDate: v.string(),
    tripName: v.string(),
  }),
  currency: v.literal("INR"),
  financialYear: v.string(),
  gstRateBasisPoints: v.number(),
  invoiceDate: v.string(),
  invoiceNumber: v.string(),
  issuedAt: v.number(),
  line: v.object({
    description: v.string(),
    quantity: v.number(),
    sac: v.string(),
  }),
  placeOfSupply: v.object({
    basis: v.union(v.literal("recipient_address"), v.literal("supplier_location")),
    stateCode: v.string(),
    stateName: v.string(),
  }),
  recipient: v.object({
    email: v.string(),
    name: v.string(),
  }),
  reverseCharge: v.boolean(),
  supplier: v.object({
    addressLines: v.array(v.string()),
    gstin: v.string(),
    legalName: v.string(),
    stateCode: v.string(),
    stateName: v.string(),
  }),
});

export type BookingInvoiceSnapshot = Infer<typeof bookingInvoiceSnapshotValidator>;

export const bookingInvoiceStatusValidator = v.union(
  v.literal("issued"),
  v.literal("pending_configuration"),
  v.literal("manual_review")
);

export const bookingInvoiceFields = {
  bookingId: v.id("bookings"),
  createdAt: v.number(),
  invoiceNumber: v.optional(v.string()),
  issuedAt: v.optional(v.number()),
  /** Configuration key names only; values never enter this record. */
  missingConfiguration: v.optional(v.array(v.string())),
  paymentId: v.string(),
  pendingReason: v.optional(
    v.union(
      v.literal("amount_not_invoiceable"),
      v.literal("booking_not_confirmed"),
      v.literal("company_details_not_configured"),
      v.literal("foreign_currency")
    )
  ),
  snapshot: v.optional(bookingInvoiceSnapshotValidator),
  status: bookingInvoiceStatusValidator,
  updatedAt: v.number(),
};

/** What the Customer Travel Account may know about a booking's invoice. */
export const customerBookingInvoiceSummaryValidator = v.union(
  v.object({
    downloadPath: v.string(),
    invoiceNumber: v.string(),
    issuedAt: v.string(),
    status: v.literal("issued"),
  }),
  v.object({ status: v.literal("preparing") })
);
