import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { assertPaymentMutationSecret } from "./lib/paymentMutationAuth";

const VALID_CURRENCIES = new Set(["INR", "USD"]);

const getIdentity = async (ctx: QueryCtx | MutationCtx) => await ctx.auth.getUserIdentity();

const getIdentityOrThrow = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await getIdentity(ctx);
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
};

const resolveTrip = async (
  ctx: QueryCtx | MutationCtx,
  tripIdentifier: string
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
  availableSeats: trip.availableSeats,
  coverImage: trip.coverImage ?? "",
  createdAt: new Date(trip.createdAt).toISOString(),
  description: trip.description ?? "",
  difficulty: trip.difficulty ?? "",
  endDate: trip.endDate,
  gallery: trip.gallery ?? [],
  id: trip._id,
  isActive: trip.isActive,
  name: trip.name,
  priceInr: trip.priceInr,
  priceUsd: trip.priceUsd,
  slug: trip.slug,
  startDate: trip.startDate,
  totalSeats: trip.totalSeats,
  updatedAt: new Date(trip.updatedAt).toISOString(),
});

const toApiBooking = (booking: Doc<"bookings">) => ({
  confirmedAt: booking.confirmedAt ? new Date(booking.confirmedAt).toISOString() : null,
  createdAt: new Date(booking.createdAt).toISOString(),
  currency: booking.currency,
  id: booking._id,
  notes: booking.notes ?? null,
  razorpayOrderId: booking.razorpayOrderId,
  razorpayPaymentId: booking.razorpayPaymentId,
  razorpaySignature: booking.razorpaySignature ?? null,
  status: booking.status,
  totalAmount: booking.totalAmount,
  travelerDetails: booking.travelerDetails ?? null,
  travelers: booking.travelers,
  tripId: booking.tripId,
  updatedAt: new Date(booking.updatedAt).toISOString(),
  userId: booking.userId,
});

const getUserProfile = async (ctx: QueryCtx | MutationCtx, authUserId: string) =>
  await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();

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
    .withIndex("by_razorpayPaymentId", (q) => q.eq("razorpayPaymentId", paymentId))
    .take(1);
  return rows[0] ?? null;
};

export const prepareCheckout = query({
  args: {
    currency: v.string(),
    travelers: v.number(),
    tripIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    ensureValidCheckoutArgs(args.travelers, args.currency);

    const trip = await resolveTrip(ctx, args.tripIdentifier);
    if (!trip?.isActive) {
      throw new ConvexError("Trip not found or inactive");
    }
    if (trip.availableSeats < args.travelers) {
      throw new ConvexError(`Only ${trip.availableSeats} seats available`);
    }

    const profile = await getUserProfile(ctx, identity.subject);
    const pricePerPerson = args.currency === "INR" ? trip.priceInr : trip.priceUsd;

    return {
      currency: args.currency,
      pricePerPerson,
      totalAmount: pricePerPerson * args.travelers,
      travelers: args.travelers,
      trip: toApiTrip(trip),
      user: {
        email: profile?.email ?? identity.email ?? "",
        id: identity.subject,
        name: profile?.name ?? identity.name ?? "Traveler",
        phoneNumber: profile?.phoneNumber ?? "",
      },
    };
  },
});

export const createPendingBooking = mutation({
  args: {
    currency: v.string(),
    notes: v.optional(v.string()),
    razorpayOrderId: v.string(),
    travelerDetails: v.optional(v.any()),
    travelers: v.number(),
    tripIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    ensureValidCheckoutArgs(args.travelers, args.currency);

    const trip = await resolveTrip(ctx, args.tripIdentifier);
    if (!trip?.isActive) {
      throw new ConvexError("Trip not found or inactive");
    }
    if (trip.availableSeats < args.travelers) {
      throw new ConvexError(`Only ${trip.availableSeats} seats available`);
    }

    const pricePerPerson = args.currency === "INR" ? trip.priceInr : trip.priceUsd;
    const totalAmount = pricePerPerson * args.travelers;
    const timestamp = Date.now();

    const bookingId = await ctx.db.insert("bookings", {
      createdAt: timestamp,
      currency: args.currency,
      notes: args.notes ?? "",
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: "",
      status: "pending",
      totalAmount,
      travelerDetails: args.travelerDetails ?? null,
      travelers: args.travelers,
      tripId: trip._id,
      updatedAt: timestamp,
      userId: identity.subject,
    });

    return {
      booking: {
        id: bookingId,
        status: "pending",
      },
      currency: args.currency,
      totalAmount,
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

    const trips = await Promise.all(rows.map((booking) => ctx.db.get(booking.tripId)));
    return rows.flatMap((booking, index) => {
      const trip = trips[index];
      if (!trip) {
        return [];
      }
      return [
        {
          booking: toApiBooking(booking),
          trip: toApiTrip(trip),
        },
      ];
    });
  },
});

export const markBookingFailedById = mutation({
  args: {
    bookingId: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO(payment-security): restrict server-only payment status mutations once Razorpay webhook secrets are configured.
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

export const confirmBookingByOrderIdHandler = async (
  ctx: MutationCtx,
  args: { orderId: string; paymentId: string; signature?: string }
) => {
  const booking = await getBookingByOrderId(ctx, args.orderId);
  if (!booking) {
    return {
      message: "Booking not found for this order",
      success: false,
    };
  }

  if (booking.status === "confirmed") {
    return {
      alreadyConfirmed: true,
      booking: toApiBooking(booking),
      success: true,
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
  await Promise.all([
    ctx.db.patch(booking._id, {
      confirmedAt: timestamp,
      razorpayPaymentId: args.paymentId,
      razorpaySignature: args.signature,
      status: "confirmed",
      updatedAt: timestamp,
    }),
    ctx.db.patch(trip._id, {
      availableSeats: trip.availableSeats - booking.travelers,
      updatedAt: timestamp,
    }),
  ]);

  const updated = await ctx.db.get(booking._id);
  return {
    alreadyConfirmed: false,
    booking: updated ? toApiBooking(updated) : null,
    success: true,
  };
};

export const confirmBookingByOrderId = mutation({
  args: {
    orderId: v.string(),
    paymentId: v.string(),
    serverSecret: v.string(),
    signature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertPaymentMutationSecret(args.serverSecret);
    return await confirmBookingByOrderIdHandler(ctx, args);
  },
});

export const recordPaymentAuthorized = mutation({
  args: {
    orderId: v.string(),
    paymentId: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertPaymentMutationSecret(args.serverSecret);
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

export const markPaymentFailedByOrderIdHandler = async (
  ctx: MutationCtx,
  args: { orderId: string; paymentId?: string }
) => {
  const booking = await getBookingByOrderId(ctx, args.orderId);
  if (!booking) {
    return null;
  }

  if (booking.status === "confirmed" || booking.status === "refunded") {
    return {
      id: booking._id,
      ignored: true,
      status: booking.status,
    };
  }

  await ctx.db.patch(booking._id, {
    razorpayPaymentId: args.paymentId ?? booking.razorpayPaymentId,
    status: "failed",
    updatedAt: Date.now(),
  });

  return { id: booking._id, status: "failed" as const };
};

export const markPaymentFailedByOrderId = mutation({
  args: {
    orderId: v.string(),
    paymentId: v.optional(v.string()),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertPaymentMutationSecret(args.serverSecret);
    return await markPaymentFailedByOrderIdHandler(ctx, args);
  },
});

export const markRefundedByPaymentId = mutation({
  args: {
    paymentId: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertPaymentMutationSecret(args.serverSecret);
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
