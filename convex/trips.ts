import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const toApiTrip = (trip: Doc<"trips">) => ({
  availableSeats: trip.availableSeats,
  coverImage: trip.coverImage ?? "",
  createdAt: new Date(trip.createdAt).toISOString(),
  description: trip.description ?? "",
  difficulty: trip.difficulty ?? "",
  endDate: trip.endDate,
  exclusions: trip.exclusions ?? [],
  gallery: trip.gallery ?? [],
  id: trip._id,
  inclusions: trip.inclusions ?? [],
  isActive: trip.isActive,
  itinerary: trip.itinerary ?? [],
  legacyTripId: trip.legacyTripId ?? null,
  name: trip.name,
  priceInr: trip.priceInr,
  priceUsd: trip.priceUsd,
  slug: trip.slug,
  startDate: trip.startDate,
  totalSeats: trip.totalSeats,
  updatedAt: new Date(trip.updatedAt).toISOString(),
});

const assertTripMutationSecret = (secret: string) => {
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError("UNAUTHORIZED");
  }
};

export const getActiveTrips = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("trips")
      .withIndex("by_isActive_startDate", (q) => q.eq("isActive", true))
      .order("asc")
      .collect();
    return rows.map(toApiTrip);
  },
});

export const getTripBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const trip = await ctx.db
      .query("trips")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return trip ? toApiTrip(trip) : null;
  },
});

export const createTrip = mutation({
  args: {
    coverImage: v.optional(v.string()),
    description: v.optional(v.string()),
    difficulty: v.optional(v.string()),
    endDate: v.string(),
    exclusions: v.optional(v.any()),
    gallery: v.optional(v.any()),
    inclusions: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    itinerary: v.optional(v.any()),
    legacyTripId: v.optional(v.string()),
    name: v.string(),
    priceInr: v.number(),
    priceUsd: v.number(),
    secret: v.string(),
    slug: v.string(),
    startDate: v.string(),
    totalSeats: v.number(),
  },
  handler: async (ctx, args) => {
    assertTripMutationSecret(args.secret);
    const timestamp = Date.now();
    const tripId = await ctx.db.insert("trips", {
      availableSeats: args.totalSeats,
      coverImage: args.coverImage ?? "",
      createdAt: timestamp,
      description: args.description ?? "",
      difficulty: args.difficulty ?? "",
      endDate: args.endDate,
      exclusions: args.exclusions ?? [],
      gallery: args.gallery ?? [],
      inclusions: args.inclusions ?? [],
      isActive: args.isActive ?? true,
      itinerary: args.itinerary ?? [],
      legacyTripId: args.legacyTripId,
      name: args.name,
      priceInr: args.priceInr,
      priceUsd: args.priceUsd,
      slug: args.slug,
      startDate: args.startDate,
      totalSeats: args.totalSeats,
      updatedAt: timestamp,
    });

    const trip = await ctx.db.get(tripId);
    return trip ? toApiTrip(trip) : null;
  },
});
