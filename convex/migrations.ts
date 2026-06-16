import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  isLegacyRoomCode,
  resolveRoomingEntryRoomType,
  resolveTravellerRoomFields,
} from "./lib/roomTypes";

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
    const results = await Promise.all(
      args.rows.map(async (row) => {
        const authUserId = row.id ?? row.user_id ?? row.userId;
        if (!authUserId) {
          return "skipped";
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
            row.passport_details_encrypted ?? row.passportDetailsEncrypted ?? "",
          image: row.image ?? "",
          createdAt: toTimestamp(row.created_at ?? row.createdAt),
          updatedAt: toTimestamp(row.updated_at ?? row.updatedAt),
          legacyUserId: authUserId,
        };

        if (existing) {
          await ctx.db.patch(existing._id, payload);
          return "updated";
        } else {
          await ctx.db.insert("userProfiles", payload);
          return "imported";
        }
      }),
    );

    return {
      imported: results.filter((result) => result === "imported").length,
      updated: results.filter((result) => result === "updated").length,
      total: args.rows.length,
    };
  },
});

export const importTrips = mutation({
  args: {
    secret: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const results = await Promise.all(
      args.rows.map(async (row) => {
        const legacyTripId = row.id ?? row.trip_id ?? row.tripId;
        if (!legacyTripId) {
          return "skipped";
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
          return "updated";
        } else {
          await ctx.db.insert("trips", payload);
          return "imported";
        }
      }),
    );

    return {
      imported: results.filter((result) => result === "imported").length,
      updated: results.filter((result) => result === "updated").length,
      total: args.rows.length,
    };
  },
});

export const importBookings = mutation({
  args: {
    secret: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const results = await Promise.all(
      args.rows.map(async (row) => {
        const legacyBookingId = row.id ?? row.booking_id ?? row.bookingId;
        if (!legacyBookingId) {
          return "skipped";
        }

        const legacyTripId = row.trip_id ?? row.tripId;
        const trip = await ctx.db
          .query("trips")
          .withIndex("by_legacyTripId", (q) => q.eq("legacyTripId", legacyTripId))
          .unique();

        if (!trip) {
          return "skipped";
        }

        const existing = await ctx.db
          .query("bookings")
          .withIndex("by_legacyBookingId", (q) => q.eq("legacyBookingId", legacyBookingId))
          .unique();

        const payload = {
          userId: row.user_id ?? row.userId ?? "",
          tripId: trip._id,
          status: normalizeBookingStatus(row.status),
          razorpayOrderId: row.razorpay_order_id ?? row.razorpayOrderId ?? "",
          razorpayPaymentId: row.razorpay_payment_id ?? row.razorpayPaymentId ?? "",
          razorpaySignature: row.razorpay_signature ?? row.razorpaySignature ?? "",
          totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
          currency: row.currency ?? "INR",
          travelers: Number(row.travelers ?? 1),
          travelerDetails: row.traveler_details ?? row.travelerDetails ?? null,
          notes: row.notes ?? "",
          createdAt: toTimestamp(row.created_at ?? row.createdAt),
          updatedAt: toTimestamp(row.updated_at ?? row.updatedAt),
          confirmedAt: row.confirmed_at ? toTimestamp(row.confirmed_at) : undefined,
          legacyBookingId,
        };

        if (existing) {
          await ctx.db.patch(existing._id, payload);
          return "updated";
        } else {
          await ctx.db.insert("bookings", payload);
          return "imported";
        }
      }),
    );

    return {
      imported: results.filter((result) => result === "imported").length,
      updated: results.filter((result) => result === "updated").length,
      skipped: results.filter((result) => result === "skipped").length,
      total: args.rows.length,
    };
  },
});

export const migrateRoomTypes = mutation({
  args: {
    secret: v.string(),
  },
  returns: v.object({
    travellersUpdated: v.number(),
    travellerRoomTypesUpdated: v.number(),
    roomingEntriesUpdated: v.number(),
    legacyTravellerRoomTypes: v.number(),
    legacyRoomingRoomTypes: v.number(),
    mismatchedTravellers: v.number(),
  }),
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);

    const travellers = await ctx.db.query("travellers").collect();
    let legacyTravellerRoomTypes = 0;
    let mismatchedTravellers = 0;
    let travellersUpdated = 0;
    let travellerRoomTypesUpdated = 0;

    const travellerPatches: Array<{
      id: (typeof travellers)[number]["_id"];
      patch: Partial<Doc<"travellers">>;
    }> = [];

    for (const traveller of travellers) {
      if (isLegacyRoomCode(traveller.roomType)) {
        legacyTravellerRoomTypes += 1;
      }

      const resolved = resolveTravellerRoomFields(traveller.roomType, traveller.hotelAllocation);
      if (resolved.roomType && String(traveller.roomType) !== resolved.roomType) {
        mismatchedTravellers += 1;
      }

      const patch: Partial<Doc<"travellers">> = {};

      if (resolved.roomType && String(traveller.roomType) !== resolved.roomType) {
        patch.roomType = resolved.roomType;
      }
      if (
        resolved.hotelAllocation !== undefined &&
        (traveller.hotelAllocation ?? "") !== resolved.hotelAllocation
      ) {
        patch.hotelAllocation = resolved.hotelAllocation;
      }

      if (Object.keys(patch).length === 0) {
        continue;
      }

      patch.updatedAt = Date.now();
      travellerPatches.push({ id: traveller._id, patch });
    }

    await Promise.all(
      travellerPatches.map(async ({ id, patch }) => {
        await ctx.db.patch(id, patch);
      }),
    );

    travellersUpdated = travellerPatches.length;
    travellerRoomTypesUpdated = travellerPatches.filter(
      ({ patch }) => patch.roomType !== undefined,
    ).length;

    const roomingEntries = await ctx.db.query("roomingListEntries").collect();
    let legacyRoomingRoomTypes = 0;
    let roomingEntriesUpdated = 0;

    const roomingPatches: Array<{
      id: (typeof roomingEntries)[number]["_id"];
      patch: Pick<Doc<"roomingListEntries">, "roomType" | "updatedAt">;
    }> = [];

    for (const entry of roomingEntries) {
      if (isLegacyRoomCode(entry.roomType)) {
        legacyRoomingRoomTypes += 1;
      }

      const roomType = resolveRoomingEntryRoomType(entry.roomType);
      if (!roomType || String(entry.roomType) === roomType) {
        continue;
      }

      roomingPatches.push({
        id: entry._id,
        patch: {
          roomType,
          updatedAt: Date.now(),
        },
      });
    }

    await Promise.all(
      roomingPatches.map(async ({ id, patch }) => {
        await ctx.db.patch(id, patch);
      }),
    );

    roomingEntriesUpdated = roomingPatches.length;

    return {
      travellersUpdated,
      travellerRoomTypesUpdated,
      roomingEntriesUpdated,
      legacyTravellerRoomTypes,
      legacyRoomingRoomTypes,
      mismatchedTravellers,
    };
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const [users, trips, bookings] = await Promise.all([
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("trips").collect(),
      ctx.db.query("bookings").collect(),
    ]);

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
