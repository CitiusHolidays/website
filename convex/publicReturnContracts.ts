import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";

export const publicUserProfileValidator = v.object({
  createdAt: v.union(v.string(), v.null()),
  email: v.string(),
  hasPassportDetails: v.boolean(),
  id: v.string(),
  image: v.union(v.string(), v.null()),
  name: v.string(),
  phoneNumber: v.string(),
  updatedAt: v.union(v.string(), v.null()),
});
export const nullablePublicUserProfileValidator = v.union(publicUserProfileValidator, v.null());

export const authSyncResultValidator = v.object({
  linkedStaff: v.boolean(),
  profileId: v.union(v.id("userProfiles"), v.null()),
});
export const authRepairResultValidator = v.object({
  continueCursor: v.string(),
  counts: v.object({
    ambiguous: v.number(),
    inspected: v.number(),
    linked: v.number(),
    missing: v.number(),
    repairable: v.number(),
    repaired: v.number(),
    skipped: v.number(),
  }),
  isDone: v.boolean(),
  mode: v.union(v.literal("inventory"), v.literal("repair")),
  review: v.array(
    v.object({
      email: v.string(),
      reason: v.string(),
      staffId: v.id("staffUsers"),
      status: v.union(v.literal("ambiguous"), v.literal("missing"), v.literal("skipped")),
    })
  ),
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
export const customerBookingOutputValidator = v.object({
  confirmedAt: v.union(v.string(), v.null()),
  createdAt: v.string(),
  currency: v.string(),
  id: v.id("bookings"),
  status: bookingStatusValidator,
  totalAmount: v.number(),
  travelers: v.number(),
  tripId: v.id("trips"),
  updatedAt: v.string(),
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
  v.object({ booking: customerBookingOutputValidator, trip: bookingTripValidator })
);
const customerJourneyItineraryValidator = v.object({
  accommodation: v.string(),
  day: v.string(),
  desc: v.string(),
  key: v.string(),
  location: v.string(),
  meals: v.string(),
  title: v.string(),
});
const customerJourneyImageValidator = v.object({ alt: v.string(), src: v.string() });
const customerJourneySummaryTripValidator = v.object({
  coverImage: v.string(),
  endDate: v.string(),
  gallery: v.array(customerJourneyImageValidator),
  itinerary: v.array(customerJourneyItineraryValidator),
  name: v.string(),
  slug: v.string(),
  startDate: v.string(),
});
const customerJourneyCategoryValidator = v.union(
  v.literal("cancelled"),
  v.literal("past"),
  v.literal("upcoming")
);
export const customerJourneySummaryValidator = v.object({
  booking: customerBookingOutputValidator,
  category: customerJourneyCategoryValidator,
  detailAvailable: v.boolean(),
  trip: customerJourneySummaryTripValidator,
});
export const customerJourneySummariesResultValidator = v.object({
  referenceNow: v.number(),
  summaries: v.array(customerJourneySummaryValidator),
});
export const customerJourneyDetailResultValidator = v.union(
  v.object({
    booking: customerBookingOutputValidator,
    category: customerJourneyCategoryValidator,
    detailAvailable: v.boolean(),
    trip: v.object({
      coverImage: v.string(),
      description: v.string(),
      endDate: v.string(),
      exclusions: v.array(v.string()),
      gallery: v.array(customerJourneyImageValidator),
      inclusions: v.array(v.string()),
      itinerary: v.array(customerJourneyItineraryValidator),
      name: v.string(),
      slug: v.string(),
      startDate: v.string(),
    }),
  }),
  v.null()
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
