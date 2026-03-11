import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

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
  itinerary: trip.itinerary ?? [],
  inclusions: trip.inclusions ?? [],
  exclusions: trip.exclusions ?? [],
  coverImage: trip.coverImage ?? "",
  gallery: trip.gallery ?? [],
  isActive: trip.isActive,
  createdAt: new Date(trip.createdAt).toISOString(),
  updatedAt: new Date(trip.updatedAt).toISOString(),
  legacyTripId: trip.legacyTripId ?? null,
});

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
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    totalSeats: v.number(),
    priceInr: v.number(),
    priceUsd: v.number(),
    difficulty: v.optional(v.string()),
    itinerary: v.optional(v.any()),
    inclusions: v.optional(v.any()),
    exclusions: v.optional(v.any()),
    coverImage: v.optional(v.string()),
    gallery: v.optional(v.any()),
    isActive: v.optional(v.boolean()),
    legacyTripId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const tripId = await ctx.db.insert("trips", {
      name: args.name,
      slug: args.slug,
      description: args.description ?? "",
      startDate: args.startDate,
      endDate: args.endDate,
      totalSeats: args.totalSeats,
      availableSeats: args.totalSeats,
      priceInr: args.priceInr,
      priceUsd: args.priceUsd,
      difficulty: args.difficulty ?? "",
      itinerary: args.itinerary ?? [],
      inclusions: args.inclusions ?? [],
      exclusions: args.exclusions ?? [],
      coverImage: args.coverImage ?? "",
      gallery: args.gallery ?? [],
      isActive: args.isActive ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
      legacyTripId: args.legacyTripId,
    });

    const trip = await ctx.db.get(tripId);
    return trip ? toApiTrip(trip) : null;
  },
});
