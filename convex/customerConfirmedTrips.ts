import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";

const confirmedTripPacketValidator = v.object({
  confirmedOfferId: v.id("confirmedOffers"),
  confirmedPax: v.number(),
  destination: v.string(),
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

function normalizedEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

async function queriesForCustomerEmail(ctx: QueryCtx, email: string) {
  // The exact lookup indexes are staged for a safe existing-table rollout. Keep this
  // single-scan fallback until deployment evidence confirms their backfills are complete.
  const [allClients, allIntents, allQueries] = await Promise.all([
    ctx.db.query("clients").collect(),
    ctx.db.query("inboundQueryIntents").collect(),
    ctx.db.query("queries").collect(),
  ]);
  const clientIds = new Set<string>();
  for (const client of allClients) {
    if (client.emailNormalized === email) {
      clientIds.add(String(client._id));
    }
  }
  const convertedQueryIds = new Set<string>();
  for (const intent of allIntents) {
    if (intent.contactEmailNormalized === email && intent.convertedQueryId) {
      convertedQueryIds.add(String(intent.convertedQueryId));
    }
  }
  return allQueries.filter(
    (queryRow) =>
      (queryRow.clientId && clientIds.has(String(queryRow.clientId))) ||
      convertedQueryIds.has(String(queryRow._id))
  );
}

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

async function packetForQuery(ctx: QueryCtx, queryRow: Doc<"queries">) {
  if (!queryRow.confirmedOfferId) {
    return null;
  }
  const [offer, jobCard] = await Promise.all([
    ctx.db.get(queryRow.confirmedOfferId),
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

export async function loadConfirmedTripPackets(ctx: QueryCtx, email: string) {
  const normalized = normalizedEmail(email);
  if (!normalized) {
    return [];
  }
  const queryRows = await queriesForCustomerEmail(ctx, normalized);
  const packets = await Promise.all(queryRows.map((queryRow) => packetForQuery(ctx, queryRow)));
  return packets
    .filter((packet): packet is NonNullable<typeof packet> => packet !== null)
    .sort((left, right) => right.travelStartDate.localeCompare(left.travelStartDate));
}

export const getMyConfirmedTripPackets = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      return [];
    }
    return await loadConfirmedTripPackets(ctx, identity.email);
  },
  returns: v.array(confirmedTripPacketValidator),
});
