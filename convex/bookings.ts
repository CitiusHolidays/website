import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { assertReferenceNow } from "./crm/referenceTimePolicy";
import {
  projectCustomerJourneyDetail,
  projectCustomerJourneySummary,
  sortCustomerJourneySummaries,
} from "./customerJourneyModel";
import { type BookingTravelerDetail, parseBookingDetails } from "./lib/bookingCheckoutInput";
import {
  authorizedCustomerIdentityIds,
  ensureCanonicalIdentityLink,
  findBookingEntitlement,
  publicAccountId,
  upsertBookingEntitlement,
} from "./lib/customerIdentityAccess";
import { assertPaymentMutationSecret } from "./lib/paymentMutationAuth";
import { deriveRefundState, projectBookingPaymentState } from "./paymentState";
import {
  bookingTransitionResultValidator,
  checkoutClaimResultValidator,
  checkoutResultValidator,
  customerJourneyDetailResultValidator,
  customerJourneySummariesResultValidator,
  myBookingsResultValidator,
  pendingBookingResultValidator,
} from "./publicReturnContracts";

const VALID_CURRENCIES = new Set(["INR", "USD"]);
const CHECKOUT_INTENT_TTL_MS = 10 * 60 * 1000;
const OPAQUE_CHECKOUT_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

const getIdentity = async (ctx: QueryCtx | MutationCtx) => await ctx.auth.getUserIdentity();

const getIdentityOrThrow = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await getIdentity(ctx);
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
};

const resolveTrip = async (
  ctx: QueryCtx | MutationCtx,
  tripIdentifier: string
): Promise<Doc<"trips"> | null> => {
  const normalizedTripId = ctx.db.normalizeId("trips", tripIdentifier);
  if (normalizedTripId) {
    const trip = await ctx.db.get("trips", normalizedTripId);
    if (trip) {
      return trip;
    }
  }

  const byLegacyId = await ctx.db
    .query("trips")
    .withIndex("by_legacyTripId", (q) => q.eq("legacyTripId", tripIdentifier))
    .unique();
  if (byLegacyId) {
    return byLegacyId;
  }

  return await ctx.db
    .query("trips")
    .withIndex("by_slug", (q) => q.eq("slug", tripIdentifier))
    .unique();
};

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

const toApiBooking = (booking: Doc<"bookings">) => ({
  confirmedAt: booking.confirmedAt ? new Date(booking.confirmedAt).toISOString() : null,
  createdAt: new Date(booking.createdAt).toISOString(),
  currency: booking.currency,
  id: booking._id,
  notes: booking.notes ?? null,
  razorpayOrderId: booking.razorpayOrderId,
  razorpayPaymentId: booking.razorpayPaymentId,
  razorpaySignature: booking.razorpaySignature ?? null,
  status: booking.status,
  totalAmount: booking.totalAmount,
  travelerDetails: booking.travelerDetails ?? null,
  travelers: booking.travelers,
  tripId: booking.tripId,
  updatedAt: new Date(booking.updatedAt).toISOString(),
  userId: booking.userId,
});

// Keep customer reads allow-listed. Payment-provider identifiers, internal
// notes, traveler details, and auth ownership never cross the public boundary.
export const toCustomerBooking = (booking: Doc<"bookings">) => ({
  confirmedAt: booking.confirmedAt ? new Date(booking.confirmedAt).toISOString() : null,
  createdAt: new Date(booking.createdAt).toISOString(),
  currency: booking.currency,
  id: booking._id,
  status: booking.status,
  totalAmount: booking.totalAmount,
  travelers: booking.travelers,
  tripId: booking.tripId,
  updatedAt: new Date(booking.updatedAt).toISOString(),
});

const getUserProfile = async (ctx: QueryCtx | MutationCtx, authUserId: string) =>
  await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();

async function getAuthorizedUserProfile(ctx: QueryCtx | MutationCtx, identity: UserIdentity) {
  const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
  const profiles = await Promise.all(
    identityIds.map((authUserId) => getUserProfile(ctx, authUserId))
  );
  return profiles.find(Boolean) ?? null;
}

async function loadAuthorizedBookings(ctx: QueryCtx, identity: UserIdentity) {
  const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
  const [legacyPages, entitlementPages] = await Promise.all([
    Promise.all(
      identityIds.map((authUserId) =>
        ctx.db
          .query("bookings")
          .withIndex("by_userId_createdAt", (q) => q.eq("userId", authUserId))
          .order("desc")
          .take(100)
      )
    ),
    Promise.all(
      identityIds.map((authUserId) =>
        ctx.db
          .query("customerJourneyEntitlements")
          .withIndex("by_authUserId_createdAt", (q) => q.eq("authUserId", authUserId))
          .order("desc")
          .take(100)
      )
    ),
  ]);
  const entitlementRows = entitlementPages
    .flat()
    .filter(
      (row): row is Doc<"customerJourneyEntitlements"> & { bookingId: Id<"bookings"> } =>
        row.bookingId !== undefined
    );
  const entitlementBookingIds = [
    ...new Set(entitlementRows.map((entitlement) => entitlement.bookingId)),
  ];
  const entitledBookings = await Promise.all(
    entitlementBookingIds.map((bookingId) => ctx.db.get("bookings", bookingId))
  );
  const candidateBookings = new Map(
    [...legacyPages.flat(), ...entitledBookings.filter((booking) => booking !== null)].map(
      (booking) => [String(booking._id), booking] as const
    )
  );
  const decisions = await Promise.all(
    [...candidateBookings.values()].map(async (booking) => ({
      booking,
      entitlement: await findBookingEntitlement(ctx, identityIds, booking),
    }))
  );
  return decisions
    .filter(
      (entry): entry is typeof entry & { entitlement: NonNullable<typeof entry.entitlement> } =>
        entry.entitlement !== null
    )
    .sort(
      (left, right) =>
        right.booking.createdAt - left.booking.createdAt ||
        String(right.booking._id).localeCompare(String(left.booking._id))
    )
    .slice(0, 100)
    .map(({ booking, entitlement }) => ({ booking, entitlement }));
}

const ensureValidCheckoutArgs = (travelers: number, currency: string) => {
  if (!Number.isSafeInteger(travelers) || travelers < 1 || travelers > 10) {
    throw new ConvexError("Traveler count must be between 1 and 10");
  }
  if (!VALID_CURRENCIES.has(currency)) {
    throw new ConvexError("Unsupported currency");
  }
};

const getBookingsByOrderId = async (ctx: QueryCtx | MutationCtx, orderId: string) =>
  await ctx.db
    .query("bookings")
    .withIndex("by_razorpayOrderId", (q) => q.eq("razorpayOrderId", orderId))
    .take(2);

const getBookingsByPaymentId = async (ctx: QueryCtx | MutationCtx, paymentId: string) =>
  await ctx.db
    .query("bookings")
    .withIndex("by_razorpayPaymentId", (q) => q.eq("razorpayPaymentId", paymentId))
    .take(2);

function checkoutReceipt(intentId: Id<"bookingCheckoutIntents">) {
  const suffix = String(intentId)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-32);
  if (suffix.length < 8) {
    throw new ConvexError("Unable to create checkout receipt");
  }
  return `rcpt_${suffix}`;
}

function opaqueCheckoutKey(value: string, label: string) {
  const normalized = value.trim();
  if (!OPAQUE_CHECKOUT_KEY_PATTERN.test(normalized)) {
    throw new ConvexError(`${label} must be an opaque 16 to 128 character key`);
  }
  return normalized;
}

function assertMatchingCheckoutFacts(
  intent: Doc<"bookingCheckoutIntents">,
  args: { checkoutFactsHash: string; currency: string; travelers: number },
  tripId: Id<"trips">
) {
  if (
    intent.checkoutFactsHash !== args.checkoutFactsHash ||
    intent.currency !== args.currency ||
    intent.travelers !== args.travelers ||
    intent.tripId !== tripId
  ) {
    throw new ConvexError("Checkout idempotency key was reused for different facts");
  }
}

async function checkoutIntentResult(
  intent: Doc<"bookingCheckoutIntents">,
  identity: UserIdentity,
  profile: Doc<"userProfiles"> | null,
  trip: Doc<"trips">
) {
  return {
    checkoutIntentId: intent._id,
    currency: intent.currency,
    expiresAt: intent.expiresAt,
    intentStatus: intent.status,
    pricePerPerson: intent.amount / intent.travelers,
    receipt: intent.receipt,
    totalAmount: intent.amount,
    travelers: intent.travelers,
    trip: toApiTrip(trip),
    user: {
      email: profile?.email ?? identity.email ?? "",
      id: await publicAccountId(identity, profile?._id),
      name: profile?.name ?? identity.name ?? "Traveler",
      phoneNumber: profile?.phoneNumber ?? "",
    },
  };
}

export async function prepareCheckoutHandler(
  ctx: MutationCtx,
  args: {
    currency: string;
    checkoutFactsHash: string;
    idempotencyKey: string;
    travelers: number;
    tripIdentifier: string;
  },
  timestamp = Date.now()
) {
  const identity = await getIdentityOrThrow(ctx);
  const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
  ensureValidCheckoutArgs(args.travelers, args.currency);
  const idempotencyKey = opaqueCheckoutKey(args.idempotencyKey, "Checkout idempotency key");
  const checkoutFactsHash = opaqueCheckoutKey(args.checkoutFactsHash, "Checkout facts hash");

  const trip = await resolveTrip(ctx, args.tripIdentifier);
  if (!trip) {
    throw new ConvexError("Trip not found or inactive");
  }
  const existingIntents = await ctx.db
    .query("bookingCheckoutIntents")
    .withIndex("by_authUserId_idempotencyKey", (q) =>
      q.eq("authUserId", authUserId).eq("idempotencyKey", idempotencyKey)
    )
    .take(2);
  if (existingIntents.length > 1) {
    throw new ConvexError("Checkout idempotency key is ambiguous");
  }
  const profile = await getAuthorizedUserProfile(ctx, identity);
  const [existingIntent] = existingIntents;
  if (existingIntent) {
    assertMatchingCheckoutFacts(existingIntent, args, trip._id);
    if (existingIntent.status === "prepared" && timestamp >= existingIntent.expiresAt) {
      throw new ConvexError("Checkout intent has expired");
    }
    return await checkoutIntentResult(existingIntent, identity, profile, trip);
  }
  if (!trip.isActive) {
    throw new ConvexError("Trip not found or inactive");
  }
  if (trip.availableSeats < args.travelers) {
    throw new ConvexError(`Only ${trip.availableSeats} seats available`);
  }

  const pricePerPerson = args.currency === "INR" ? trip.priceInr : trip.priceUsd;
  const totalAmount = pricePerPerson * args.travelers;
  if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
    throw new ConvexError("Trip price is not valid for checkout");
  }

  const checkoutIntentId = await ctx.db.insert("bookingCheckoutIntents", {
    accountHolderProfileId: profile?._id,
    amount: totalAmount,
    authUserId,
    checkoutFactsHash,
    createdAt: timestamp,
    currency: args.currency,
    expiresAt: timestamp + CHECKOUT_INTENT_TTL_MS,
    idempotencyKey,
    receipt: "",
    status: "prepared",
    travelers: args.travelers,
    tripId: trip._id,
    updatedAt: timestamp,
  });
  const receipt = checkoutReceipt(checkoutIntentId);
  await ctx.db.patch("bookingCheckoutIntents", checkoutIntentId, { receipt });

  const intent = await ctx.db.get("bookingCheckoutIntents", checkoutIntentId);
  if (!intent) {
    throw new ConvexError("Unable to prepare checkout intent");
  }
  return await checkoutIntentResult(intent, identity, profile, trip);
}

export const prepareCheckout = mutation({
  args: {
    checkoutFactsHash: v.string(),
    currency: v.string(),
    idempotencyKey: v.string(),
    travelers: v.number(),
    tripIdentifier: v.string(),
  },
  handler: prepareCheckoutHandler,
  returns: checkoutResultValidator,
});

interface ProviderOrderAttestation {
  amount: number;
  currency: string;
  id: string;
  receipt: string;
}

interface ConsumeCheckoutIntentArgs {
  checkoutIntentId: Id<"bookingCheckoutIntents">;
  notes?: string;
  providerClaimId: string;
  providerOrder: ProviderOrderAttestation;
  travelerDetails?: BookingTravelerDetail[] | null;
}

interface ClaimCheckoutIntentArgs {
  checkoutIntentId: Id<"bookingCheckoutIntents">;
  providerClaimId: string;
}

function assertProviderOrderMatchesIntent(
  intent: Doc<"bookingCheckoutIntents">,
  providerOrder: ProviderOrderAttestation
) {
  if (
    !providerOrder.id.trim() ||
    providerOrder.id.length > 128 ||
    providerOrder.amount !== intent.amount ||
    providerOrder.currency !== intent.currency ||
    providerOrder.receipt !== intent.receipt
  ) {
    throw new ConvexError("Provider order does not match the checkout intent");
  }
}

async function pendingBookingResult(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  checkoutIntentId: Id<"bookingCheckoutIntents">
) {
  const trip = await ctx.db.get("trips", booking.tripId);
  if (!trip) {
    throw new ConvexError("Trip not found for checkout intent");
  }
  return {
    booking: { id: booking._id, status: "pending" as const },
    checkoutIntentId,
    currency: booking.currency,
    totalAmount: booking.totalAmount,
    trip: toApiTrip(trip),
  };
}

export async function claimCheckoutIntent(
  ctx: MutationCtx,
  args: ClaimCheckoutIntentArgs,
  authUserId: string,
  timestamp = Date.now()
) {
  const providerClaimId = opaqueCheckoutKey(args.providerClaimId, "Provider checkout claim");
  const intent = await ctx.db.get("bookingCheckoutIntents", args.checkoutIntentId);
  if (!intent || intent.authUserId !== authUserId) {
    throw new ConvexError("Checkout intent is not available");
  }
  if (intent.status === "consumed") {
    if (!(intent.bookingId && intent.providerOrderId)) {
      throw new ConvexError("Consumed checkout intent is incomplete");
    }
    const booking = await ctx.db.get("bookings", intent.bookingId);
    if (!booking || booking.userId !== authUserId) {
      throw new ConvexError("Checkout intent booking is unavailable");
    }
    return {
      booking: { id: booking._id, status: booking.status },
      providerOrder: {
        amount: intent.amount,
        currency: intent.currency,
        id: intent.providerOrderId,
        receipt: intent.receipt,
      },
      state: "consumed" as const,
    };
  }
  if (intent.status === "provider_creating") {
    return {
      state:
        intent.providerClaimId === providerClaimId
          ? ("claimed" as const)
          : ("in_progress" as const),
    };
  }
  if (timestamp >= intent.expiresAt) {
    throw new ConvexError("Checkout intent has expired");
  }

  const trip = await ctx.db.get("trips", intent.tripId);
  if (!trip?.isActive) {
    throw new ConvexError("Trip not found or inactive");
  }
  if (trip.availableSeats < intent.travelers) {
    throw new ConvexError(`Only ${trip.availableSeats} seats available`);
  }
  await ctx.db.patch("bookingCheckoutIntents", intent._id, {
    providerClaimId,
    status: "provider_creating",
    updatedAt: timestamp,
  });
  return { state: "claimed" as const };
}

export async function claimCheckoutIntentHandler(ctx: MutationCtx, args: ClaimCheckoutIntentArgs) {
  const identity = await getIdentityOrThrow(ctx);
  const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
  return await claimCheckoutIntent(ctx, args, authUserId);
}

export const claimCheckoutIntentForOrder = mutation({
  args: {
    checkoutIntentId: v.id("bookingCheckoutIntents"),
    providerClaimId: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const { serverSecret, ...claimArgs } = args;
    assertPaymentMutationSecret(serverSecret);
    return await claimCheckoutIntentHandler(ctx, claimArgs);
  },
  returns: checkoutClaimResultValidator,
});

export async function consumeCheckoutIntent(
  ctx: MutationCtx,
  args: ConsumeCheckoutIntentArgs,
  authUserId: string,
  timestamp = Date.now()
) {
  const intent = await ctx.db.get("bookingCheckoutIntents", args.checkoutIntentId);
  if (!intent || intent.authUserId !== authUserId) {
    throw new ConvexError("Checkout intent is not available");
  }
  const bookingDetails = parseBookingDetails(
    args.notes ?? "",
    args.travelerDetails ?? [],
    intent.travelers
  );
  if (!bookingDetails.ok) {
    throw new ConvexError("Invalid booking details");
  }
  assertProviderOrderMatchesIntent(intent, args.providerOrder);

  if (intent.status === "consumed") {
    if (intent.providerOrderId !== args.providerOrder.id || !intent.bookingId) {
      throw new ConvexError("Checkout intent was already consumed by another provider order");
    }
    const existingBooking = await ctx.db.get("bookings", intent.bookingId);
    if (!existingBooking || existingBooking.userId !== authUserId) {
      throw new ConvexError("Checkout intent booking is unavailable");
    }
    return await pendingBookingResult(ctx, existingBooking, intent._id);
  }
  if (
    intent.status !== "provider_creating" ||
    intent.providerClaimId !== opaqueCheckoutKey(args.providerClaimId, "Provider checkout claim")
  ) {
    throw new ConvexError("Checkout intent is not claimed by this provider request");
  }

  const [orderBookings, orderIntents, trip] = await Promise.all([
    ctx.db
      .query("bookings")
      .withIndex("by_razorpayOrderId", (q) => q.eq("razorpayOrderId", args.providerOrder.id))
      .take(2),
    ctx.db
      .query("bookingCheckoutIntents")
      .withIndex("by_providerOrderId", (q) => q.eq("providerOrderId", args.providerOrder.id))
      .take(2),
    ctx.db.get("trips", intent.tripId),
  ]);
  if (orderBookings.length > 0 || orderIntents.some((row) => row._id !== intent._id)) {
    throw new ConvexError("Provider order is already bound to another checkout");
  }
  if (!trip?.isActive) {
    throw new ConvexError("Trip not found or inactive");
  }
  if (trip.availableSeats < intent.travelers) {
    throw new ConvexError(`Only ${trip.availableSeats} seats available`);
  }

  const bookingId = await ctx.db.insert("bookings", {
    authorizationStatus: "pending",
    authorizedAmount: 0,
    capturedAmount: 0,
    captureStatus: "pending",
    checkoutIntentId: intent._id,
    createdAt: timestamp,
    currency: intent.currency,
    notes: bookingDetails.notes,
    razorpayOrderId: args.providerOrder.id,
    razorpayPaymentId: "",
    reconciliationStatus: "clear",
    refundedAmount: 0,
    refundStatus: "none",
    remainingAmount: intent.amount,
    reservationStatus: "not_reserved",
    status: "pending",
    totalAmount: intent.amount,
    travelerDetails: bookingDetails.travelerDetails,
    travelers: intent.travelers,
    tripId: intent.tripId,
    updatedAt: timestamp,
    userId: authUserId,
  });
  await upsertBookingEntitlement(ctx, {
    authUserId,
    bookingId,
    source: "public_booking_owner",
  });
  await ctx.db.patch("bookingCheckoutIntents", intent._id, {
    bookingId,
    consumedAt: timestamp,
    providerOrderId: args.providerOrder.id,
    status: "consumed",
    updatedAt: timestamp,
  });

  const booking = await ctx.db.get("bookings", bookingId);
  if (!booking) {
    throw new ConvexError("Unable to create booking from checkout intent");
  }
  return await pendingBookingResult(ctx, booking, intent._id);
}

export async function createPendingBookingHandler(
  ctx: MutationCtx,
  args: ConsumeCheckoutIntentArgs
) {
  const identity = await getIdentityOrThrow(ctx);
  const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
  return await consumeCheckoutIntent(ctx, args, authUserId);
}

export const createPendingBooking = mutation({
  args: {
    checkoutIntentId: v.id("bookingCheckoutIntents"),
    notes: v.optional(v.string()),
    providerClaimId: v.string(),
    providerOrder: v.object({
      amount: v.number(),
      currency: v.string(),
      id: v.string(),
      receipt: v.string(),
    }),
    serverSecret: v.string(),
    travelerDetails: v.optional(v.union(v.array(v.object({ fullName: v.string() })), v.null())),
  },
  handler: async (ctx, args) => {
    const { serverSecret, ...checkoutArgs } = args;
    assertPaymentMutationSecret(serverSecret);
    return await createPendingBookingHandler(ctx, checkoutArgs);
  },
  returns: pendingBookingResultValidator,
});

export const getMyBookings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) {
      return [];
    }

    const authorized = await loadAuthorizedBookings(ctx, identity);
    const rows = authorized.map(({ booking }) => booking);

    const trips = await Promise.all(rows.map((booking) => ctx.db.get("trips", booking.tripId)));
    return rows.flatMap((booking, index) => {
      const trip = trips[index];
      if (!trip) {
        return [];
      }
      return [
        {
          booking: toCustomerBooking(booking),
          trip: toApiTrip(trip),
        },
      ];
    });
  },
  returns: myBookingsResultValidator,
});

export const getMyJourneySummaries = query({
  args: { referenceNow: v.number() },
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    const referenceNow = assertReferenceNow(args.referenceNow);
    if (!identity) {
      return { referenceNow, summaries: [] };
    }
    const authorized = await loadAuthorizedBookings(ctx, identity);
    const rows = authorized.map(({ booking }) => booking);
    const trips = await Promise.all(rows.map((booking) => ctx.db.get("trips", booking.tripId)));
    return {
      referenceNow,
      summaries: sortCustomerJourneySummaries(
        authorized.map(({ booking, entitlement }, index) =>
          projectCustomerJourneySummary(booking, trips[index] ?? null, referenceNow, entitlement)
        )
      ),
    };
  },
  returns: customerJourneySummariesResultValidator,
});

export const getMyJourneyDetail = query({
  args: { bookingId: v.id("bookings"), referenceNow: v.number() },
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    if (!identity) {
      return null;
    }
    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking) {
      return null;
    }
    const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
    const entitlement = await findBookingEntitlement(ctx, identityIds, booking);
    if (!entitlement) {
      return null;
    }
    const trip = await ctx.db.get("trips", booking.tripId);
    return projectCustomerJourneyDetail(
      booking,
      trip,
      assertReferenceNow(args.referenceNow),
      entitlement
    );
  },
  returns: customerJourneyDetailResultValidator,
});

type BookingTransition = "authorized" | "confirmed" | "failed" | "refunded";
type PaymentEventOutcome = "accepted" | "ignored" | "review_required" | "unmatched";
type PaymentEventSource = "checkout" | "webhook";
type ProviderRefundStatus = "failed" | "pending" | "processed";

interface BookingTransitionArgs {
  amount?: number;
  currency?: string;
  eventType?: string;
  orderId?: string;
  paymentId?: string;
  providerEventId: string;
  providerStatus?: string;
  reason: string;
  refundId?: string;
  refundStatus?: ProviderRefundStatus;
  signature?: string;
  source?: PaymentEventSource;
  transition: BookingTransition;
}

interface TransitionDecision {
  outcome: PaymentEventOutcome;
  reconciliationReason?: string;
  result: {
    alreadyConfirmed?: boolean;
    booking?: ReturnType<typeof toApiBooking> | null;
    id?: Id<"bookings">;
    ignored?: boolean;
    message?: string;
    status?: Doc<"bookings">["status"];
    success?: boolean;
  };
}

function eventTypeForTransition(args: BookingTransitionArgs) {
  if (args.eventType) {
    return args.eventType;
  }
  switch (args.transition) {
    case "authorized":
      return "payment.authorized";
    case "confirmed":
      return args.source === "checkout" ? "checkout.payment.confirmed" : "payment.captured";
    case "failed":
      return "payment.failed";
    case "refunded":
      return "refund.created";
    default:
      throw new ConvexError("Unsupported booking transition");
  }
}

async function resolveTransitionBooking(ctx: MutationCtx, args: BookingTransitionArgs) {
  if (args.orderId) {
    const orderMatches = await getBookingsByOrderId(ctx, args.orderId);
    if (orderMatches.length !== 1) {
      return {
        booking: null,
        reconciliationReason: orderMatches.length === 0 ? "unmatched_order" : "ambiguous_order",
      };
    }
    const [booking] = orderMatches;
    if (args.paymentId) {
      const paymentMatches = await getBookingsByPaymentId(ctx, args.paymentId);
      if (paymentMatches.some((row) => row._id !== booking?._id)) {
        return { booking: null, reconciliationReason: "payment_identity_collision" };
      }
    }
    return { booking: booking ?? null };
  }
  if (args.paymentId) {
    const paymentMatches = await getBookingsByPaymentId(ctx, args.paymentId);
    if (paymentMatches.length !== 1) {
      return {
        booking: null,
        reconciliationReason:
          paymentMatches.length === 0 ? "unmatched_payment" : "ambiguous_payment",
      };
    }
    return { booking: paymentMatches[0] ?? null };
  }
  throw new ConvexError("A payment order or payment identity is required");
}

async function findPaymentEvent(ctx: MutationCtx, providerEventId: string) {
  return await ctx.db
    .query("bookingPaymentEvents")
    .withIndex("by_providerEventId", (q) => q.eq("providerEventId", providerEventId))
    .unique();
}

function assertMatchingEventIdentity(
  event: Doc<"bookingPaymentEvents">,
  args: BookingTransitionArgs
) {
  const conflicts =
    event.transition !== args.transition ||
    (event.orderId !== undefined && args.orderId !== undefined && event.orderId !== args.orderId) ||
    (event.paymentId !== undefined &&
      args.paymentId !== undefined &&
      event.paymentId !== args.paymentId) ||
    (event.refundId !== undefined &&
      args.refundId !== undefined &&
      event.refundId !== args.refundId) ||
    (event.amount !== undefined && args.amount !== undefined && event.amount !== args.amount) ||
    (event.currency !== undefined &&
      args.currency !== undefined &&
      event.currency !== args.currency) ||
    (event.providerStatus !== undefined &&
      args.providerStatus !== undefined &&
      event.providerStatus !== args.providerStatus) ||
    (event.eventType !== undefined && event.eventType !== eventTypeForTransition(args));
  if (conflicts) {
    throw new ConvexError("Provider event identity was already used for different payment facts");
  }
}

async function recordPaymentEvent(
  ctx: MutationCtx,
  args: BookingTransitionArgs,
  bookingBefore: Doc<"bookings"> | null,
  bookingAfter: Doc<"bookings"> | null,
  outcome: PaymentEventOutcome,
  reconciliationReason?: string
) {
  const stateAfter = bookingAfter ? projectBookingPaymentState(bookingAfter) : null;
  await ctx.db.insert("bookingPaymentEvents", {
    amount: args.amount,
    authorizationStatusAfter: stateAfter?.authorizationStatus,
    bookingId: bookingAfter?._id ?? bookingBefore?._id,
    captureStatusAfter: stateAfter?.captureStatus,
    createdAt: Date.now(),
    currency: args.currency,
    eventType: eventTypeForTransition(args),
    orderId: args.orderId,
    outcome,
    paymentId: args.paymentId,
    providerEventId: args.providerEventId,
    providerStatus: args.providerStatus,
    reason: args.reason,
    reconciliationReason,
    refundedAmountAfter: stateAfter?.refundedAmount,
    refundId: args.refundId,
    refundStatusAfter: stateAfter?.refundStatus,
    reservationStatusAfter: stateAfter?.reservationStatus,
    source: args.source ?? "webhook",
    statusAfter: bookingAfter?.status,
    statusBefore: bookingBefore?.status,
    transition: args.transition,
  });
}

function duplicateTransitionResult(
  event: Doc<"bookingPaymentEvents">,
  booking: Doc<"bookings"> | null,
  transition: BookingTransition
) {
  if (!booking) {
    return {
      duplicateEvent: true,
      message: "Booking not found for this payment event",
      success: false,
    };
  }
  if (transition === "confirmed") {
    return {
      alreadyConfirmed: booking.status === "confirmed",
      booking: toApiBooking(booking),
      duplicateEvent: true,
      ignored: booking.status !== "confirmed",
      status: booking.status,
      success: booking.status === "confirmed",
    };
  }
  if (transition === "authorized") {
    return {
      duplicateEvent: true,
      id: booking._id,
      ignored: event.outcome !== "accepted",
      status: booking.status,
      success: event.outcome === "accepted" || event.outcome === "ignored",
    };
  }
  return {
    duplicateEvent: true,
    id: booking._id,
    ignored: event.outcome !== "accepted",
    status: booking.status,
  };
}

function providerMoney(args: BookingTransitionArgs, booking: Doc<"bookings">) {
  const amount = args.amount ?? booking.totalAmount;
  const currency = args.currency ?? booking.currency;
  const valid =
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount === booking.totalAmount &&
    currency === booking.currency;
  return { amount, currency, valid };
}

async function applyAuthorizedTransition(
  ctx: MutationCtx,
  args: BookingTransitionArgs,
  booking: Doc<"bookings">,
  timestamp: number
): Promise<TransitionDecision> {
  const money = providerMoney(args, booking);
  const paymentState = projectBookingPaymentState(booking);
  const paymentId = args.paymentId ?? booking.razorpayPaymentId;
  const establishedPaymentId =
    paymentState.authorizationStatus === "authorized" ? booking.razorpayPaymentId : "";
  const paymentIdentityMatches = !establishedPaymentId || establishedPaymentId === paymentId;
  if (paymentState.captureStatus === "captured") {
    const sameCapture =
      money.valid && paymentIdentityMatches && paymentState.capturedAmount === money.amount;
    if (sameCapture) {
      return {
        outcome: "ignored",
        result: {
          id: booking._id,
          ignored: true,
          status: booking.status,
          success: true,
        },
      };
    }
    await ctx.db.patch("bookings", booking._id, {
      reconciliationStatus: "review_required",
      updatedAt: timestamp,
    });
    return {
      outcome: "review_required",
      reconciliationReason: "authorization_after_capture_conflict",
      result: {
        id: booking._id,
        ignored: true,
        status: booking.status,
        success: false,
      },
    };
  }
  if (["cancelled", "refunded"].includes(booking.status)) {
    return {
      outcome: "ignored",
      result: { id: booking._id, ignored: true, status: booking.status, success: false },
    };
  }
  if (!(money.valid && paymentIdentityMatches)) {
    await ctx.db.patch("bookings", booking._id, {
      reconciliationStatus: "review_required",
      updatedAt: timestamp,
    });
    return {
      outcome: "review_required",
      reconciliationReason: paymentIdentityMatches
        ? "amount_currency_mismatch"
        : "authorization_payment_identity_conflict",
      result: {
        id: booking._id,
        ignored: true,
        status: booking.status,
        success: false,
      },
    };
  }
  await ctx.db.patch("bookings", booking._id, {
    authorizationStatus: "authorized",
    authorizedAmount: money.amount,
    razorpayPaymentId: paymentId,
    reconciliationStatus:
      booking.reconciliationStatus === "review_required" ? "review_required" : "clear",
    updatedAt: timestamp,
  });
  return {
    outcome: "accepted",
    result: { id: booking._id, status: booking.status, success: true },
  };
}

async function applyFailedTransition(
  ctx: MutationCtx,
  args: BookingTransitionArgs,
  booking: Doc<"bookings">,
  timestamp: number
): Promise<TransitionDecision> {
  const paymentState = projectBookingPaymentState(booking);
  if (booking.status !== "pending" || paymentState.captureStatus === "captured") {
    return {
      outcome: "ignored",
      result: { id: booking._id, ignored: true, status: booking.status },
    };
  }
  await ctx.db.patch("bookings", booking._id, {
    authorizationStatus: "failed",
    captureStatus: "failed",
    razorpayPaymentId: args.paymentId ?? booking.razorpayPaymentId,
    status: "failed",
    updatedAt: timestamp,
  });
  return {
    outcome: "accepted",
    result: { id: booking._id, status: "failed" },
  };
}

async function existingRefundProjection(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  capturedAmount: number,
  paymentId: string
) {
  const rows = await ctx.db
    .query("bookingRefunds")
    .withIndex("by_bookingId_createdAt", (q) => q.eq("bookingId", booking._id))
    .take(101);
  const applicable = rows.filter(
    (refund) => refund.currency === booking.currency && refund.paymentId === paymentId
  );
  return {
    hasInvalidEvidence: applicable.length !== rows.length,
    hasRefundEvidence: rows.length > 0,
    limitExceeded: rows.length > 100,
    state: deriveRefundState(capturedAmount, applicable),
  };
}

async function existingCaptureDecision(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  paymentState: ReturnType<typeof projectBookingPaymentState>,
  money: ReturnType<typeof providerMoney>,
  paymentIdentityMatches: boolean,
  timestamp: number
): Promise<TransitionDecision | null> {
  if (paymentState.captureStatus !== "captured") {
    return null;
  }
  const sameCapture =
    money.valid && paymentIdentityMatches && paymentState.capturedAmount === money.amount;
  if (!sameCapture) {
    await ctx.db.patch("bookings", booking._id, {
      reconciliationStatus: "review_required",
      updatedAt: timestamp,
    });
    return {
      outcome: "review_required",
      reconciliationReason: "capture_payment_identity_conflict",
      result: {
        id: booking._id,
        ignored: true,
        message: "Captured payment conflicts with the recorded capture",
        status: booking.status,
        success: false,
      },
    };
  }
  if (paymentState.reservationStatus === "reserved" && booking.status === "confirmed") {
    return {
      outcome: "ignored",
      result: {
        alreadyConfirmed: true,
        booking: toApiBooking(booking),
        status: booking.status,
        success: true,
      },
    };
  }
  await ctx.db.patch("bookings", booking._id, {
    reconciliationStatus: "review_required",
    updatedAt: timestamp,
  });
  return {
    outcome: "review_required",
    reconciliationReason: "captured_without_reservation",
    result: {
      id: booking._id,
      ignored: true,
      message: "Captured payment requires reconciliation",
      status: booking.status,
      success: false,
    },
  };
}

function isTerminalCapture(
  booking: Doc<"bookings">,
  paymentState: ReturnType<typeof projectBookingPaymentState>
) {
  return (
    booking.status === "cancelled" ||
    booking.status === "refunded" ||
    paymentState.reservationStatus === "cancelled"
  );
}

function captureNeedsReview(
  booking: Doc<"bookings">,
  projection: Awaited<ReturnType<typeof existingRefundProjection>>
) {
  return (
    booking.reconciliationStatus === "review_required" ||
    projection.hasRefundEvidence ||
    projection.hasInvalidEvidence ||
    projection.limitExceeded ||
    projection.state.exceedsCapturedAmount ||
    projection.state.hasFailed
  );
}

async function applyConfirmedTransition(
  ctx: MutationCtx,
  args: BookingTransitionArgs,
  booking: Doc<"bookings">,
  timestamp: number
): Promise<TransitionDecision> {
  const money = providerMoney(args, booking);
  const paymentState = projectBookingPaymentState(booking);
  const paymentId = args.paymentId ?? booking.razorpayPaymentId;
  const establishedPaymentId =
    paymentState.authorizationStatus === "authorized" ? booking.razorpayPaymentId : "";
  const paymentIdentityMatches = !establishedPaymentId || establishedPaymentId === paymentId;

  const existingDecision = await existingCaptureDecision(
    ctx,
    booking,
    paymentState,
    money,
    paymentIdentityMatches,
    timestamp
  );
  if (existingDecision) {
    return existingDecision;
  }

  if (!(money.valid && paymentIdentityMatches)) {
    await ctx.db.patch("bookings", booking._id, {
      reconciliationStatus: "review_required",
      updatedAt: timestamp,
    });
    return {
      outcome: "review_required",
      reconciliationReason: paymentIdentityMatches
        ? "amount_currency_mismatch"
        : "capture_payment_identity_conflict",
      result: {
        id: booking._id,
        ignored: true,
        message: "Captured payment requires reconciliation",
        status: booking.status,
        success: false,
      },
    };
  }

  const refundProjection = await existingRefundProjection(ctx, booking, money.amount, paymentId);
  const capturedPatch = {
    authorizationStatus: "authorized" as const,
    authorizedAmount: money.amount,
    capturedAmount: money.amount,
    captureStatus: "captured" as const,
    razorpayPaymentId: paymentId,
    razorpaySignature: args.signature ?? booking.razorpaySignature,
    refundedAmount: refundProjection.state.processedAmount,
    refundStatus: refundProjection.state.status,
    remainingAmount: refundProjection.state.remainingAmount,
    updatedAt: timestamp,
  };

  if (isTerminalCapture(booking, paymentState)) {
    await ctx.db.patch("bookings", booking._id, {
      ...capturedPatch,
      reconciliationStatus: "review_required",
    });
    return {
      outcome: "review_required",
      reconciliationReason: "late_capture_after_terminal_booking",
      result: {
        id: booking._id,
        ignored: true,
        message: "Late capture requires reconciliation",
        status: booking.status,
        success: false,
      },
    };
  }

  if (captureNeedsReview(booking, refundProjection)) {
    const bookingStatus =
      refundProjection.state.status === "refunded" ? ("refunded" as const) : booking.status;
    await ctx.db.patch("bookings", booking._id, {
      ...capturedPatch,
      reconciliationStatus: "review_required",
      status: bookingStatus,
    });
    return {
      outcome: "review_required",
      reconciliationReason: refundProjection.hasRefundEvidence
        ? "capture_after_refund_evidence"
        : "capture_requires_existing_reconciliation",
      result: {
        id: booking._id,
        ignored: true,
        message: "Captured payment requires reconciliation",
        status: bookingStatus,
        success: false,
      },
    };
  }

  const trip = await ctx.db.get("trips", booking.tripId);
  if (!trip || trip.availableSeats < booking.travelers) {
    await ctx.db.patch("bookings", booking._id, {
      ...capturedPatch,
      reconciliationStatus: "review_required",
      reservationStatus: "unavailable",
      status: "failed",
    });
    return {
      outcome: "review_required",
      reconciliationReason: trip
        ? "inventory_unavailable_after_capture"
        : "trip_missing_after_capture",
      result: {
        id: booking._id,
        message: "Captured payment requires reconciliation",
        status: "failed",
        success: false,
      },
    };
  }

  await ctx.db.patch("bookings", booking._id, {
    ...capturedPatch,
    confirmedAt: timestamp,
    inventoryDebitedAt: timestamp,
    inventoryDebitedEventId: args.providerEventId,
    reconciliationStatus: "clear",
    reservationStatus: "reserved",
    status: "confirmed",
  });
  await ctx.db.patch("trips", trip._id, {
    availableSeats: trip.availableSeats - booking.travelers,
    updatedAt: timestamp,
  });
  const updated = await ctx.db.get("bookings", booking._id);
  return {
    outcome: "accepted",
    result: {
      alreadyConfirmed: false,
      booking: updated ? toApiBooking(updated) : null,
      status: "confirmed",
      success: true,
    },
  };
}

function normalizedRefundStatus(
  current: ProviderRefundStatus | undefined,
  incoming: ProviderRefundStatus
) {
  if (current === "processed" || current === "failed") {
    return current;
  }
  return incoming;
}

type CompleteRefundFacts = BookingTransitionArgs & {
  amount: number;
  currency: string;
  paymentId: string;
  refundId: string;
  refundStatus: ProviderRefundStatus;
};

function assertCompleteRefundFacts(
  args: BookingTransitionArgs
): asserts args is CompleteRefundFacts {
  if (
    !(args.refundId && args.paymentId && args.refundStatus && args.currency) ||
    args.amount === undefined ||
    !Number.isSafeInteger(args.amount) ||
    args.amount <= 0
  ) {
    throw new ConvexError("Complete refund facts are required");
  }
}

function refundEventOutcome(changed: boolean): PaymentEventOutcome {
  return changed ? "accepted" : "ignored";
}

function refundIdentityConflicts(
  existingRefund: Doc<"bookingRefunds"> | null,
  args: CompleteRefundFacts,
  booking: Doc<"bookings">
) {
  return Boolean(
    existingRefund &&
      (existingRefund.bookingId !== booking._id ||
        existingRefund.paymentId !== args.paymentId ||
        existingRefund.amount !== args.amount ||
        existingRefund.currency !== args.currency)
  );
}

function refundApplicabilityReason(args: CompleteRefundFacts, booking: Doc<"bookings">) {
  if (args.currency !== booking.currency) {
    return "refund_currency_mismatch";
  }
  if (!(booking.razorpayPaymentId && booking.razorpayPaymentId === args.paymentId)) {
    return "refund_payment_identity_conflict";
  }
  return null;
}

async function refundReviewDecision(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  timestamp: number,
  reconciliationReason: string
): Promise<TransitionDecision> {
  await ctx.db.patch("bookings", booking._id, {
    reconciliationStatus: "review_required",
    updatedAt: timestamp,
  });
  return {
    outcome: "review_required",
    reconciliationReason,
    result: {
      id: booking._id,
      ignored: true,
      message: "Refund requires reconciliation",
      status: booking.status,
    },
  };
}

function applicableRefundInputs(
  refunds: Doc<"bookingRefunds">[],
  booking: Doc<"bookings">,
  existingRefund: Doc<"bookingRefunds"> | null,
  refundStatus: ProviderRefundStatus
) {
  return refunds
    .filter(
      (refund) =>
        refund.currency === booking.currency && refund.paymentId === booking.razorpayPaymentId
    )
    .map((refund) =>
      existingRefund && refund._id === existingRefund._id
        ? { amount: refund.amount, status: refundStatus }
        : { amount: refund.amount, status: refund.status }
    );
}

function applicableRefundReconciliationReason(
  paymentState: ReturnType<typeof projectBookingPaymentState>,
  invalidEvidence: boolean,
  refundState: ReturnType<typeof deriveRefundState>
) {
  if (paymentState.captureStatus !== "captured") {
    return "refund_without_capture";
  }
  if (invalidEvidence) {
    return "invalid_refund_evidence_excluded";
  }
  return refundState.hasFailed ? "refund_failed" : undefined;
}

async function applyRefundedTransition(
  ctx: MutationCtx,
  args: BookingTransitionArgs,
  booking: Doc<"bookings">,
  timestamp: number
): Promise<TransitionDecision> {
  assertCompleteRefundFacts(args);
  const existingRefund = await ctx.db
    .query("bookingRefunds")
    .withIndex("by_refundId", (q) => q.eq("refundId", args.refundId))
    .unique();
  if (refundIdentityConflicts(existingRefund, args, booking)) {
    return await refundReviewDecision(ctx, booking, timestamp, "refund_identity_conflict");
  }
  const paymentState = projectBookingPaymentState(booking);
  const applicabilityReason = refundApplicabilityReason(args, booking);
  if (applicabilityReason) {
    return await refundReviewDecision(ctx, booking, timestamp, applicabilityReason);
  }

  const refunds = await ctx.db
    .query("bookingRefunds")
    .withIndex("by_bookingId_createdAt", (q) => q.eq("bookingId", booking._id))
    .take(101);
  const invalidEvidence = refunds.some(
    (refund) =>
      refund.currency !== booking.currency || refund.paymentId !== booking.razorpayPaymentId
  );
  if (refunds.length > 100 || (!existingRefund && refunds.length === 100)) {
    return await refundReviewDecision(ctx, booking, timestamp, "refund_history_limit_exceeded");
  }

  const refundStatus = normalizedRefundStatus(existingRefund?.status, args.refundStatus);
  const applicableRefunds = applicableRefundInputs(refunds, booking, existingRefund, refundStatus);
  if (!existingRefund) {
    applicableRefunds.push({ amount: args.amount, status: refundStatus });
  }
  const projectionBase =
    paymentState.captureStatus === "captured" ? paymentState.capturedAmount : booking.totalAmount;
  const refundState = deriveRefundState(projectionBase, applicableRefunds);
  if (refundState.exceedsCapturedAmount) {
    return await refundReviewDecision(ctx, booking, timestamp, "refund_exceeds_captured_amount");
  }

  if (existingRefund) {
    await ctx.db.patch("bookingRefunds", existingRefund._id, {
      status: refundStatus,
      updatedAt: timestamp,
    });
  } else {
    await ctx.db.insert("bookingRefunds", {
      amount: args.amount,
      bookingId: booking._id,
      createdAt: timestamp,
      currency: args.currency,
      paymentId: args.paymentId,
      refundId: args.refundId,
      status: refundStatus,
      updatedAt: timestamp,
    });
  }

  const requiresReview =
    paymentState.captureStatus !== "captured" || invalidEvidence || refundState.hasFailed;
  const reconciliationStatus =
    booking.reconciliationStatus === "review_required" || requiresReview
      ? "review_required"
      : "clear";
  const bookingStatus = refundState.status === "refunded" ? ("refunded" as const) : booking.status;
  await ctx.db.patch("bookings", booking._id, {
    reconciliationStatus,
    refundedAmount: refundState.processedAmount,
    refundStatus: refundState.status,
    remainingAmount: refundState.remainingAmount,
    status: bookingStatus,
    updatedAt: timestamp,
  });
  const changed = !existingRefund || existingRefund.status !== refundStatus;
  const result: TransitionDecision["result"] = {
    id: booking._id,
    status: bookingStatus,
  };
  if (!changed) {
    result.ignored = true;
  }
  return {
    outcome: requiresReview ? "review_required" : refundEventOutcome(changed),
    reconciliationReason: applicableRefundReconciliationReason(
      paymentState,
      invalidEvidence,
      refundState
    ),
    result,
  };
}

export async function applyBookingPaymentTransition(ctx: MutationCtx, args: BookingTransitionArgs) {
  const providerEventId = args.providerEventId.trim();
  if (!providerEventId) {
    throw new ConvexError("Provider event identity is required");
  }
  const normalizedArgs = { ...args, providerEventId };
  const existingEvent = await findPaymentEvent(ctx, providerEventId);
  if (existingEvent) {
    assertMatchingEventIdentity(existingEvent, normalizedArgs);
    const existingBooking = existingEvent.bookingId
      ? await ctx.db.get("bookings", existingEvent.bookingId)
      : null;
    return duplicateTransitionResult(existingEvent, existingBooking, args.transition);
  }

  const resolution = await resolveTransitionBooking(ctx, normalizedArgs);
  if (!resolution.booking) {
    await recordPaymentEvent(
      ctx,
      normalizedArgs,
      null,
      null,
      "unmatched",
      resolution.reconciliationReason
    );
    return { message: "Booking not found for this payment event", success: false };
  }

  const bookingBefore = resolution.booking;
  const timestamp = Date.now();
  let decision: TransitionDecision;
  switch (normalizedArgs.transition) {
    case "authorized":
      decision = await applyAuthorizedTransition(ctx, normalizedArgs, bookingBefore, timestamp);
      break;
    case "failed":
      decision = await applyFailedTransition(ctx, normalizedArgs, bookingBefore, timestamp);
      break;
    case "refunded":
      decision = await applyRefundedTransition(ctx, normalizedArgs, bookingBefore, timestamp);
      break;
    case "confirmed":
      decision = await applyConfirmedTransition(ctx, normalizedArgs, bookingBefore, timestamp);
      break;
    default:
      throw new ConvexError("Unsupported booking transition");
  }
  const bookingAfter = await ctx.db.get("bookings", bookingBefore._id);
  await recordPaymentEvent(
    ctx,
    normalizedArgs,
    bookingBefore,
    bookingAfter,
    decision.outcome,
    decision.reconciliationReason
  );
  return decision.result;
}

export const confirmBookingByOrderIdHandler = async (
  ctx: MutationCtx,
  args: Omit<BookingTransitionArgs, "transition">
) => await applyBookingPaymentTransition(ctx, { ...args, transition: "confirmed" });

const paymentSourceValidator = v.optional(v.union(v.literal("checkout"), v.literal("webhook")));

export const confirmBookingByOrderId = mutation({
  args: {
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    eventType: v.optional(v.string()),
    orderId: v.string(),
    paymentId: v.string(),
    providerEventId: v.string(),
    providerStatus: v.optional(v.string()),
    reason: v.string(),
    serverSecret: v.string(),
    signature: v.optional(v.string()),
    source: paymentSourceValidator,
  },
  handler: async (ctx, args) => {
    const { serverSecret, ...transitionArgs } = args;
    assertPaymentMutationSecret(serverSecret);
    return await confirmBookingByOrderIdHandler(ctx, transitionArgs);
  },
  returns: bookingTransitionResultValidator,
});

export const recordPaymentAuthorizedHandler = async (
  ctx: MutationCtx,
  args: Omit<BookingTransitionArgs, "transition">
) => await applyBookingPaymentTransition(ctx, { ...args, transition: "authorized" });

export const recordPaymentAuthorized = mutation({
  args: {
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    eventType: v.optional(v.string()),
    orderId: v.string(),
    paymentId: v.string(),
    providerEventId: v.string(),
    providerStatus: v.optional(v.string()),
    reason: v.string(),
    serverSecret: v.string(),
    source: paymentSourceValidator,
  },
  handler: async (ctx, args) => {
    const { serverSecret, ...transitionArgs } = args;
    assertPaymentMutationSecret(serverSecret);
    return await recordPaymentAuthorizedHandler(ctx, transitionArgs);
  },
  returns: bookingTransitionResultValidator,
});

export const markPaymentFailedByOrderIdHandler = async (
  ctx: MutationCtx,
  args: Omit<BookingTransitionArgs, "transition">
) => await applyBookingPaymentTransition(ctx, { ...args, transition: "failed" });

export const markPaymentFailedByOrderId = mutation({
  args: {
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    eventType: v.optional(v.string()),
    orderId: v.string(),
    paymentId: v.optional(v.string()),
    providerEventId: v.string(),
    providerStatus: v.optional(v.string()),
    reason: v.string(),
    serverSecret: v.string(),
    source: paymentSourceValidator,
  },
  handler: async (ctx, args) => {
    const { serverSecret, ...transitionArgs } = args;
    assertPaymentMutationSecret(serverSecret);
    return await markPaymentFailedByOrderIdHandler(ctx, transitionArgs);
  },
  returns: bookingTransitionResultValidator,
});

export const markRefundedByPaymentIdHandler = async (
  ctx: MutationCtx,
  args: Omit<BookingTransitionArgs, "transition">
) => await applyBookingPaymentTransition(ctx, { ...args, transition: "refunded" });

export const markRefundedByPaymentId = mutation({
  args: {
    amount: v.number(),
    currency: v.string(),
    eventType: v.optional(v.string()),
    paymentId: v.string(),
    providerEventId: v.string(),
    providerStatus: v.optional(v.string()),
    reason: v.string(),
    refundId: v.string(),
    refundStatus: v.union(v.literal("failed"), v.literal("pending"), v.literal("processed")),
    serverSecret: v.string(),
    source: paymentSourceValidator,
  },
  handler: async (ctx, args) => {
    const { serverSecret, ...transitionArgs } = args;
    assertPaymentMutationSecret(serverSecret);
    return await markRefundedByPaymentIdHandler(ctx, transitionArgs);
  },
  returns: bookingTransitionResultValidator,
});
