import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { isAppPilotOn } from "./crm/appPilot";
import { canonicalAuthUserId } from "./lib/authIdentity";
import { destinationCover } from "./lib/customerAppCovers";
import {
  authorizedCustomerIdentityIds,
  ensureCanonicalIdentityLink,
} from "./lib/customerIdentityAccess";
import {
  firstName,
  hashTripInviteToken,
  PARENTAL_CONSENT_TEXT_VERSIONS,
  TRIP_INVITE_ERRORS,
  TRIP_INVITE_TOKEN_PATTERN,
} from "./lib/customerTripInvites";

/**
 * The customer app's read and claim API (ADR 0020). Every read starts from the caller's own
 * Journey Entitlements and shows a trip only while its Job Card's app pilot is on, so a trip
 * appears in the app exactly when Operations press Start pilot. A trip is addressed by its
 * entitlement id, never by a Job Card id, so a guessed id reaches nothing.
 *
 * Travellers see their own Traveller row and the minors who name that row as a guardian
 * (ADR 0018), with status words for documents but never document files, numbers or dates. An
 * operator-granted organizer sees the trip without anyone's documents. No prices are returned.
 */

type Ctx = QueryCtx | MutationCtx;
type Entitlement = Doc<"customerJourneyEntitlements">;

const MAX_ENTITLEMENTS = 100;
const MAX_ANNOUNCEMENTS = 50;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const phaseValidator = v.union(v.literal("upcoming"), v.literal("ongoing"), v.literal("past"));

const coverValidator = v.union(v.null(), v.object({ path: v.string(), placeholder: v.string() }));

const tripSummaryValidator = v.object({
  /** The destination's photo (website path and BlurHash), or null: the app draws a cover. */
  cover: coverValidator,
  destination: v.string(),
  groupName: v.string(),
  jobCode: v.string(),
  minorCount: v.number(),
  phase: phaseValidator,
  role: v.union(v.literal("organizer"), v.literal("traveller")),
  travelEndDate: v.union(v.string(), v.null()),
  travellerName: v.union(v.string(), v.null()),
  travelStartDate: v.union(v.string(), v.null()),
  tripId: v.id("customerJourneyEntitlements"),
});

const consentValidator = v.union(v.literal("granted"), v.literal("withdrawn"), v.literal("none"));

const documentRowValidator = v.object({
  fullName: v.string(),
  isMinor: v.boolean(),
  passportStatus: v.union(v.string(), v.null()),
  ticketStatus: v.union(v.string(), v.null()),
  travellerId: v.id("travellers"),
  visaRequired: v.boolean(),
  visaStatus: v.union(v.string(), v.null()),
});

const tripDetailValidator = v.object({
  announcements: v.array(
    v.object({
      authorName: v.string(),
      body: v.string(),
      id: v.id("fieldAnnouncements"),
      sharedAt: v.number(),
    })
  ),
  contacts: v.array(
    v.object({
      id: v.id("tourManagerAssignments"),
      name: v.string(),
      phone: v.union(v.string(), v.null()),
      reportingInstructions: v.union(v.string(), v.null()),
      scope: v.union(v.literal("trip"), v.literal("group")),
    })
  ),
  documents: v.array(documentRowValidator),
  me: v.union(
    v.null(),
    v.object({
      fullName: v.string(),
      groupCode: v.union(v.string(), v.null()),
      travellerId: v.id("travellers"),
    })
  ),
  minors: v.array(
    v.object({
      consent: consentValidator,
      fullName: v.string(),
      travellerId: v.id("travellers"),
    })
  ),
  plan: v.union(
    v.null(),
    v.object({
      content: v.string(),
      title: v.string(),
      updatedAt: v.number(),
      version: v.number(),
    })
  ),
  trip: tripSummaryValidator,
  updatedAt: v.number(),
});

function istDay(now: number) {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function tripPhase(
  startDate: string | null,
  endDate: string | null,
  referenceNow: number
): "upcoming" | "ongoing" | "past" {
  const today = istDay(referenceNow);
  const start = startDate || null;
  const end = endDate || start;
  if (end && end < today) {
    return "past";
  }
  if (start && start <= today) {
    return "ongoing";
  }
  return "upcoming";
}

async function callerIdentity(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  return identity && canonicalAuthUserId(identity) ? identity : null;
}

function isAppEntitlement(row: Entitlement) {
  return (
    row.revokedAt === undefined &&
    row.role !== "purchaser" &&
    row.capabilities.includes("view_confirmed_trip")
  );
}

async function entitlementJob(ctx: Ctx, row: Entitlement) {
  if (row.jobCardId) {
    return await ctx.db.get("jobCards", row.jobCardId);
  }
  const { queryId } = row;
  if (!queryId) {
    return null;
  }
  return await ctx.db
    .query("jobCards")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .first();
}

async function entitlementTraveller(ctx: Ctx, row: Entitlement, job: Doc<"jobCards">) {
  if (!row.travellerId) {
    return null;
  }
  const traveller = await ctx.db.get("travellers", row.travellerId);
  return traveller && traveller.jobCardId === job._id && !traveller.cancellation ? traveller : null;
}

async function guardedMinors(ctx: Ctx, guardian: Doc<"travellers">) {
  const [first, second] = await Promise.all([
    ctx.db
      .query("travellers")
      .withIndex("by_firstGuardianTravellerId", (q) =>
        q.eq("firstGuardianTravellerId", guardian._id)
      )
      .take(20),
    ctx.db
      .query("travellers")
      .withIndex("by_secondGuardianTravellerId", (q) =>
        q.eq("secondGuardianTravellerId", guardian._id)
      )
      .take(20),
  ]);
  const byId = new Map<Id<"travellers">, Doc<"travellers">>();
  for (const row of [...first, ...second]) {
    if (row.isMinor === true && !row.cancellation && row.jobCardId === guardian.jobCardId) {
      byId.set(row._id, row);
    }
  }
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

async function travelDates(ctx: Ctx, job: Doc<"jobCards">, traveller: Doc<"travellers"> | null) {
  const batch = traveller?.travelBatchId
    ? await ctx.db.get("travelBatches", traveller.travelBatchId)
    : null;
  return {
    batch,
    travelEndDate: batch?.travelEndDate || job.travelEndDate || null,
    travelStartDate: batch?.travelStartDate || job.travelStartDate || null,
  };
}

interface ResolvedTrip {
  dates: Awaited<ReturnType<typeof travelDates>>;
  entitlement: Entitlement;
  job: Doc<"jobCards">;
  minors: Doc<"travellers">[];
  traveller: Doc<"travellers"> | null;
}

async function resolveTrip(ctx: Ctx, entitlement: Entitlement): Promise<ResolvedTrip | null> {
  if (!isAppEntitlement(entitlement)) {
    return null;
  }
  const job = await entitlementJob(ctx, entitlement);
  if (!(job && isAppPilotOn(job))) {
    return null;
  }
  const traveller = await entitlementTraveller(ctx, entitlement, job);
  if (entitlement.travellerId && !traveller) {
    // The invited Traveller row was cancelled or moved: show nothing rather than the whole trip.
    return null;
  }
  const [minors, dates] = await Promise.all([
    traveller ? guardedMinors(ctx, traveller) : Promise.resolve([]),
    travelDates(ctx, job, traveller),
  ]);
  return { dates, entitlement, job, minors, traveller };
}

function summary(trip: ResolvedTrip, referenceNow: number) {
  const { dates, entitlement, job, minors, traveller } = trip;
  const destination = dates.batch?.destination || job.destination || "Destination to follow";
  return {
    cover: destinationCover(destination),
    destination,
    groupName: job.clientName,
    jobCode: job.jobCode,
    minorCount: minors.length,
    phase: tripPhase(dates.travelStartDate, dates.travelEndDate, referenceNow),
    role: entitlement.role === "organizer" ? ("organizer" as const) : ("traveller" as const),
    travelEndDate: dates.travelEndDate,
    travellerName: traveller?.fullName ?? null,
    travelStartDate: dates.travelStartDate,
    tripId: entitlement._id,
  };
}

async function callerEntitlements(ctx: Ctx, identity: UserIdentity) {
  const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
  const pages = await Promise.all(
    identityIds.map((authUserId) =>
      ctx.db
        .query("customerJourneyEntitlements")
        .withIndex("by_authUserId_createdAt", (q) => q.eq("authUserId", authUserId))
        .order("desc")
        .take(MAX_ENTITLEMENTS)
    )
  );
  return { entitlements: pages.flat(), identityIds };
}

/** The caller's trips that are open in the app, newest departure first. Past trips stay listed. */
export const listMyTrips = query({
  args: { referenceNow: v.number() },
  handler: async (ctx, args) => {
    const identity = await callerIdentity(ctx);
    if (!identity) {
      return [];
    }
    const { entitlements } = await callerEntitlements(ctx, identity);
    const resolved = await Promise.all(entitlements.map((row) => resolveTrip(ctx, row)));
    // One row per Job Card; an entitlement naming the caller's own Traveller wins.
    const byJob = new Map<Id<"jobCards">, ResolvedTrip>();
    for (const trip of resolved) {
      if (!trip) {
        continue;
      }
      const current = byJob.get(trip.job._id);
      if (!current || (!current.traveller && trip.traveller)) {
        byJob.set(trip.job._id, trip);
      }
    }
    return [...byJob.values()]
      .map((trip) => summary(trip, args.referenceNow))
      .sort((a, b) => (b.travelStartDate ?? "").localeCompare(a.travelStartDate ?? ""));
  },
  returns: v.array(tripSummaryValidator),
});

async function latestFrozenItinerary(ctx: Ctx, jobCardId: Id<"jobCards">) {
  const rows = await ctx.db
    .query("itineraries")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .take(50);
  return (
    rows
      .filter((row) => row.frozen)
      .sort((a, b) => b.version - a.version || b.updatedAt - a.updatedAt)[0] ?? null
  );
}

async function myConsent(
  ctx: Ctx,
  entitlementId: Id<"customerJourneyEntitlements">,
  minorId: Id<"travellers">
) {
  const rows = await ctx.db
    .query("customerParentalConsents")
    .withIndex("by_minorTravellerId_and_recordedAt", (q) => q.eq("minorTravellerId", minorId))
    .order("desc")
    .take(20);
  return rows.find((row) => row.entitlementId === entitlementId)?.action ?? "none";
}

function documentRow(row: Doc<"travellers">) {
  return {
    fullName: row.fullName,
    isMinor: row.isMinor === true,
    passportStatus: row.passportStatus ?? null,
    ticketStatus: row.ticketStatus ?? null,
    travellerId: row._id,
    visaRequired: row.visaRequired,
    visaStatus: row.visaRequired ? (row.visaStatus ?? null) : null,
  };
}

async function loadOwnTrip(ctx: Ctx, rawTripId: string) {
  const identity = await callerIdentity(ctx);
  if (!identity) {
    return null;
  }
  const tripId = ctx.db.normalizeId("customerJourneyEntitlements", rawTripId);
  const entitlement = tripId ? await ctx.db.get("customerJourneyEntitlements", tripId) : null;
  if (!entitlement) {
    return null;
  }
  const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
  if (!identityIds.includes(entitlement.authUserId)) {
    return null;
  }
  return await resolveTrip(ctx, entitlement);
}

/** One trip: the day plan, the tour managers to call, document status words and announcements. */
export const getMyTrip = query({
  args: { referenceNow: v.number(), tripId: v.string() },
  handler: async (ctx, args) => {
    const trip = await loadOwnTrip(ctx, args.tripId);
    if (!trip) {
      return null;
    }
    const { entitlement, job, minors, traveller } = trip;
    const [itinerary, assignments, announcementRows, consents] = await Promise.all([
      latestFrozenItinerary(ctx, job._id),
      ctx.db
        .query("tourManagerAssignments")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
        .take(50),
      ctx.db
        .query("fieldAnnouncements")
        .withIndex("by_jobCardId_and_sharedAt", (q) => q.eq("jobCardId", job._id))
        .order("desc")
        .take(200),
      Promise.all(minors.map((minor) => myConsent(ctx, entitlement._id, minor._id))),
    ]);
    const myGroup = traveller?.travelBatchId;
    const contacts = assignments
      .filter((row) => row.status === "Assigned")
      .filter((row) => !(traveller && row.travelBatchId) || row.travelBatchId === myGroup)
      .map((row) => ({
        id: row._id,
        name: row.name,
        phone: row.phone?.trim() || null,
        reportingInstructions: row.reportingInstructions?.trim() || null,
        scope: row.travelBatchId ? ("group" as const) : ("trip" as const),
      }));
    const audience = new Set<Id<"travellers">>(
      traveller ? [traveller._id, ...minors.map((minor) => minor._id)] : []
    );
    const announcements = announcementRows
      .filter((row) => !traveller || row.recipientTravellerIds.some((id) => audience.has(id)))
      .slice(0, MAX_ANNOUNCEMENTS)
      .map((row) => ({
        authorName: row.authorName,
        body: row.body,
        id: row._id,
        sharedAt: row.sharedAt,
      }));
    const { batch } = trip.dates;
    return {
      announcements,
      contacts,
      documents: traveller ? [traveller, ...minors].map(documentRow) : [],
      me: traveller
        ? {
            fullName: traveller.fullName,
            groupCode: batch?.batchCode ?? null,
            travellerId: traveller._id,
          }
        : null,
      minors: minors.map((minor, index) => ({
        consent: consents[index] ?? "none",
        fullName: minor.fullName,
        travellerId: minor._id,
      })),
      plan: itinerary
        ? {
            content: itinerary.content ?? "",
            title: itinerary.title,
            updatedAt: itinerary.updatedAt,
            version: itinerary.version,
          }
        : null,
      trip: summary(trip, args.referenceNow),
      updatedAt: Math.max(
        job.updatedAt,
        itinerary?.updatedAt ?? 0,
        announcementRows[0]?.updatedAt ?? 0,
        traveller?.updatedAt ?? 0
      ),
    };
  },
  returns: v.union(v.null(), tripDetailValidator),
});

async function inviteForToken(ctx: Ctx, token: string) {
  if (!TRIP_INVITE_TOKEN_PATTERN.test(token)) {
    return null;
  }
  const tokenHash = await hashTripInviteToken(token);
  return await ctx.db
    .query("customerTripInvites")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .first();
}

/**
 * What an invite link is for, before the traveller accepts it: first names only, and the trip
 * only once it is open in the app. Holding the token is the only way to reach this.
 */
export const previewInvite = query({
  args: { referenceNow: v.number(), token: v.string() },
  handler: async (ctx, args) => {
    const invite = await inviteForToken(ctx, args.token);
    if (!invite) {
      return { status: "invalid" as const };
    }
    const identity = await callerIdentity(ctx);
    const caller = identity ? canonicalAuthUserId(identity) : null;
    if (invite.status === "claimed") {
      return caller && invite.claimedByAuthUserId === caller && invite.entitlementId
        ? { status: "claimed_by_you" as const, tripId: invite.entitlementId }
        : { status: "used" as const };
    }
    if (invite.status === "revoked" || invite.expiresAt <= args.referenceNow) {
      return { status: "expired" as const };
    }
    const [job, traveller] = await Promise.all([
      ctx.db.get("jobCards", invite.jobCardId),
      ctx.db.get("travellers", invite.travellerId),
    ]);
    if (!(job && traveller) || traveller.cancellation || traveller.isMinor === true) {
      return { status: "invalid" as const };
    }
    const [minors, dates] = await Promise.all([
      guardedMinors(ctx, traveller),
      travelDates(ctx, job, traveller),
    ]);
    const open = isAppPilotOn(job);
    return {
      firstName: firstName(traveller.fullName),
      minors: minors.map((minor) => ({
        firstName: firstName(minor.fullName),
        travellerId: minor._id,
      })),
      status: "valid" as const,
      trip: open
        ? {
            cover: destinationCover(dates.batch?.destination || job.destination),
            destination: dates.batch?.destination || job.destination || "Destination to follow",
            travelEndDate: dates.travelEndDate,
            travelStartDate: dates.travelStartDate,
          }
        : null,
    };
  },
  returns: v.union(
    v.object({ status: v.literal("invalid") }),
    v.object({ status: v.literal("expired") }),
    v.object({ status: v.literal("used") }),
    v.object({ status: v.literal("claimed_by_you"), tripId: v.id("customerJourneyEntitlements") }),
    v.object({
      firstName: v.string(),
      minors: v.array(v.object({ firstName: v.string(), travellerId: v.id("travellers") })),
      status: v.literal("valid"),
      trip: v.union(
        v.null(),
        v.object({
          cover: coverValidator,
          destination: v.string(),
          travelEndDate: v.union(v.string(), v.null()),
          travelStartDate: v.union(v.string(), v.null()),
        })
      ),
    })
  ),
});

function requireConsentVersion(version: string) {
  if (!PARENTAL_CONSENT_TEXT_VERSIONS.some((known) => known === version)) {
    throw new ConvexError(TRIP_INVITE_ERRORS.consentVersion);
  }
}

async function recordConsent(
  ctx: MutationCtx,
  input: {
    action: "granted" | "withdrawn";
    authUserId: string;
    entitlement: Entitlement;
    guardian: Doc<"travellers">;
    minor: Doc<"travellers">;
    textVersion: string;
  }
) {
  await ctx.db.insert("customerParentalConsents", {
    action: input.action,
    authUserId: input.authUserId,
    consentTextVersion: input.textVersion,
    entitlementId: input.entitlement._id,
    guardianTravellerId: input.guardian._id,
    jobCardId: input.guardian.jobCardId,
    minorTravellerId: input.minor._id,
    recordedAt: Date.now(),
    source: "guardian_invite",
  });
}

type ClaimLoad =
  | { status: "already_claimed"; tripId: Id<"customerJourneyEntitlements"> }
  | {
      invite: Doc<"customerTripInvites">;
      job: Doc<"jobCards">;
      status: "claimable";
      traveller: Doc<"travellers">;
    };

/** The invite behind a token, if the caller may claim it now. Every refusal is the same error. */
async function loadClaim(ctx: MutationCtx, token: string, authUserId: string): Promise<ClaimLoad> {
  const invite = await inviteForToken(ctx, token);
  if (
    invite?.status === "claimed" &&
    invite.claimedByAuthUserId === authUserId &&
    invite.entitlementId
  ) {
    return { status: "already_claimed", tripId: invite.entitlementId };
  }
  if (!(invite && invite.status === "pending" && invite.expiresAt > Date.now())) {
    throw new ConvexError(TRIP_INVITE_ERRORS.invalid);
  }
  const [job, traveller] = await Promise.all([
    ctx.db.get("jobCards", invite.jobCardId),
    ctx.db.get("travellers", invite.travellerId),
  ]);
  if (!(job && traveller) || traveller.cancellation || traveller.jobCardId !== job._id) {
    throw new ConvexError(TRIP_INVITE_ERRORS.invalid);
  }
  if (traveller.isMinor === true) {
    throw new ConvexError(TRIP_INVITE_ERRORS.minor);
  }
  const others = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
    .take(5);
  if (others.some((row) => row.revokedAt === undefined && row.authUserId !== authUserId)) {
    // Someone else already holds this Traveller's trip; staff resolve it.
    throw new ConvexError(TRIP_INVITE_ERRORS.invalid);
  }
  return { invite, job, status: "claimable", traveller };
}

/**
 * Creates the caller's traveller entitlement for the invited Traveller, or adds the Traveller
 * link to an operator grant they already hold on the same trip (which keeps its role).
 */
async function linkTravellerEntitlement(
  ctx: MutationCtx,
  input: {
    authUserId: string;
    invite: Doc<"customerTripInvites">;
    job: Doc<"jobCards">;
    now: number;
    traveller: Doc<"travellers">;
  }
) {
  const { authUserId, invite, job, now, traveller } = input;
  const mine = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_authUserId_createdAt", (q) => q.eq("authUserId", authUserId))
    .take(MAX_ENTITLEMENTS);
  const sameTrip = await Promise.all(
    mine
      .filter((row) => row.revokedAt === undefined && row.role !== "purchaser")
      .map(async (row) => ((await entitlementJob(ctx, row))?._id === job._id ? row : null))
  );
  const onTrip = sameTrip.filter((row): row is Entitlement => row !== null);
  if (onTrip.some((row) => row.travellerId && row.travellerId !== traveller._id)) {
    throw new ConvexError(TRIP_INVITE_ERRORS.alreadyOnTrip);
  }
  const [existing] = onTrip;
  if (existing) {
    await ctx.db.patch("customerJourneyEntitlements", existing._id, {
      jobCardId: job._id,
      travellerId: traveller._id,
      updatedAt: now,
    });
    return existing._id;
  }
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .first();
  return await ctx.db.insert("customerJourneyEntitlements", {
    accountHolderProfileId: profile?._id,
    authUserId,
    capabilities: ["view_confirmed_trip"],
    confirmedOfferId: job.confirmedOfferId,
    createdAt: now,
    grantedByStaffId: invite.createdByStaffId,
    jobCardId: job._id,
    queryId: job.queryId,
    role: "traveller",
    source: "trip_invite",
    travellerId: traveller._id,
    updatedAt: now,
  });
}

/**
 * Accepts an invite for the signed-in Account Holder. It creates a traveller entitlement naming
 * the invited Traveller row, marks the invite used, and records the guardian's consent tick for
 * each minor they name. Accepting twice with the same account returns the same trip.
 */
export const claimInvite = mutation({
  args: {
    consent: v.optional(
      v.object({ minorTravellerIds: v.array(v.id("travellers")), textVersion: v.string() })
    ),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!(identity && canonicalAuthUserId(identity))) {
      throw new ConvexError(TRIP_INVITE_ERRORS.unauthorized);
    }
    const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
    const claim = await loadClaim(ctx, args.token, authUserId);
    if (claim.status === "already_claimed") {
      return { tripId: claim.tripId };
    }
    const { invite, job, traveller } = claim;
    const now = Date.now();
    const entitlementId = await linkTravellerEntitlement(ctx, {
      authUserId,
      invite,
      job,
      now,
      traveller,
    });
    await ctx.db.patch("customerTripInvites", invite._id, {
      claimedAt: now,
      claimedByAuthUserId: authUserId,
      entitlementId,
      status: "claimed",
      updatedAt: now,
    });
    if (args.consent && args.consent.minorTravellerIds.length > 0) {
      requireConsentVersion(args.consent.textVersion);
      const minors = await guardedMinors(ctx, traveller);
      const entitlement = await ctx.db.get("customerJourneyEntitlements", entitlementId);
      for (const minorId of new Set(args.consent.minorTravellerIds)) {
        const minor = minors.find((row) => row._id === minorId);
        if (!(minor && entitlement)) {
          throw new ConvexError(TRIP_INVITE_ERRORS.consentNotGuardian);
        }
        // biome-ignore lint/performance/noAwaitInLoops: one append-only record per minor, in order
        await recordConsent(ctx, {
          action: "granted",
          authUserId,
          entitlement,
          guardian: traveller,
          minor,
          textVersion: args.consent.textVersion,
        });
      }
    }
    return { tripId: entitlementId };
  },
  returns: v.object({ tripId: v.id("customerJourneyEntitlements") }),
});

/** A guardian gives or withdraws their consent for one minor on the trip; each is a new record. */
export const setParentalConsent = mutation({
  args: {
    action: v.union(v.literal("granted"), v.literal("withdrawn")),
    minorTravellerId: v.id("travellers"),
    textVersion: v.string(),
    tripId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!(identity && canonicalAuthUserId(identity))) {
      throw new ConvexError(TRIP_INVITE_ERRORS.unauthorized);
    }
    const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
    const trip = await loadOwnTrip(ctx, args.tripId);
    const minor = trip?.minors.find((row) => row._id === args.minorTravellerId);
    if (!(trip?.traveller && minor)) {
      throw new ConvexError(TRIP_INVITE_ERRORS.consentNotGuardian);
    }
    requireConsentVersion(args.textVersion);
    if ((await myConsent(ctx, trip.entitlement._id, minor._id)) === args.action) {
      return null;
    }
    await recordConsent(ctx, {
      action: args.action,
      authUserId,
      entitlement: trip.entitlement,
      guardian: trip.traveller,
      minor,
      textVersion: args.textVersion,
    });
    return null;
  },
  returns: v.null(),
});
