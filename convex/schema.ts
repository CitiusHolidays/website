import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const bookingStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("refunded"),
);

export default defineSchema({
  userProfiles: defineTable({
    authUserId: v.string(),
    email: v.string(),
    name: v.string(),
    phoneNumber: v.optional(v.string()),
    passportDetailsEncrypted: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    legacyUserId: v.optional(v.string()),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"]),

  trips: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    totalSeats: v.number(),
    availableSeats: v.number(),
    priceInr: v.number(),
    priceUsd: v.number(),
    difficulty: v.optional(v.string()),
    itinerary: v.optional(v.any()),
    inclusions: v.optional(v.any()),
    exclusions: v.optional(v.any()),
    coverImage: v.optional(v.string()),
    gallery: v.optional(v.any()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    legacyTripId: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_legacyTripId", ["legacyTripId"])
    .index("by_isActive_startDate", ["isActive", "startDate"]),

  bookings: defineTable({
    userId: v.string(),
    tripId: v.id("trips"),
    status: bookingStatus,
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.optional(v.string()),
    totalAmount: v.number(),
    currency: v.string(),
    travelers: v.number(),
    travelerDetails: v.optional(v.any()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    confirmedAt: v.optional(v.number()),
    legacyBookingId: v.optional(v.string()),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_razorpayOrderId", ["razorpayOrderId"])
    .index("by_razorpayPaymentId", ["razorpayPaymentId"])
    .index("by_legacyBookingId", ["legacyBookingId"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_tripId", ["tripId"]),
});
