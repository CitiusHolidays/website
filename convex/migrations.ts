import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { normalizeEmail } from "./crm/lib/staffAccess";
import {
  isLegacyRoomCode,
  resolveRoomingEntryRoomType,
  resolveTravellerRoomFields,
} from "./lib/roomTypes";
import {
  type TransitionalTravelBatchSummary,
  travelBatchCountFromSummaries,
  travelBatchSummaryVariant,
} from "./lib/travelBatchSummary";
import {
  migrationImportSummaryValidator,
  migrationStatsResultValidator,
  travelBatchAuditResultValidator,
  travelBatchMigrationResultValidator,
} from "./publicReturnContracts";

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

const TRAVEL_BATCH_MIGRATION_LIMIT = 100;
const ROOM_TYPE_MIGRATION_KEY = "room-type-v2";
const ROOM_TYPE_MIGRATION_LIMIT = 100;

const migrationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("verified"),
  v.literal("failed")
);
const roomTypeMigrationResultValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  legacyRemaining: v.number(),
  legacyRoomingRoomTypes: v.number(),
  legacyTravellerRoomTypes: v.number(),
  mismatchedTravellers: v.number(),
  processed: v.number(),
  roomingEntriesUpdated: v.number(),
  stage: v.string(),
  status: migrationStatusValidator,
  travellerRoomTypesUpdated: v.number(),
  travellersUpdated: v.number(),
});
const roomTypeMigrationStatusValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  key: v.string(),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.string(),
  status: migrationStatusValidator,
  updatedAt: v.number(),
  verified: v.boolean(),
  verifiedAt: v.union(v.number(), v.null()),
});

export const auditTravelBatchSummaries = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const result = await ctx.db.query("jobCards").paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.flatMap((job) => {
        const summaries = (job.travelBatchSummaries ?? []) as TransitionalTravelBatchSummary[];
        if (summaries.length === 0) {
          return [];
        }
        return [
          {
            derivedCount: travelBatchCountFromSummaries(summaries),
            id: job._id,
            jobCode: job.jobCode,
            storedCount: job.travelBatchCount ?? null,
            variants: Array.from(new Set(summaries.map(travelBatchSummaryVariant))),
          },
        ];
      }),
    };
  },
  returns: travelBatchAuditResultValidator,
});

export const migrateTravelBatchSummaries = internalMutation({
  args: {
    jobCardIds: v.array(v.id("jobCards")),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    if (args.jobCardIds.length > TRAVEL_BATCH_MIGRATION_LIMIT) {
      throw new ConvexError(`Migrate at most ${TRAVEL_BATCH_MIGRATION_LIMIT} Job Cards per call`);
    }
    const uniqueJobCardIds = Array.from(new Set(args.jobCardIds));
    const duplicateCount = args.jobCardIds.length - uniqueJobCardIds.length;
    const outcomes = await Promise.all(
      uniqueJobCardIds.map(async (jobCardId) => {
        const job = await ctx.db.get(jobCardId);
        const summaries = (job?.travelBatchSummaries ?? []) as TransitionalTravelBatchSummary[];
        if (!job || summaries.length === 0) {
          return "skipped" as const;
        }
        await ctx.db.patch(jobCardId, {
          travelBatchCount: Math.max(
            job.travelBatchCount ?? 0,
            travelBatchCountFromSummaries(summaries)
          ),
          travelBatchSummaries: undefined,
          updatedAt: Date.now(),
        });
        return "migrated" as const;
      })
    );
    const migrated = outcomes.filter((outcome) => outcome === "migrated").length;
    const skipped = outcomes.filter((outcome) => outcome === "skipped").length + duplicateCount;
    return { migrated, skipped, total: args.jobCardIds.length };
  },
  returns: travelBatchMigrationResultValidator,
});

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

export const importUsers = internalMutation({
  args: {
    rows: v.array(v.any()),
    secret: v.string(),
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
          createdAt: toTimestamp(row.created_at ?? row.createdAt),
          email: row.email ?? "",
          emailNormalized: normalizeEmail(row.email ?? ""),
          image: row.image ?? "",
          legacyUserId: authUserId,
          name: row.name ?? "Traveler",
          passportDetailsEncrypted:
            row.passport_details_encrypted ?? row.passportDetailsEncrypted ?? "",
          phoneNumber: row.phone_number ?? row.phoneNumber ?? "",
          updatedAt: toTimestamp(row.updated_at ?? row.updatedAt),
        };

        if (existing) {
          await ctx.db.patch(existing._id, payload);
          return "updated";
        }
        await ctx.db.insert("userProfiles", payload);
        return "imported";
      })
    );

    return {
      imported: results.filter((result) => result === "imported").length,
      total: args.rows.length,
      updated: results.filter((result) => result === "updated").length,
    };
  },
  returns: migrationImportSummaryValidator,
});

export const importTrips = internalMutation({
  args: {
    rows: v.array(v.any()),
    secret: v.string(),
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
          availableSeats: Number(row.available_seats ?? row.availableSeats ?? 0),
          coverImage: row.cover_image ?? row.coverImage ?? "",
          createdAt: toTimestamp(row.created_at ?? row.createdAt),
          description: row.description ?? "",
          difficulty: row.difficulty ?? "",
          endDate: row.end_date ?? row.endDate ?? "",
          exclusions: row.exclusions ?? [],
          gallery: row.gallery ?? [],
          inclusions: row.inclusions ?? [],
          isActive: Number(isActiveRaw) === 1 || isActiveRaw === true,
          itinerary: row.itinerary ?? [],
          legacyTripId,
          name: row.name ?? "",
          priceInr: Number(row.price_inr ?? row.priceInr ?? 0),
          priceUsd: Number(row.price_usd ?? row.priceUsd ?? 0),
          slug: row.slug ?? "",
          startDate: row.start_date ?? row.startDate ?? "",
          totalSeats: Number(row.total_seats ?? row.totalSeats ?? 0),
          updatedAt: toTimestamp(row.updated_at ?? row.updatedAt),
        };

        if (existing) {
          await ctx.db.patch(existing._id, payload);
          return "updated";
        }
        await ctx.db.insert("trips", payload);
        return "imported";
      })
    );

    return {
      imported: results.filter((result) => result === "imported").length,
      total: args.rows.length,
      updated: results.filter((result) => result === "updated").length,
    };
  },
  returns: migrationImportSummaryValidator,
});

export const importBookings = internalMutation({
  args: {
    rows: v.array(v.any()),
    secret: v.string(),
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
          confirmedAt: row.confirmed_at ? toTimestamp(row.confirmed_at) : undefined,
          createdAt: toTimestamp(row.created_at ?? row.createdAt),
          currency: row.currency ?? "INR",
          legacyBookingId,
          notes: row.notes ?? "",
          razorpayOrderId: row.razorpay_order_id ?? row.razorpayOrderId ?? "",
          razorpayPaymentId: row.razorpay_payment_id ?? row.razorpayPaymentId ?? "",
          razorpaySignature: row.razorpay_signature ?? row.razorpaySignature ?? "",
          status: normalizeBookingStatus(row.status),
          totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
          travelerDetails: row.traveler_details ?? row.travelerDetails ?? null,
          travelers: Number(row.travelers ?? 1),
          tripId: trip._id,
          updatedAt: toTimestamp(row.updated_at ?? row.updatedAt),
          userId: row.user_id ?? row.userId ?? "",
        };

        if (existing) {
          await ctx.db.patch(existing._id, payload);
          return "updated";
        }
        await ctx.db.insert("bookings", payload);
        return "imported";
      })
    );

    return {
      imported: results.filter((result) => result === "imported").length,
      skipped: results.filter((result) => result === "skipped").length,
      total: args.rows.length,
      updated: results.filter((result) => result === "updated").length,
    };
  },
  returns: migrationImportSummaryValidator,
});

export const migrateRoomTypes = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? ROOM_TYPE_MIGRATION_LIMIT), 1), 100);
    const now = Date.now();
    const existing = await ctx.db
      .query("dataMigrationRegistry")
      .withIndex("by_key", (q) => q.eq("key", ROOM_TYPE_MIGRATION_KEY))
      .unique();

    if (existing?.status === "verified") {
      return {
        converted: existing.converted,
        cursor: null,
        legacyRemaining: existing.legacyRemaining,
        legacyRoomingRoomTypes: 0,
        legacyTravellerRoomTypes: 0,
        mismatchedTravellers: 0,
        processed: 0,
        roomingEntriesUpdated: 0,
        stage: "complete",
        status: "verified" as const,
        travellerRoomTypesUpdated: 0,
        travellersUpdated: 0,
      };
    }

    let stage = existing?.stage === "roomingListEntries" ? "roomingListEntries" : "travellers";
    let cursor = args.cursor !== undefined ? args.cursor : (existing?.cursor ?? null);
    const startedAt = existing?.startedAt ?? now;
    let converted = existing?.converted ?? 0;
    let processed = existing?.processed ?? 0;
    let legacyRemaining = existing?.legacyRemaining ?? 0;
    let registryId = existing?._id;
    if (!existing) {
      registryId = await ctx.db.insert("dataMigrationRegistry", {
        converted: 0,
        cursor: null,
        key: ROOM_TYPE_MIGRATION_KEY,
        legacyRemaining: 0,
        processed: 0,
        stage,
        startedAt,
        status: "running",
        updatedAt: now,
      });
    } else if (existing.status !== "running") {
      await ctx.db.patch(existing._id, { status: "running", updatedAt: now });
    }

    const page =
      stage === "travellers"
        ? await ctx.db.query("travellers").order("asc").paginate({ cursor, numItems: limit })
        : await ctx.db
            .query("roomingListEntries")
            .order("asc")
            .paginate({ cursor, numItems: limit });

    let legacyTravellerRoomTypes = 0;
    let legacyRoomingRoomTypes = 0;
    let mismatchedTravellers = 0;
    let travellersUpdated = 0;
    let travellerRoomTypesUpdated = 0;
    let roomingEntriesUpdated = 0;
    for (const row of page.page) {
      processed += 1;
      if (stage === "travellers") {
        const traveller = row as Doc<"travellers">;
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
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = now;
          await ctx.db.patch(traveller._id, patch);
          travellersUpdated += 1;
          if (patch.roomType !== undefined) {
            travellerRoomTypesUpdated += 1;
          }
        }
      } else {
        const entry = row as Doc<"roomingListEntries">;
        if (isLegacyRoomCode(entry.roomType)) {
          legacyRoomingRoomTypes += 1;
        }
        const roomType = resolveRoomingEntryRoomType(entry.roomType);
        if (roomType && String(entry.roomType) !== roomType) {
          await ctx.db.patch(entry._id, { roomType, updatedAt: now });
          roomingEntriesUpdated += 1;
        }
      }
    }
    const pageLegacy = legacyTravellerRoomTypes + legacyRoomingRoomTypes;
    const pageConverted = travellerRoomTypesUpdated + roomingEntriesUpdated;
    converted += pageConverted;
    legacyRemaining = Math.max(0, legacyRemaining + pageLegacy - pageConverted);

    if (page.isDone) {
      if (stage === "travellers") {
        stage = "roomingListEntries";
        cursor = null;
      } else {
        stage = "complete";
        cursor = null;
      }
    } else {
      cursor = page.continueCursor;
    }
    const status: "verified" | "running" = stage === "complete" ? "verified" : "running";
    const registryPatch = {
      converted,
      cursor,
      legacyRemaining,
      processed,
      stage,
      status,
      updatedAt: now,
      ...(status === "verified" ? { verifiedAt: now } : {}),
    };
    if (registryId) {
      await ctx.db.patch(registryId, registryPatch);
    }

    // A page is intentionally the unit of work. Operators can call this
    // mutation again with the returned cursor, or rely on the scheduler in a
    // deployment runner, without a full-table collect or Promise.all burst.
    return {
      converted: pageConverted,
      cursor,
      legacyRemaining,
      legacyRoomingRoomTypes,
      legacyTravellerRoomTypes,
      mismatchedTravellers,
      processed: page.page.length,
      roomingEntriesUpdated,
      stage,
      status,
      travellerRoomTypesUpdated,
      travellersUpdated,
    };
  },
  returns: roomTypeMigrationResultValidator,
});

/**
 * Deployment verification gate for the room-type migration.  The schema may
 * be narrowed only after this reports `verified: true` and
 * `legacyRemaining: 0` in the target deployment.
 */
export const getRoomTypeMigrationStatus = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const row = await ctx.db
      .query("dataMigrationRegistry")
      .withIndex("by_key", (q) => q.eq("key", ROOM_TYPE_MIGRATION_KEY))
      .unique();
    const status = row?.status ?? "pending";
    return {
      converted: row?.converted ?? 0,
      cursor: row?.cursor ?? null,
      key: ROOM_TYPE_MIGRATION_KEY,
      legacyRemaining: row?.legacyRemaining ?? 0,
      processed: row?.processed ?? 0,
      stage: row?.stage ?? "travellers",
      status,
      updatedAt: row?.updatedAt ?? 0,
      verified: status === "verified" && (row?.legacyRemaining ?? 0) === 0,
      verifiedAt: row?.verifiedAt ?? null,
    };
  },
  returns: roomTypeMigrationStatusValidator,
});

export const getStats = internalMutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
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
      availableSeats: trip.availableSeats,
      id: trip._id,
      legacyTripId: trip.legacyTripId ?? null,
      slug: trip.slug,
      totalSeats: trip.totalSeats,
    }));

    return {
      bookingsByStatus,
      counts: {
        bookings: bookings.length,
        trips: trips.length,
        users: users.length,
      },
      seatTotals,
    };
  },
  returns: migrationStatsResultValidator,
});
