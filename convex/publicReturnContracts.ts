import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";

export const publicUserProfileValidator = v.object({
  createdAt: v.union(v.string(), v.null()),
  email: v.string(),
  id: v.string(),
  image: v.union(v.string(), v.null()),
  name: v.string(),
  passportDetailsEncrypted: v.union(v.string(), v.null()),
  phoneNumber: v.string(),
  updatedAt: v.union(v.string(), v.null()),
});
export const nullablePublicUserProfileValidator = v.union(publicUserProfileValidator, v.null());

export const authSyncResultValidator = v.object({
  linkedStaff: v.boolean(),
  profileId: v.union(v.id("userProfiles"), v.null()),
});
export const authRepairResultValidator = v.object({
  duplicatesRemoved: v.number(),
  profilesRelinked: v.number(),
  profileTotal: v.number(),
  staffRelinked: v.number(),
  staffTotal: v.number(),
});

export const aiRateLimitResultValidator = v.object({
  allowed: v.boolean(),
  remaining: v.number(),
  retryAfterSec: v.number(),
});
export const aiTelemetryIdResultValidator = v.id("aiTelemetry");

// Trip content predates the typed public contract and remains schemaless in
// storage. The outer trip shape is exact while these four legacy fields stay
// readable until their separate data migration narrows the schema.
const legacyTripContentValidator = v.any();
export const publicTripValidator = v.object({
  availableSeats: v.number(),
  coverImage: v.string(),
  createdAt: v.string(),
  description: v.string(),
  difficulty: v.string(),
  endDate: v.string(),
  exclusions: legacyTripContentValidator,
  gallery: legacyTripContentValidator,
  id: v.id("trips"),
  inclusions: legacyTripContentValidator,
  isActive: v.boolean(),
  itinerary: legacyTripContentValidator,
  legacyTripId: v.union(v.string(), v.null()),
  name: v.string(),
  priceInr: v.number(),
  priceUsd: v.number(),
  slug: v.string(),
  startDate: v.string(),
  totalSeats: v.number(),
  updatedAt: v.string(),
});
export const publicTripListValidator = v.array(publicTripValidator);
export const nullablePublicTripValidator = v.union(publicTripValidator, v.null());

const bookingStatusValidator = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("refunded")
);
export const bookingTripValidator = v.object({
  availableSeats: v.number(),
  coverImage: v.string(),
  createdAt: v.string(),
  description: v.string(),
  difficulty: v.string(),
  endDate: v.string(),
  gallery: legacyTripContentValidator,
  id: v.id("trips"),
  isActive: v.boolean(),
  name: v.string(),
  priceInr: v.number(),
  priceUsd: v.number(),
  slug: v.string(),
  startDate: v.string(),
  totalSeats: v.number(),
  updatedAt: v.string(),
});
export const bookingOutputValidator = v.object({
  confirmedAt: v.union(v.string(), v.null()),
  createdAt: v.string(),
  currency: v.string(),
  id: v.id("bookings"),
  notes: v.union(v.string(), v.null()),
  razorpayOrderId: v.string(),
  razorpayPaymentId: v.string(),
  razorpaySignature: v.union(v.string(), v.null()),
  status: bookingStatusValidator,
  totalAmount: v.number(),
  travelerDetails: v.any(),
  travelers: v.number(),
  tripId: v.id("trips"),
  updatedAt: v.string(),
  userId: v.string(),
});
export const checkoutResultValidator = v.object({
  currency: v.string(),
  pricePerPerson: v.number(),
  totalAmount: v.number(),
  travelers: v.number(),
  trip: bookingTripValidator,
  user: v.object({
    email: v.string(),
    id: v.string(),
    name: v.string(),
    phoneNumber: v.string(),
  }),
});
export const pendingBookingResultValidator = v.object({
  booking: v.object({ id: v.id("bookings"), status: v.literal("pending") }),
  currency: v.string(),
  totalAmount: v.number(),
  trip: bookingTripValidator,
});
export const myBookingsResultValidator = v.array(
  v.object({ booking: bookingOutputValidator, trip: bookingTripValidator })
);
export const bookingTransitionResultValidator = v.object({
  alreadyConfirmed: v.optional(v.boolean()),
  booking: v.optional(v.union(bookingOutputValidator, v.null())),
  duplicateEvent: v.optional(v.boolean()),
  id: v.optional(v.id("bookings")),
  ignored: v.optional(v.boolean()),
  message: v.optional(v.string()),
  status: v.optional(bookingStatusValidator),
  success: v.optional(v.boolean()),
});

const migrationSummaryValidator = v.object({
  imported: v.number(),
  skipped: v.optional(v.number()),
  total: v.number(),
  updated: v.number(),
});
export const migrationImportSummaryValidator = migrationSummaryValidator;
export const travelBatchAuditResultValidator = paginationResultValidator(
  v.object({
    derivedCount: v.number(),
    id: v.id("jobCards"),
    jobCode: v.string(),
    storedCount: v.union(v.number(), v.null()),
    variants: v.array(v.string()),
  })
);
export const travelBatchMigrationResultValidator = v.object({
  migrated: v.number(),
  skipped: v.number(),
  total: v.number(),
});
export const migrationStatsResultValidator = v.object({
  bookingsByStatus: v.record(v.string(), v.number()),
  counts: v.object({
    bookings: v.number(),
    trips: v.number(),
    users: v.number(),
  }),
  seatTotals: v.array(
    v.object({
      availableSeats: v.number(),
      id: v.id("trips"),
      legacyTripId: v.union(v.string(), v.null()),
      slug: v.string(),
      totalSeats: v.number(),
    })
  ),
});
