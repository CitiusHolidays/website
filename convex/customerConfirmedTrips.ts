import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { canSeeQueryRecord, PERMISSIONS, requireStaff } from "./crm/lib";
import {
  authorizedCustomerIdentityIds,
  upsertConfirmedJourneyEntitlement,
} from "./lib/customerIdentityAccess";

const confirmedTripPacketValidator = v.object({
  confirmedOfferId: v.id("confirmedOffers"),
  confirmedPax: v.number(),
  destination: v.string(),
  entitlement: v.object({
    role: v.union(v.literal("organizer"), v.literal("traveller")),
    source: v.union(v.literal("crm_operator_grant"), v.literal("identity_migration")),
  }),
  itinerary: v.union(
    v.object({ content: v.string(), title: v.string(), version: v.number() }),
    v.null()
  ),
  jobCode: v.union(v.string(), v.null()),
  jobStatus: v.union(v.string(), v.null()),
  queryCode: v.string(),
  readOnly: v.literal(true),
  sellingPricePerPax: v.number(),
  source: v.union(v.string(), v.null()),
  taxRate: v.number(),
  ticketingScope: v.union(v.string(), v.null()),
  travelEndDate: v.string(),
  travelStartDate: v.string(),
});

async function latestFrozenItinerary(ctx: QueryCtx, jobCardId: Id<"jobCards">) {
  const rows = await ctx.db
    .query("itineraries")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .collect();
  return (
    rows
      .filter((row) => row.frozen)
      .sort((left, right) => right.version - left.version || right.updatedAt - left.updatedAt)[0] ??
    null
  );
}

async function packetForQuery(
  ctx: QueryCtx,
  queryRow: Doc<"queries">,
  entitlement: Doc<"customerJourneyEntitlements">
) {
  if (
    !queryRow.confirmedOfferId ||
    entitlement.role === "purchaser" ||
    entitlement.source === "public_booking_owner"
  ) {
    return null;
  }
  const [offer, jobCard] = await Promise.all([
    ctx.db.get("confirmedOffers", queryRow.confirmedOfferId),
    ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryRow._id))
      .first(),
  ]);
  if (!offer) {
    return null;
  }
  const itinerary = jobCard ? await latestFrozenItinerary(ctx, jobCard._id) : null;
  return {
    confirmedOfferId: offer._id,
    confirmedPax: offer.confirmedPax,
    destination: offer.destination ?? queryRow.destination ?? "Destination details to follow",
    entitlement: { role: entitlement.role, source: entitlement.source },
    itinerary: itinerary
      ? { content: itinerary.content ?? "", title: itinerary.title, version: itinerary.version }
      : null,
    jobCode: jobCard?.jobCode ?? null,
    jobStatus: jobCard?.status ?? null,
    queryCode: queryRow.queryCode,
    readOnly: true as const,
    sellingPricePerPax: offer.sellingPricePerPax,
    source: offer.source ?? queryRow.source ?? null,
    taxRate: offer.taxRate ?? 0,
    ticketingScope: queryRow.ticketingScope ?? null,
    travelEndDate: offer.travelEndDate ?? "",
    travelStartDate: offer.travelStartDate,
  };
}

export async function loadConfirmedTripPackets(ctx: QueryCtx, authUserIds: string[]) {
  const pages = await Promise.all(
    authUserIds.map((authUserId) =>
      ctx.db
        .query("customerJourneyEntitlements")
        .withIndex("by_authUserId_createdAt", (q) => q.eq("authUserId", authUserId))
        .order("desc")
        .take(100)
    )
  );
  const entitlements = pages
    .flat()
    .filter(
      (row) =>
        row.revokedAt === undefined &&
        row.queryId !== undefined &&
        row.confirmedOfferId !== undefined &&
        row.capabilities.includes("view_confirmed_trip") &&
        row.role !== "purchaser" &&
        row.source !== "public_booking_owner"
    );
  const queryRows = await Promise.all(
    entitlements.map((row) => ctx.db.get("queries", row.queryId!))
  );
  const packets = await Promise.all(
    entitlements.map((entitlement, index) => {
      const queryRow = queryRows[index];
      return queryRow ? packetForQuery(ctx, queryRow, entitlement) : null;
    })
  );
  return packets
    .filter((packet): packet is NonNullable<typeof packet> => packet !== null)
    .sort((left, right) => right.travelStartDate.localeCompare(left.travelStartDate));
}

export const getMyConfirmedTripPackets = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const authUserIds = await authorizedCustomerIdentityIds(ctx, identity);
    return await loadConfirmedTripPackets(ctx, authUserIds);
  },
  returns: v.array(confirmedTripPacketValidator),
});

export const listAccountHolderOptions = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
    const search = args.search?.trim().toLowerCase() ?? "";
    const rows = await ctx.db.query("userProfiles").order("desc").take(100);
    return rows
      .filter(
        (profile) =>
          !profile.archivedAt &&
          profile.authUserId?.includes("|") &&
          (!search ||
            profile.name.toLowerCase().includes(search) ||
            profile.email.toLowerCase().includes(search))
      )
      .slice(0, 25)
      .map((profile) => ({ email: profile.email, id: profile._id, name: profile.name }));
  },
  returns: v.array(v.object({ email: v.string(), id: v.id("userProfiles"), name: v.string() })),
});

export const grantConfirmedTripEntitlement = mutation({
  args: {
    accountHolderProfileId: v.id("userProfiles"),
    queryId: v.id("queries"),
    role: v.union(v.literal("organizer"), v.literal("traveller")),
  },
  handler: async (ctx: MutationCtx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
    if (!access.staffId) {
      throw new ConvexError("FORBIDDEN");
    }
    const queryRow = await ctx.db.get("queries", args.queryId);
    if (!(queryRow?.confirmedOfferId && canSeeQueryRecord(access, queryRow))) {
      throw new ConvexError("Confirmed Query not found");
    }
    const accountHolder = await ctx.db.get("userProfiles", args.accountHolderProfileId);
    if (!(accountHolder && !accountHolder.archivedAt && accountHolder.authUserId?.includes("|"))) {
      throw new ConvexError("Account Holder not found");
    }
    const entitlementId = await upsertConfirmedJourneyEntitlement(ctx, {
      accountHolderProfileId: accountHolder._id,
      authUserId: accountHolder.authUserId,
      confirmedOfferId: queryRow.confirmedOfferId,
      grantedByStaffId: access.staffId,
      queryId: queryRow._id,
      role: args.role,
    });
    return { entitlementId };
  },
  returns: v.object({ entitlementId: v.id("customerJourneyEntitlements") }),
});
