import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const VALID_CURRENCIES = new Set(["INR", "USD"]);

const getIdentity = async (ctx: QueryCtx | MutationCtx) => {
  return await ctx.auth.getUserIdentity();
};

const getIdentityOrThrow = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await getIdentity(ctx);
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
};

const resolveTrip = async (
  ctx: QueryCtx | MutationCtx,
  tripIdentifier: string,
): Promise<Doc<"trips"> | null> => {
  const normalizedTripId = ctx.db.normalizeId("trips", tripIdentifier);
  if (normalizedTripId) {
    const trip = await ctx.db.get(normalizedTripId);
    if (trip) {
      return trip;
    }
  }

  const byLegacyId = await ctx.db
    .query("trips")
    .withIndex("by_legacyTripId", (q) => q.eq("legacyTripId", tripIdentifier))
    .unique();
  if (byLegacyId) {
    return byLegacyId;
  }

  return await ctx.db
    .query("trips")
    .withIndex("by_slug", (q) => q.eq("slug", tripIdentifier))
    .unique();
};

const toApiTrip = (trip: Doc<"trips">) => ({
  id: trip._id,
  name: trip.name,
  slug: trip.slug,
  description: trip.description ?? "",
  startDate: trip.startDate,
  endDate: trip.endDate,
  totalSeats: trip.totalSeats,
  availableSeats: trip.availableSeats,
  priceInr: trip.priceInr,
  priceUsd: trip.priceUsd,
  difficulty: trip.difficulty ?? "",
  coverImage: trip.coverImage ?? "",
  gallery: trip.gallery ?? [],
  isActive: trip.isActive,
  createdAt: new Date(trip.createdAt).toISOString(),
  updatedAt: new Date(trip.updatedAt).toISOString(),
});

const toApiBooking = (booking: Doc<"bookings">) => ({
  id: booking._id,
  userId: booking.userId,
  tripId: booking.tripId,
  status: booking.status,
  razorpayOrderId: booking.razorpayOrderId,
  razorpayPaymentId: booking.razorpayPaymentId,
  razorpaySignature: booking.razorpaySignature ?? null,
  totalAmount: booking.totalAmount,
  currency: booking.currency,
  travelers: booking.travelers,
  travelerDetails: booking.travelerDetails ?? null,
  notes: booking.notes ?? null,
  confirmedAt: booking.confirmedAt
    ? new Date(booking.confirmedAt).toISOString()
    : null,
  createdAt: new Date(booking.createdAt).toISOString(),
  updatedAt: new Date(booking.updatedAt).toISOString(),
});

const getUserProfile = async (ctx: QueryCtx | MutationCtx, authUserId: string) => {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
};

const ensureValidCheckoutArgs = (travelers: number, currency: string) => {
  if (travelers < 1 || travelers > 10) {
    throw new ConvexError("Traveler count must be between 1 and 10");
  }
  if (!VALID_CURRENCIES.has(currency)) {
    throw new ConvexError("Unsupported currency");
  }
};

const getBookingByOrderId = async (ctx: QueryCtx | MutationCtx, orderId: string) => {
  const rows = await ctx.db
    .query("bookings")
    .withIndex("by_razorpayOrderId", (q) => q.eq("razorpayOrderId", orderId))
    .take(1);
  return rows[0] ?? null;
};

const getBookingByPaymentId = async (ctx: QueryCtx | MutationCtx, paymentId: string) => {
  const rows = await ctx.db
    .query("bookings")
    .withIndex("by_razorpayPaymentId", (q) =>
      q.eq("razorpayPaymentId", paymentId),
    )
    .take(1);
  return rows[0] ?? null;
};

export const prepareCheckout = query({
  args: {
    tripIdentifier: v.string(),
    travelers: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    ensureValidCheckoutArgs(args.travelers, args.currency);

    const trip = await resolveTrip(ctx, args.tripIdentifier);
    if (!trip || !trip.isActive) {
      throw new ConvexError("Trip not found or inactive");
    }
    if (trip.availableSeats < args.travelers) {
      throw new ConvexError(`Only ${trip.availableSeats} seats available`);
    }

    const profile = await getUserProfile(ctx, identity.subject);
    const pricePerPerson =
      args.currency === "INR" ? trip.priceInr : trip.priceUsd;

    return {
      user: {
        id: identity.subject,
        email: profile?.email ?? identity.email ?? "",
        name: profile?.name ?? identity.name ?? "Traveler",
        phoneNumber: profile?.phoneNumber ?? "",
      },
      trip: toApiTrip(trip),
      travelers: args.travelers,
      currency: args.currency,
      pricePerPerson,
      totalAmount: pricePerPerson * args.travelers,
    };
  },
});

export const createPendingBooking = mutation({
  args: {
    tripIdentifier: v.string(),
    travelers: v.number(),
    currency: v.string(),
    razorpayOrderId: v.string(),
    travelerDetails: v.optional(v.any()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    ensureValidCheckoutArgs(args.travelers, args.currency);

    const trip = await resolveTrip(ctx, args.tripIdentifier);
    if (!trip || !trip.isActive) {
      throw new ConvexError("Trip not found or inactive");
    }
    if (trip.availableSeats < args.travelers) {
      throw new ConvexError(`Only ${trip.availableSeats} seats available`);
    }

    const pricePerPerson =
      args.currency === "INR" ? trip.priceInr : trip.priceUsd;
    const totalAmount = pricePerPerson * args.travelers;
    const timestamp = Date.now();

    const bookingId = await ctx.db.insert("bookings", {
      userId: identity.subject,
      tripId: trip._id,
      status: "pending",
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: "",
      totalAmount,
      currency: args.currency,
      travelers: args.travelers,
      travelerDetails: args.travelerDetails ?? null,
      notes: args.notes ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      booking: {
        id: bookingId,
        status: "pending",
      },
      totalAmount,
      currency: args.currency,
      trip: toApiTrip(trip),
    };
  },
});

export const getMyBookings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) {
      return [];
    }

    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    const result = [];
    for (const booking of rows) {
      const trip = await ctx.db.get(booking.tripId);
      if (!trip) {
        continue;
      }
      result.push({
        booking: toApiBooking(booking),
        trip: toApiTrip(trip),
      });
    }

    return result;
  },
});

export const markBookingFailedById = mutation({
  args: {
    bookingId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedBookingId = ctx.db.normalizeId("bookings", args.bookingId);
    if (!normalizedBookingId) {
      return null;
    }

    const booking = await ctx.db.get(normalizedBookingId);
    if (!booking) {
      return null;
    }

    await ctx.db.patch(normalizedBookingId, {
      status: "failed",
      updatedAt: Date.now(),
    });

    return {
      id: normalizedBookingId,
      status: "failed",
    };
  },
});

export const confirmBookingByOrderId = mutation({
  args: {
    orderId: v.string(),
    paymentId: v.string(),
    signature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await getBookingByOrderId(ctx, args.orderId);
    if (!booking) {
      return {
        success: false,
        message: "Booking not found for this order",
      };
    }

    if (booking.status === "confirmed") {
      return {
        success: true,
        alreadyConfirmed: true,
        booking: toApiBooking(booking),
      };
    }

    const trip = await ctx.db.get(booking.tripId);
    if (!trip) {
      throw new ConvexError("Trip not found for booking");
    }
    if (trip.availableSeats < booking.travelers) {
      throw new ConvexError("No seats available for confirmation");
    }

    const timestamp = Date.now();
    await ctx.db.patch(booking._id, {
      status: "confirmed",
      razorpayPaymentId: args.paymentId,
      razorpaySignature: args.signature,
      confirmedAt: timestamp,
      updatedAt: timestamp,
    });

    await ctx.db.patch(trip._id, {
      availableSeats: trip.availableSeats - booking.travelers,
      updatedAt: timestamp,
    });

    const updated = await ctx.db.get(booking._id);
    return {
      success: true,
      alreadyConfirmed: false,
      booking: updated ? toApiBooking(updated) : null,
    };
  },
});

export const recordPaymentAuthorized = mutation({
  args: {
    orderId: v.string(),
    paymentId: v.string(),
  },
  handler: async (ctx, args) => {
    const booking = await getBookingByOrderId(ctx, args.orderId);
    if (!booking) {
      return null;
    }

    await ctx.db.patch(booking._id, {
      razorpayPaymentId: args.paymentId,
      updatedAt: Date.now(),
    });

    return { id: booking._id };
  },
});

export const markPaymentFailedByOrderId = mutation({
  args: {
    orderId: v.string(),
    paymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await getBookingByOrderId(ctx, args.orderId);
    if (!booking) {
      return null;
    }

    await ctx.db.patch(booking._id, {
      status: "failed",
      razorpayPaymentId: args.paymentId ?? booking.razorpayPaymentId,
      updatedAt: Date.now(),
    });

    return { id: booking._id };
  },
});

export const markRefundedByPaymentId = mutation({
  args: {
    paymentId: v.string(),
  },
  handler: async (ctx, args) => {
    const booking = await getBookingByPaymentId(ctx, args.paymentId);
    if (!booking) {
      return null;
    }

    await ctx.db.patch(booking._id, {
      status: "refunded",
      updatedAt: Date.now(),
    });

    return { id: booking._id };
  },
});
