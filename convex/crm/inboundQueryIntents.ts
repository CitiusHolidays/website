import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { notifyRoles, requireStaff } from "./lib";
import { querySourceValidator } from "./queryValidators";

const inboundSourceValidator = v.union(v.literal("Citius Concierge"), v.literal("Sacred Bharat"));

export const submitIntent = mutation({
  args: {
    clientName: v.string(),
    consent: v.literal(true),
    contactEmail: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    destination: v.optional(v.string()),
    notes: v.optional(v.string()),
    paxCount: v.optional(v.number()),
    source: inboundSourceValidator,
    travelStartDate: v.optional(v.string()),
  },
  returns: v.id("inboundQueryIntents"),
  handler: async (ctx, args) => {
    if (!args.clientName.trim()) {
      throw new Error("Client name is required");
    }
    const now = Date.now();
    const intentId = await ctx.db.insert("inboundQueryIntents", {
      clientName: args.clientName.trim(),
      consentAt: now,
      contactEmail: args.contactEmail?.trim() || undefined,
      contactMobile: args.contactMobile?.trim() || undefined,
      createdAt: now,
      destination: args.destination?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      paxCount: args.paxCount,
      source: args.source,
      status: "pending",
      travelStartDate: args.travelStartDate,
    });
    await ctx.db.insert("crmHandoffEvents", {
      createdAt: now,
      inboundIntentId: intentId,
      source: args.source,
    });
    await notifyRoles(ctx, ["Sales", "Sales Head"], {
      body: `New inbound lead from ${args.source}: ${args.clientName}`,
      entityId: String(intentId),
      entityType: "inboundQueryIntent",
      title: "Qualified inbound query",
    });
    return intentId;
  },
});

export const getPendingIntent = query({
  args: { intentId: v.id("inboundQueryIntents") },
  returns: v.union(
    v.object({
      _id: v.id("inboundQueryIntents"),
      clientName: v.string(),
      contactEmail: v.optional(v.string()),
      contactMobile: v.optional(v.string()),
      destination: v.optional(v.string()),
      notes: v.optional(v.string()),
      paxCount: v.optional(v.number()),
      source: inboundSourceValidator,
      status: v.union(v.literal("pending"), v.literal("converted"), v.literal("dismissed")),
      travelStartDate: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const intent = await ctx.db.get(args.intentId);
    if (!intent || intent.status !== "pending") {
      return null;
    }
    return intent;
  },
});

export const markConverted = mutation({
  args: {
    intentId: v.id("inboundQueryIntents"),
    queryId: v.string(),
    source: querySourceValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const intent = await ctx.db.get(args.intentId);
    if (!intent) {
      throw new Error("Inbound intent not found");
    }
    await ctx.db.patch(args.intentId, {
      convertedQueryId: args.queryId,
      status: "converted",
    });
    const event = await ctx.db
      .query("crmHandoffEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .filter((q) => q.eq(q.field("inboundIntentId"), args.intentId))
      .first();
    if (event) {
      await ctx.db.patch(event._id, { convertedQueryId: args.queryId });
    }
    return null;
  },
});

export const handoffSummary = query({
  args: { sinceMs: v.number() },
  returns: v.object({
    converted: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const events = await ctx.db
      .query("crmHandoffEvents")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", args.sinceMs))
      .collect();
    return {
      converted: events.filter((event) => Boolean(event.convertedQueryId)).length,
      total: events.length,
    };
  },
});
