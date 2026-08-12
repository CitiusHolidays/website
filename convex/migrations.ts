import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { normalizeEmail } from "./crm/lib/staffAccess";
import {
  isLegacyRoomCode,
  resolveRoomingEntryRoomType,
  resolveTravellerRoomFields,
} from "./lib/roomTypes";
import {
  refreshSacredBharatLeaderboardSummary,
  SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY,
} from "./lib/sacredBharatLeaderboard";
import {
  assertRecognizedTravelBatchSummaries,
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
export const TRAVEL_BATCH_SUMMARY_MIGRATION_KEY = "travel-batch-summary-v2";
const ROOM_TYPE_MIGRATION_KEY = "room-type-v2";
const ROOM_TYPE_MIGRATION_LIMIT = 100;
const SACRED_BHARAT_LEADERBOARD_MIGRATION_LIMIT = 100;

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
const travelBatchSummaryRegistryResultValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
  status: migrationStatusValidator,
});
const travelBatchSummaryRegistryStatusValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  key: v.string(),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
  status: migrationStatusValidator,
  updatedAt: v.number(),
  verified: v.boolean(),
  verifiedAt: v.union(v.number(), v.null()),
});
const sacredBharatLeaderboardMigrationResultValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
  status: migrationStatusValidator,
  summariesUpdated: v.number(),
});
const sacredBharatLeaderboardMigrationStatusValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  key: v.string(),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
  status: migrationStatusValidator,
  updatedAt: v.number(),
  verified: v.boolean(),
  verifiedAt: v.union(v.number(), v.null()),
});

function boundedLeaderboardMigrationLimit(limit?: number) {
  return Math.min(
    Math.max(Math.trunc(limit ?? SACRED_BHARAT_LEADERBOARD_MIGRATION_LIMIT), 1),
    SACRED_BHARAT_LEADERBOARD_MIGRATION_LIMIT
  );
}

async function getSacredBharatLeaderboardMigration(ctx: MutationCtx | QueryCtx) {
  return await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY))
    .unique();
}

export const backfillSacredBharatLeaderboard = internalMutation({
  args: {
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const limit = boundedLeaderboardMigrationLimit(args.limit);
    const timestamp = Date.now();
    let registry = await getSacredBharatLeaderboardMigration(ctx);

    if (registry?.status === "verified") {
      return {
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        stage: "complete" as const,
        status: "verified" as const,
        summariesUpdated: 0,
      };
    }
    if (registry?.stage === "verify" && registry.status === "running") {
      return {
        cursor: registry.cursor,
        legacyRemaining: registry.legacyRemaining,
        processed: 0,
        stage: "verify" as const,
        status: "running" as const,
        summariesUpdated: 0,
      };
    }

    if (!registry) {
      const id = await ctx.db.insert("dataMigrationRegistry", {
        converted: 0,
        cursor: null,
        key: SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY,
        legacyRemaining: 0,
        processed: 0,
        stage: "backfill",
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp,
      });
      registry = await ctx.db.get(id);
    } else if (registry.status === "failed") {
      await ctx.db.patch(registry._id, {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        stage: "backfill",
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp,
        verifiedAt: undefined,
      });
      registry = await ctx.db.get(registry._id);
    }
    if (!registry) {
      throw new ConvexError("Unable to initialize Sacred Bharat leaderboard migration");
    }

    const page = await ctx.db
      .query("sacredBharatVisits")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: limit });
    const authUserIds = [...new Set(page.page.map((visit) => visit.authUserId))];
    await Promise.all(
      authUserIds.map(async (authUserId) => {
        await refreshSacredBharatLeaderboardSummary(ctx, authUserId, timestamp);
      })
    );

    const stage = page.isDone ? ("verify" as const) : ("backfill" as const);
    const cursor = page.isDone ? null : page.continueCursor;
    await ctx.db.patch(registry._id, {
      converted: registry.converted + authUserIds.length,
      cursor,
      legacyRemaining: 0,
      processed: page.isDone ? 0 : registry.processed + page.page.length,
      stage,
      status: "running",
      updatedAt: timestamp,
    });
    return {
      cursor,
      legacyRemaining: 0,
      processed: page.page.length,
      stage,
      status: "running" as const,
      summariesUpdated: authUserIds.length,
    };
  },
  returns: sacredBharatLeaderboardMigrationResultValidator,
});

export const verifySacredBharatLeaderboard = internalMutation({
  args: {
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const limit = boundedLeaderboardMigrationLimit(args.limit);
    const timestamp = Date.now();
    const registry = await getSacredBharatLeaderboardMigration(ctx);
    if (!registry) {
      throw new ConvexError("Run the Sacred Bharat leaderboard backfill first");
    }
    if (registry.status === "verified") {
      return {
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        stage: "complete" as const,
        status: "verified" as const,
        summariesUpdated: 0,
      };
    }
    if (registry.stage !== "verify" || registry.status === "failed") {
      throw new ConvexError("Sacred Bharat leaderboard backfill is not ready for verification");
    }

    const page = await ctx.db
      .query("sacredBharatVisits")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: limit });
    const authUserIds = [...new Set(page.page.map((visit) => visit.authUserId))];
    const summaries = await Promise.all(
      authUserIds.map(
        async (authUserId) =>
          await ctx.db
            .query("sacredBharatLeaderboardSummaries")
            .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
            .unique()
      )
    );
    const legacyRemaining =
      registry.legacyRemaining + summaries.filter((summary) => summary === null).length;
    let status: "failed" | "running" | "verified" = "running";
    if (page.isDone) {
      status = legacyRemaining === 0 ? "verified" : "failed";
    }
    const stage = status === "verified" ? ("complete" as const) : ("verify" as const);
    const cursor = page.isDone ? null : page.continueCursor;
    await ctx.db.patch(registry._id, {
      cursor,
      legacyRemaining,
      processed: registry.processed + page.page.length,
      stage,
      status,
      updatedAt: timestamp,
      ...(status === "verified" ? { verifiedAt: timestamp } : {}),
    });
    return {
      cursor,
      legacyRemaining,
      processed: page.page.length,
      stage,
      status,
      summariesUpdated: 0,
    };
  },
  returns: sacredBharatLeaderboardMigrationResultValidator,
});

export const getSacredBharatLeaderboardMigrationStatus = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const registry = await getSacredBharatLeaderboardMigration(ctx);
    const status = registry?.status ?? "pending";
    const stage: "backfill" | "complete" | "verify" =
      registry?.stage === "verify" || registry?.stage === "complete" ? registry.stage : "backfill";
    const legacyRemaining = registry?.legacyRemaining ?? 0;
    return {
      cursor: registry?.cursor ?? null,
      key: SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY,
      legacyRemaining,
      processed: registry?.processed ?? 0,
      stage,
      status,
      updatedAt: registry?.updatedAt ?? 0,
      verified: status === "verified" && stage === "complete" && legacyRemaining === 0,
      verifiedAt: registry?.verifiedAt ?? null,
    };
  },
  returns: sacredBharatLeaderboardMigrationStatusValidator,
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

function boundedTravelBatchSummaryMigrationLimit(limit?: number) {
  return Math.min(Math.max(Math.trunc(limit ?? TRAVEL_BATCH_MIGRATION_LIMIT), 1), 100);
}

async function getTravelBatchSummaryMigration(ctx: MutationCtx | QueryCtx) {
  return await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", TRAVEL_BATCH_SUMMARY_MIGRATION_KEY))
    .unique();
}

export const backfillTravelBatchSummaries = internalMutation({
  args: {
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const limit = boundedTravelBatchSummaryMigrationLimit(args.limit);
    const now = Date.now();
    let registry = await getTravelBatchSummaryMigration(ctx);
    if (registry?.status === "verified") {
      return {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        stage: "complete" as const,
        status: "verified" as const,
      };
    }
    if (registry?.stage === "verify" && registry.status === "running") {
      return {
        converted: 0,
        cursor: registry.cursor,
        legacyRemaining: registry.legacyRemaining,
        processed: 0,
        stage: "verify" as const,
        status: "running" as const,
      };
    }
    if (!registry) {
      const id = await ctx.db.insert("dataMigrationRegistry", {
        converted: 0,
        cursor: null,
        key: TRAVEL_BATCH_SUMMARY_MIGRATION_KEY,
        legacyRemaining: 0,
        processed: 0,
        stage: "backfill",
        startedAt: now,
        status: "running",
        updatedAt: now,
      });
      registry = await ctx.db.get(id);
    } else if (registry.status === "failed") {
      await ctx.db.patch(registry._id, {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        stage: "backfill",
        startedAt: now,
        status: "running",
        updatedAt: now,
        verifiedAt: undefined,
      });
      registry = await ctx.db.get(registry._id);
    }
    if (!registry) {
      throw new ConvexError("Unable to initialize Travel Batch summary migration");
    }

    const page = await ctx.db
      .query("jobCards")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: limit });
    const patches = page.page.flatMap((job) => {
      const summaries = (job.travelBatchSummaries ?? []) as TransitionalTravelBatchSummary[];
      if (summaries.length === 0) {
        return [];
      }
      assertRecognizedTravelBatchSummaries(summaries);
      return [
        {
          id: job._id,
          value: {
            travelBatchCount: Math.max(
              job.travelBatchCount ?? 0,
              travelBatchCountFromSummaries(summaries)
            ),
            travelBatchSummaries: undefined,
            updatedAt: now,
          },
        },
      ];
    });
    await Promise.all(patches.map(({ id, value }) => ctx.db.patch(id, value)));
    const converted = patches.length;
    const stage = page.isDone ? ("verify" as const) : ("backfill" as const);
    const cursor = page.isDone ? null : page.continueCursor;
    await ctx.db.patch(registry._id, {
      converted: registry.converted + converted,
      cursor,
      legacyRemaining: 0,
      processed: page.isDone ? 0 : registry.processed + page.page.length,
      stage,
      status: "running",
      updatedAt: now,
    });
    return {
      converted,
      cursor,
      legacyRemaining: 0,
      processed: page.page.length,
      stage,
      status: "running" as const,
    };
  },
  returns: travelBatchSummaryRegistryResultValidator,
});

export const verifyTravelBatchSummaries = internalMutation({
  args: {
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const registry = await getTravelBatchSummaryMigration(ctx);
    if (!registry) {
      throw new ConvexError("Run the Travel Batch summary backfill first");
    }
    if (registry.status === "verified" && registry.stage === "complete") {
      return {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        stage: "complete" as const,
        status: "verified" as const,
      };
    }
    if (registry.status === "failed" || registry.stage !== "verify") {
      throw new ConvexError("Travel Batch summary backfill is not ready for verification");
    }

    const page = await ctx.db
      .query("jobCards")
      .order("asc")
      .paginate({
        cursor: registry.cursor,
        numItems: boundedTravelBatchSummaryMigrationLimit(args.limit),
      });
    const pageResiduals = page.page.filter(
      (job) => (job.travelBatchSummaries?.length ?? 0) > 0
    ).length;
    const legacyRemaining = registry.legacyRemaining + pageResiduals;
    let status: "failed" | "running" | "verified" = "running";
    if (page.isDone) {
      status = legacyRemaining === 0 ? "verified" : "failed";
    }
    const stage = status === "verified" ? ("complete" as const) : ("verify" as const);
    const cursor = page.isDone ? null : page.continueCursor;
    const now = Date.now();
    await ctx.db.patch(registry._id, {
      cursor,
      legacyRemaining,
      processed: registry.processed + page.page.length,
      stage,
      status,
      updatedAt: now,
      ...(status === "verified" ? { verifiedAt: now } : {}),
    });
    return {
      converted: 0,
      cursor,
      legacyRemaining,
      processed: page.page.length,
      stage,
      status,
    };
  },
  returns: travelBatchSummaryRegistryResultValidator,
});

export const getTravelBatchSummaryMigrationStatus = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const registry = await getTravelBatchSummaryMigration(ctx);
    const status = registry?.status ?? "pending";
    const stage: "backfill" | "complete" | "verify" =
      registry?.stage === "verify" || registry?.stage === "complete" ? registry.stage : "backfill";
    const legacyRemaining = registry?.legacyRemaining ?? 0;
    return {
      converted: registry?.converted ?? 0,
      cursor: registry?.cursor ?? null,
      key: TRAVEL_BATCH_SUMMARY_MIGRATION_KEY,
      legacyRemaining,
      processed: registry?.processed ?? 0,
      stage,
      status,
      updatedAt: registry?.updatedAt ?? 0,
      verified: status === "verified" && stage === "complete" && legacyRemaining === 0,
      verifiedAt: registry?.verifiedAt ?? null,
    };
  },
  returns: travelBatchSummaryRegistryStatusValidator,
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

    if (existing?.status === "verified" && existing.stage === "complete") {
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
    if (
      existing?.status === "running" &&
      (existing.stage === "verifyTravellers" || existing.stage === "verifyRoomingListEntries")
    ) {
      return {
        converted: 0,
        cursor: existing.cursor,
        legacyRemaining: existing.legacyRemaining,
        legacyRoomingRoomTypes: 0,
        legacyTravellerRoomTypes: 0,
        mismatchedTravellers: 0,
        processed: 0,
        roomingEntriesUpdated: 0,
        stage: existing.stage,
        status: "running" as const,
        travellerRoomTypesUpdated: 0,
        travellersUpdated: 0,
      };
    }

    const restarting = existing?.status === "failed";
    let stage =
      !restarting && existing?.stage === "roomingListEntries" ? "roomingListEntries" : "travellers";
    let cursor = restarting ? null : (existing?.cursor ?? null);
    const startedAt = existing?.startedAt ?? now;
    let converted = restarting ? 0 : (existing?.converted ?? 0);
    let processed = restarting ? 0 : (existing?.processed ?? 0);
    let legacyRemaining = restarting ? 0 : (existing?.legacyRemaining ?? 0);
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
    } else if (restarting || existing.status !== "running") {
      await ctx.db.patch(existing._id, {
        ...(restarting
          ? {
              converted: 0,
              cursor: null,
              legacyRemaining: 0,
              processed: 0,
              stage: "travellers",
              startedAt: now,
              verifiedAt: undefined,
            }
          : {}),
        status: "running",
        updatedAt: now,
      });
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
        stage = "verifyTravellers";
        cursor = null;
        legacyRemaining = 0;
        processed = 0;
      }
    } else {
      cursor = page.continueCursor;
    }
    const status = "running" as const;
    const registryPatch = {
      converted,
      cursor,
      legacyRemaining,
      processed,
      stage,
      status,
      updatedAt: now,
    };
    if (registryId) {
      await ctx.db.patch(registryId, registryPatch);
    }

    // A page is intentionally the unit of work. The next call resumes only
    // from the server-owned registry cursor; caller-supplied cursors are not
    // part of this capability.
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

export const verifyRoomTypes = internalMutation({
  args: {
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? ROOM_TYPE_MIGRATION_LIMIT), 1), 100);
    const now = Date.now();
    const registry = await ctx.db
      .query("dataMigrationRegistry")
      .withIndex("by_key", (q) => q.eq("key", ROOM_TYPE_MIGRATION_KEY))
      .unique();
    if (!registry) {
      throw new ConvexError("Run the room-type migration first");
    }
    if (registry.status === "verified" && registry.stage === "complete") {
      return {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
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
    if (registry.status === "failed") {
      throw new ConvexError("Room-type verification found residuals; rerun migration first");
    }
    if (registry.stage !== "verifyTravellers" && registry.stage !== "verifyRoomingListEntries") {
      throw new ConvexError("Room-type migration is not ready for verification");
    }

    let stage = registry.stage;
    const page =
      stage === "verifyTravellers"
        ? await ctx.db
            .query("travellers")
            .order("asc")
            .paginate({ cursor: registry.cursor, numItems: limit })
        : await ctx.db
            .query("roomingListEntries")
            .order("asc")
            .paginate({ cursor: registry.cursor, numItems: limit });
    let legacyTravellerRoomTypes = 0;
    let legacyRoomingRoomTypes = 0;
    let mismatchedTravellers = 0;
    let pageResiduals = 0;
    if (stage === "verifyTravellers") {
      for (const row of page.page) {
        const traveller = row as Doc<"travellers">;
        const legacyRoomType = isLegacyRoomCode(traveller.roomType);
        if (legacyRoomType) {
          legacyTravellerRoomTypes += 1;
        }
        const resolved = resolveTravellerRoomFields(traveller.roomType, traveller.hotelAllocation);
        const mismatch =
          Boolean(resolved.roomType && String(traveller.roomType) !== resolved.roomType) ||
          (resolved.hotelAllocation !== undefined &&
            (traveller.hotelAllocation ?? "") !== resolved.hotelAllocation);
        if (mismatch) {
          mismatchedTravellers += 1;
        }
        if (legacyRoomType || mismatch) {
          pageResiduals += 1;
        }
      }
    } else {
      for (const row of page.page) {
        const entry = row as Doc<"roomingListEntries">;
        if (isLegacyRoomCode(entry.roomType)) {
          legacyRoomingRoomTypes += 1;
          pageResiduals += 1;
        }
      }
    }

    const legacyRemaining = registry.legacyRemaining + pageResiduals;
    let status: "failed" | "running" | "verified" = "running";
    let cursor = page.isDone ? null : page.continueCursor;
    if (page.isDone) {
      if (stage === "verifyTravellers") {
        stage = "verifyRoomingListEntries";
      } else {
        status = legacyRemaining === 0 ? "verified" : "failed";
        if (status === "verified") {
          stage = "complete";
        }
      }
      cursor = null;
    }
    await ctx.db.patch(registry._id, {
      cursor,
      legacyRemaining,
      processed: registry.processed + page.page.length,
      stage,
      status,
      updatedAt: now,
      ...(status === "verified" ? { verifiedAt: now } : {}),
    });
    return {
      converted: 0,
      cursor,
      legacyRemaining,
      legacyRoomingRoomTypes,
      legacyTravellerRoomTypes,
      mismatchedTravellers,
      processed: page.page.length,
      roomingEntriesUpdated: 0,
      stage,
      status,
      travellerRoomTypesUpdated: 0,
      travellersUpdated: 0,
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
      verified:
        status === "verified" && row?.stage === "complete" && (row?.legacyRemaining ?? 0) === 0,
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
