import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const toTimestamp = (value: unknown, fallback = Date.now()) => {
  if (!value) {
    return fallback;
  }
  const asDate = new Date(value as string | number | Date);
  const asMillis = asDate.getTime();
  return Number.isNaN(asMillis) ? fallback : asMillis;
};

const assertMigrationSecret = (secret: string) => {
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError("Invalid migration secret");
  }
};

type BookingStatus = Doc<"bookings">["status"];

const normalizeBookingStatus = (value: unknown): BookingStatus => {
  const normalized = (value ?? "pending").toString();
  if (
    normalized === "pending" ||
    normalized === "confirmed" ||
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "refunded"
  ) {
    return normalized as BookingStatus;
  }
  return "pending";
};

export const importUsers = mutation({
  args: {
    secret: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    let imported = 0;
    let updated = 0;

    for (const row of args.rows) {
      const authUserId = row.id ?? row.user_id ?? row.userId;
      if (!authUserId) {
        continue;
      }

      const existing = await ctx.db
        .query("userProfiles")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
        .unique();

      const payload = {
        authUserId,
        email: row.email ?? "",
        name: row.name ?? "Traveler",
        phoneNumber: row.phone_number ?? row.phoneNumber ?? "",
        passportDetailsEncrypted:
          row.passport_details_encrypted ??
          row.passportDetailsEncrypted ??
          "",
        image: row.image ?? "",
        createdAt: toTimestamp(row.created_at ?? row.createdAt),
        updatedAt: toTimestamp(row.updated_at ?? row.updatedAt),
        legacyUserId: authUserId,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
        updated += 1;
      } else {
        await ctx.db.insert("userProfiles", payload);
        imported += 1;
      }
    }

    return { imported, updated, total: args.rows.length };
  },
});

export const importTrips = mutation({
  args: {
    secret: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    let imported = 0;
    let updated = 0;

    for (const row of args.rows) {
      const legacyTripId = row.id ?? row.trip_id ?? row.tripId;
      if (!legacyTripId) {
        continue;
      }

      const existing = await ctx.db
        .query("trips")
        .withIndex("by_legacyTripId", (q) => q.eq("legacyTripId", legacyTripId))
        .unique();

      const isActiveRaw = row.is_active ?? row.isActive ?? 1;
      const payload = {
        name: row.name ?? "",
        slug: row.slug ?? "",
        description: row.description ?? "",
        startDate: row.start_date ?? row.startDate ?? "",
        endDate: row.end_date ?? row.endDate ?? "",
        totalSeats: Number(row.total_seats ?? row.totalSeats ?? 0),
        availableSeats: Number(row.available_seats ?? row.availableSeats ?? 0),
        priceInr: Number(row.price_inr ?? row.priceInr ?? 0),
        priceUsd: Number(row.price_usd ?? row.priceUsd ?? 0),
        difficulty: row.difficulty ?? "",
        itinerary: row.itinerary ?? [],
        inclusions: row.inclusions ?? [],
        exclusions: row.exclusions ?? [],
        coverImage: row.cover_image ?? row.coverImage ?? "",
        gallery: row.gallery ?? [],
        isActive: Number(isActiveRaw) === 1 || isActiveRaw === true,
        createdAt: toTimestamp(row.created_at ?? row.createdAt),
        updatedAt: toTimestamp(row.updated_at ?? row.updatedAt),
        legacyTripId,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
        updated += 1;
      } else {
        await ctx.db.insert("trips", payload);
        imported += 1;
      }
    }

    return { imported, updated, total: args.rows.length };
  },
});

export const importBookings = mutation({
  args: {
    secret: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of args.rows) {
      const legacyBookingId = row.id ?? row.booking_id ?? row.bookingId;
      if (!legacyBookingId) {
        skipped += 1;
        continue;
      }

      const legacyTripId = row.trip_id ?? row.tripId;
      const trip = await ctx.db
        .query("trips")
        .withIndex("by_legacyTripId", (q) => q.eq("legacyTripId", legacyTripId))
        .unique();

      if (!trip) {
        skipped += 1;
        continue;
      }

      const existing = await ctx.db
        .query("bookings")
        .withIndex("by_legacyBookingId", (q) =>
          q.eq("legacyBookingId", legacyBookingId),
        )
        .unique();

      const payload = {
        userId: row.user_id ?? row.userId ?? "",
        tripId: trip._id,
        status: normalizeBookingStatus(row.status),
        razorpayOrderId: row.razorpay_order_id ?? row.razorpayOrderId ?? "",
        razorpayPaymentId:
          row.razorpay_payment_id ?? row.razorpayPaymentId ?? "",
        razorpaySignature:
          row.razorpay_signature ?? row.razorpaySignature ?? "",
        totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
        currency: row.currency ?? "INR",
        travelers: Number(row.travelers ?? 1),
        travelerDetails: row.traveler_details ?? row.travelerDetails ?? null,
        notes: row.notes ?? "",
        createdAt: toTimestamp(row.created_at ?? row.createdAt),
        updatedAt: toTimestamp(row.updated_at ?? row.updatedAt),
        confirmedAt: row.confirmed_at
          ? toTimestamp(row.confirmed_at)
          : undefined,
        legacyBookingId,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
        updated += 1;
      } else {
        await ctx.db.insert("bookings", payload);
        imported += 1;
      }
    }

    return { imported, updated, skipped, total: args.rows.length };
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("userProfiles").collect();
    const trips = await ctx.db.query("trips").collect();
    const bookings = await ctx.db.query("bookings").collect();

    const bookingsByStatus = bookings.reduce<Record<string, number>>((acc, booking) => {
      const key = booking.status;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const seatTotals = trips.map((trip) => ({
      id: trip._id,
      legacyTripId: trip.legacyTripId ?? null,
      slug: trip.slug,
      totalSeats: trip.totalSeats,
      availableSeats: trip.availableSeats,
    }));

    return {
      counts: {
        users: users.length,
        trips: trips.length,
        bookings: bookings.length,
      },
      bookingsByStatus,
      seatTotals,
    };
  },
});
