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
import type { RuntimeValue } from "./lib/runtimeValues";
import { propertiesWhen } from "./lib/runtimeValues";
import {
  refreshExistingSacredBharatLeaderboardSummaries,
  refreshSacredBharatLeaderboardSummary,
  SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY,
} from "./lib/sacredBharatLeaderboard";
import { assertMigrationSecret } from "./migrationAuth";
import {
  migrationImportSummaryValidator,
  migrationStatsResultValidator,
  travelBatchAuditResultValidator,
  travelBatchMigrationResultValidator,
} from "./publicReturnContracts";
import {
  auditTravelBatchSummariesHandler,
  backfillTravelBatchSummariesHandler,
  getTravelBatchSummaryMigrationStatusHandler,
  migrateTravelBatchSummariesHandler,
  travelBatchSummaryRegistryResultValidator,
  travelBatchSummaryRegistryStatusValidator,
  verifyTravelBatchSummariesHandler,
} from "./travelBatchSummaryMigration";

const toTimestamp = (value: RuntimeValue, fallback = Date.now()) => {
  if (!value) {
    return fallback;
  }
  // SAFETY: callers guard migration date inputs to the Date constructor's supported runtime values.
  const asDate = new Date(value as string | number | Date);
  const asMillis = asDate.getTime();
  return Number.isNaN(asMillis) ? fallback : asMillis;
};

const ROOM_TYPE_MIGRATION_KEY = "room-type-v2";
const ROOM_TYPE_MIGRATION_LIMIT = 100;
const SACRED_BHARAT_LEADERBOARD_MIGRATION_LIMIT = 100;

const migrationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running" as const),
  v.literal("verified" as const),
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
const sacredBharatLeaderboardMigrationResultValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(
    v.literal("backfill" as const),
    v.literal("verify" as const),
    v.literal("complete" as const)
  ),
  status: migrationStatusValidator,
  summariesUpdated: v.number(),
});
const sacredBharatLeaderboardMigrationStatusValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  key: v.string(),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(
    v.literal("backfill"),
    v.literal("verify" as const),
    v.literal("complete" as const)
  ),
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
      registry = await ctx.db.get("dataMigrationRegistry", id);
    } else if (registry.status === "failed") {
      await ctx.db.patch("dataMigrationRegistry", registry._id, {
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
      registry = await ctx.db.get("dataMigrationRegistry", registry._id);
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
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
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
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      cursor,
      legacyRemaining,
      processed: registry.processed + page.page.length,
      stage,
      status,
      updatedAt: timestamp,
      ...propertiesWhen(status === "verified", () => ({ verifiedAt: timestamp })),
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
  handler: auditTravelBatchSummariesHandler,
  returns: travelBatchAuditResultValidator,
});

export const migrateTravelBatchSummaries = internalMutation({
  args: {
    jobCardIds: v.array(v.id("jobCards")),
    secret: v.string(),
  },
  handler: migrateTravelBatchSummariesHandler,
  returns: travelBatchMigrationResultValidator,
});

export const backfillTravelBatchSummaries = internalMutation({
  args: {
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: backfillTravelBatchSummariesHandler,
  returns: travelBatchSummaryRegistryResultValidator,
});

export const verifyTravelBatchSummaries = internalMutation({
  args: {
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: verifyTravelBatchSummariesHandler,
  returns: travelBatchSummaryRegistryResultValidator,
});

export const getTravelBatchSummaryMigrationStatus = internalQuery({
  args: { secret: v.string() },
  handler: getTravelBatchSummaryMigrationStatusHandler,
  returns: travelBatchSummaryRegistryStatusValidator,
});

type BookingStatus = Doc<"bookings">["status"];

const normalizeBookingStatus = (value: RuntimeValue): BookingStatus => {
  const normalized = (value ?? "pending").toString();
  if (
    normalized === "pending" ||
    normalized === "confirmed" ||
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "refunded"
  ) {
    return normalized;
  }
  return "pending";
};

function tripImportPayload(row: any, legacyTripId: string) {
  const isActiveRaw = row.is_active ?? row.isActive ?? 1;
  return {
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
}

async function importTripRow(ctx: MutationCtx, row: any) {
  const legacyTripId = row.id ?? row.trip_id ?? row.tripId;
  if (!legacyTripId) {
    return "skipped";
  }
  const existing = await ctx.db
    .query("trips")
    .withIndex("by_legacyTripId", (q) => q.eq("legacyTripId", legacyTripId))
    .unique();
  const payload = tripImportPayload(row, legacyTripId);
  if (existing) {
    await ctx.db.patch("trips", existing._id, payload);
    return "updated";
  }
  await ctx.db.insert("trips", payload);
  return "imported";
}

function bookingImportPayload(row: any, legacyBookingId: string, tripId: Doc<"trips">["_id"]) {
  return {
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
    tripId,
    updatedAt: toTimestamp(row.updated_at ?? row.updatedAt),
    userId: row.user_id ?? row.userId ?? "",
  };
}

async function importBookingRow(ctx: MutationCtx, row: any) {
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
  const payload = bookingImportPayload(row, legacyBookingId, trip._id);
  if (existing) {
    await ctx.db.patch("bookings", existing._id, payload);
    return "updated";
  }
  await ctx.db.insert("bookings", payload);
  return "imported";
}

type RoomTypeMigrationStage = "roomingListEntries" | "travellers";
type RoomTypeVerificationStage = "verifyRoomingListEntries" | "verifyTravellers";

interface RoomTypePageCounts {
  legacyRoomingRoomTypes: number;
  legacyTravellerRoomTypes: number;
  mismatchedTravellers: number;
  roomingEntriesUpdated: number;
  travellerRoomTypesUpdated: number;
  travellersUpdated: number;
}

const EMPTY_ROOM_TYPE_PAGE_COUNTS: RoomTypePageCounts = {
  legacyRoomingRoomTypes: 0,
  legacyTravellerRoomTypes: 0,
  mismatchedTravellers: 0,
  roomingEntriesUpdated: 0,
  travellerRoomTypesUpdated: 0,
  travellersUpdated: 0,
};

function addRoomTypePageCounts(
  totals: RoomTypePageCounts,
  counts: RoomTypePageCounts
): RoomTypePageCounts {
  return {
    legacyRoomingRoomTypes: totals.legacyRoomingRoomTypes + counts.legacyRoomingRoomTypes,
    legacyTravellerRoomTypes: totals.legacyTravellerRoomTypes + counts.legacyTravellerRoomTypes,
    mismatchedTravellers: totals.mismatchedTravellers + counts.mismatchedTravellers,
    roomingEntriesUpdated: totals.roomingEntriesUpdated + counts.roomingEntriesUpdated,
    travellerRoomTypesUpdated: totals.travellerRoomTypesUpdated + counts.travellerRoomTypesUpdated,
    travellersUpdated: totals.travellersUpdated + counts.travellersUpdated,
  };
}

async function migrateTravellerRoomType(
  ctx: MutationCtx,
  row: Doc<"travellers">,
  now: number
): Promise<RoomTypePageCounts> {
  const legacyTravellerRoomTypes = isLegacyRoomCode(row.roomType) ? 1 : 0;
  const resolved = resolveTravellerRoomFields(row.roomType, row.hotelAllocation);
  const roomTypeMismatch = Boolean(resolved.roomType && String(row.roomType) !== resolved.roomType);
  const hotelAllocationMismatch =
    resolved.hotelAllocation !== undefined &&
    (row.hotelAllocation ?? "") !== resolved.hotelAllocation;
  const patch: Partial<Doc<"travellers">> = {};
  if (roomTypeMismatch) {
    patch.roomType = resolved.roomType;
  }
  if (hotelAllocationMismatch) {
    patch.hotelAllocation = resolved.hotelAllocation;
  }
  if (!(roomTypeMismatch || hotelAllocationMismatch)) {
    return {
      ...EMPTY_ROOM_TYPE_PAGE_COUNTS,
      legacyTravellerRoomTypes,
      mismatchedTravellers: roomTypeMismatch ? 1 : 0,
    };
  }
  patch.updatedAt = now;
  await ctx.db.patch("travellers", row._id, patch);
  return {
    ...EMPTY_ROOM_TYPE_PAGE_COUNTS,
    legacyTravellerRoomTypes,
    mismatchedTravellers: roomTypeMismatch ? 1 : 0,
    travellerRoomTypesUpdated: patch.roomType === undefined ? 0 : 1,
    travellersUpdated: 1,
  };
}

async function migrateRoomingEntryRoomType(
  ctx: MutationCtx,
  row: Doc<"roomingListEntries">,
  now: number
): Promise<RoomTypePageCounts> {
  const legacyRoomingRoomTypes = isLegacyRoomCode(row.roomType) ? 1 : 0;
  const roomType = resolveRoomingEntryRoomType(row.roomType);
  if (!(roomType && String(row.roomType) !== roomType)) {
    return { ...EMPTY_ROOM_TYPE_PAGE_COUNTS, legacyRoomingRoomTypes };
  }
  await ctx.db.patch("roomingListEntries", row._id, { roomType, updatedAt: now });
  return {
    ...EMPTY_ROOM_TYPE_PAGE_COUNTS,
    legacyRoomingRoomTypes,
    roomingEntriesUpdated: 1,
  };
}

async function migrateRoomTypePage(
  ctx: MutationCtx,
  stage: RoomTypeMigrationStage,
  rows: Array<Doc<"roomingListEntries"> | Doc<"travellers">>,
  now: number
) {
  const counts = await Promise.all(
    rows.map((row) => {
      if (stage === "travellers") {
        // SAFETY: the caller's stage selects the travellers query that produced this page.
        return migrateTravellerRoomType(ctx, row as Doc<"travellers">, now);
      }
      // SAFETY: the caller's stage selects the rooming-list query that produced this page.
      return migrateRoomingEntryRoomType(ctx, row as Doc<"roomingListEntries">, now);
    })
  );
  return counts.reduce(addRoomTypePageCounts, EMPTY_ROOM_TYPE_PAGE_COUNTS);
}

function inspectTravellerRoomType(row: Doc<"travellers">): RoomTypePageCounts {
  const legacyRoomType = isLegacyRoomCode(row.roomType);
  const resolved = resolveTravellerRoomFields(row.roomType, row.hotelAllocation);
  const mismatch =
    Boolean(resolved.roomType && String(row.roomType) !== resolved.roomType) ||
    (resolved.hotelAllocation !== undefined &&
      (row.hotelAllocation ?? "") !== resolved.hotelAllocation);
  return {
    ...EMPTY_ROOM_TYPE_PAGE_COUNTS,
    legacyTravellerRoomTypes: legacyRoomType ? 1 : 0,
    mismatchedTravellers: mismatch ? 1 : 0,
  };
}

function inspectRoomTypePage(
  stage: RoomTypeVerificationStage,
  rows: Array<Doc<"roomingListEntries"> | Doc<"travellers">>
) {
  return rows.reduce<RoomTypePageCounts>((counts, row) => {
    if (stage === "verifyTravellers") {
      // SAFETY: the caller's stage selects the travellers query that produced this page.
      return addRoomTypePageCounts(counts, inspectTravellerRoomType(row as Doc<"travellers">));
    }
    // SAFETY: the caller's stage selects the rooming-list query that produced this page.
    const entry = row as Doc<"roomingListEntries">;
    return addRoomTypePageCounts(counts, {
      ...EMPTY_ROOM_TYPE_PAGE_COUNTS,
      legacyRoomingRoomTypes: isLegacyRoomCode(entry.roomType) ? 1 : 0,
    });
  }, EMPTY_ROOM_TYPE_PAGE_COUNTS);
}

function existingRoomTypeMigrationResult(existing: Doc<"dataMigrationRegistry"> | null) {
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
  return null;
}

async function ensureRoomTypeMigrationRegistry(
  ctx: MutationCtx,
  existing: Doc<"dataMigrationRegistry"> | null,
  restarting: boolean,
  stage: RoomTypeMigrationStage,
  startedAt: number,
  now: number
) {
  if (!existing) {
    return await ctx.db.insert("dataMigrationRegistry", {
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
  }
  if (restarting || existing.status !== "running") {
    await ctx.db.patch("dataMigrationRegistry", existing._id, {
      ...propertiesWhen(restarting, () => ({
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        stage: "travellers",
        startedAt: now,
        verifiedAt: undefined,
      })),
      status: "running",
      updatedAt: now,
    });
  }
  return existing._id;
}

function advanceRoomTypeMigrationPage(
  stage: RoomTypeMigrationStage,
  legacyRemaining: number,
  processed: number,
  isDone: boolean,
  continueCursor: string
) {
  if (!isDone) {
    return { cursor: continueCursor, legacyRemaining, processed, stage };
  }
  if (stage === "travellers") {
    return {
      cursor: null,
      legacyRemaining,
      processed,
      stage: "roomingListEntries" as const,
    };
  }
  return {
    cursor: null,
    legacyRemaining: 0,
    processed: 0,
    stage: "verifyTravellers" as const,
  };
}

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
          await ctx.db.patch("userProfiles", existing._id, payload);
          await refreshExistingSacredBharatLeaderboardSummaries(
            ctx,
            [authUserId],
            payload.updatedAt
          );
          return "updated";
        }
        await ctx.db.insert("userProfiles", payload);
        await refreshExistingSacredBharatLeaderboardSummaries(ctx, [authUserId], payload.updatedAt);
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
    const results = await Promise.all(args.rows.map((row) => importTripRow(ctx, row)));

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
    const results = await Promise.all(args.rows.map((row) => importBookingRow(ctx, row)));

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
    const existingResult = existingRoomTypeMigrationResult(existing);
    if (existingResult) {
      return existingResult;
    }

    const restarting = existing?.status === "failed";
    const initialStage =
      !restarting && existing?.stage === "roomingListEntries" ? "roomingListEntries" : "travellers";
    const initialCursor = restarting ? null : (existing?.cursor ?? null);
    const startedAt = existing?.startedAt ?? now;
    let converted = restarting ? 0 : (existing?.converted ?? 0);
    const initialProcessed = restarting ? 0 : (existing?.processed ?? 0);
    const initialLegacyRemaining = restarting ? 0 : (existing?.legacyRemaining ?? 0);
    const registryId = await ensureRoomTypeMigrationRegistry(
      ctx,
      existing,
      restarting,
      initialStage,
      startedAt,
      now
    );

    const page =
      initialStage === "travellers"
        ? await ctx.db
            .query("travellers")
            .order("asc")
            .paginate({ cursor: initialCursor, numItems: limit })
        : await ctx.db
            .query("roomingListEntries")
            .order("asc")
            .paginate({ cursor: initialCursor, numItems: limit });

    const {
      legacyRoomingRoomTypes,
      legacyTravellerRoomTypes,
      mismatchedTravellers,
      roomingEntriesUpdated,
      travellerRoomTypesUpdated,
      travellersUpdated,
    } = await migrateRoomTypePage(ctx, initialStage, page.page, now);
    const pageLegacy = legacyTravellerRoomTypes + legacyRoomingRoomTypes;
    const pageConverted = travellerRoomTypesUpdated + roomingEntriesUpdated;
    converted += pageConverted;
    const pageState = advanceRoomTypeMigrationPage(
      initialStage,
      Math.max(0, initialLegacyRemaining + pageLegacy - pageConverted),
      initialProcessed + page.page.length,
      page.isDone,
      page.continueCursor
    );
    const status = "running" as const;
    const registryPatch = {
      converted,
      ...pageState,
      status,
      updatedAt: now,
    };
    await ctx.db.patch("dataMigrationRegistry", registryId, registryPatch);

    // A page is intentionally the unit of work. The next call resumes only
    // from the server-owned registry cursor; caller-supplied cursors are not
    // part of this capability.
    return {
      converted: pageConverted,
      cursor: pageState.cursor,
      legacyRemaining: pageState.legacyRemaining,
      legacyRoomingRoomTypes,
      legacyTravellerRoomTypes,
      mismatchedTravellers,
      processed: page.page.length,
      roomingEntriesUpdated,
      stage: pageState.stage,
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

    const verificationStage = registry.stage;
    let stage: RoomTypeVerificationStage | "complete" = verificationStage;
    const page =
      verificationStage === "verifyTravellers"
        ? await ctx.db
            .query("travellers")
            .order("asc")
            .paginate({ cursor: registry.cursor, numItems: limit })
        : await ctx.db
            .query("roomingListEntries")
            .order("asc")
            .paginate({ cursor: registry.cursor, numItems: limit });
    const { legacyRoomingRoomTypes, legacyTravellerRoomTypes, mismatchedTravellers } =
      inspectRoomTypePage(verificationStage, page.page);
    const pageResiduals =
      verificationStage === "verifyTravellers"
        ? legacyTravellerRoomTypes + mismatchedTravellers
        : legacyRoomingRoomTypes;

    const legacyRemaining = registry.legacyRemaining + pageResiduals;
    let status: "failed" | "running" | "verified" = "running";
    let cursor = page.isDone ? null : page.continueCursor;
    if (page.isDone) {
      if (verificationStage === "verifyTravellers") {
        stage = "verifyRoomingListEntries";
      } else {
        status = legacyRemaining === 0 ? "verified" : "failed";
        if (status === "verified") {
          stage = "complete";
        }
      }
      cursor = null;
    }
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      cursor,
      legacyRemaining,
      processed: registry.processed + page.page.length,
      stage,
      status,
      updatedAt: now,
      ...propertiesWhen(status === "verified", () => ({ verifiedAt: now })),
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
