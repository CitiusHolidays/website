import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  env,
  internalAction,
  internalMutation,
  type MutationCtx,
  mutation,
  type QueryCtx,
} from "./_generated/server";
import { canonicalAuthUserId } from "./lib/authIdentity";
import { confirmedTravelSummaryProjection } from "./lib/customerConfirmedTripReadiness";
import {
  isJourneyReminderMilestone,
  isSentProviderMessageId,
  isVerifiedPhoneE164,
  JOURNEY_REMINDER_MILESTONES,
  type JourneyReminderChannel,
  type JourneyReminderMilestone,
  journeyReminderLogicalKey,
  journeyReminderProviderKey,
  maskVerifiedPhone,
  orderedJourneyReminderMilestones,
  type SentMessageWebhookEvent,
  sendSentJourneyReminder,
  shouldApplyJourneyReminderStatus,
} from "./lib/customerJourneyReminderDelivery";

const CONSENT_VERSION = "journey-reminders-v1" as const;
const MAX_ACTIVE_QUEUED_DELIVERIES_PER_ENTITLEMENT = 8;
const MAX_PROVIDER_STATUS_EVENTS_PER_MESSAGE = 9;
const MAX_SOURCE_EVENT_ID_LENGTH = 128;
const SOURCE_EVENT_ID = /^[A-Za-z0-9:_-]+$/;

const milestoneValidator = v.union(
  v.literal("arrival_pack_ready"),
  v.literal("confirmed_travel_summary_ready")
);

const channelValidator = v.union(v.literal("whatsapp"), v.literal("rcs"));

const deliveryStatusValidator = v.union(
  v.literal("queued"),
  v.literal("accepted"),
  v.literal("scheduled"),
  v.literal("routed"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("read"),
  v.literal("failed"),
  v.literal("filtered"),
  v.literal("blocked"),
  v.literal("rejected"),
  v.literal("ambiguous"),
  v.literal("suppressed")
);

const journeyReminderDeliveryStateValidator = v.object({
  channel: channelValidator,
  milestone: milestoneValidator,
  status: deliveryStatusValidator,
  updatedAt: v.number(),
});

export const journeyReminderPreferenceValidator = v.object({
  active: v.boolean(),
  available: v.boolean(),
  deliveryStates: v.array(journeyReminderDeliveryStateValidator),
  maskedPhone: v.union(v.string(), v.null()),
  milestones: v.array(milestoneValidator),
  optedInAt: v.union(v.number(), v.null()),
  optedOutAt: v.union(v.number(), v.null()),
});

type ReminderCtx = QueryCtx | MutationCtx;
type SuppressionReason =
  | "consent_withdrawn"
  | "entitlement_revoked"
  | "fallback_not_authorized"
  | "phone_unverified";

interface EligibleReminderContext {
  consentRevision: Doc<"customerJourneyReminderConsentRevisions">;
  eligible: true;
  entitlement: Doc<"customerJourneyEntitlements">;
  phone: Doc<"customerPhoneVerifications">;
  preference: Doc<"customerJourneyReminderPreferences">;
}

interface SuppressedReminderContext {
  eligible: false;
  suppressionReason: SuppressionReason;
}

const deliverJourneyReminderRef = makeFunctionReference<
  "action",
  { deliveryId: Id<"customerJourneyReminderDeliveries"> },
  null
>("customerJourneyReminders:deliverJourneyReminder");

const claimJourneyReminderDeliveryRef = makeFunctionReference<
  "mutation",
  { deliveryId: Id<"customerJourneyReminderDeliveries"> },
  {
    channel: JourneyReminderChannel;
    idempotencyKey: string;
    phoneE164: string;
  } | null
>("customerJourneyReminders:claimJourneyReminderDelivery");

const recordJourneyReminderSendOutcomeRef = makeFunctionReference<
  "mutation",
  {
    deliveryId: Id<"customerJourneyReminderDeliveries">;
    outcome: "accepted" | "ambiguous" | "rejected" | "provider_not_configured";
    providerMessageId?: string;
    providerStatus?: number;
  },
  null
>("customerJourneyReminders:recordJourneyReminderSendOutcome");

function isActiveConfirmedEntitlement(row: Doc<"customerJourneyEntitlements"> | null) {
  return Boolean(
    row &&
      row.revokedAt === undefined &&
      row.confirmedOfferId &&
      row.queryId &&
      row.role !== "purchaser" &&
      row.source !== "public_booking_owner" &&
      row.capabilities.includes("view_confirmed_trip")
  );
}

async function activeVerifiedPhone(ctx: ReminderCtx, authUserId: string) {
  const rows = await ctx.db
    .query("customerPhoneVerifications")
    .withIndex("by_authUserId_revokedAt", (q) =>
      q.eq("authUserId", authUserId).eq("revokedAt", undefined)
    )
    .take(2);
  const [phone] = rows;
  return rows.length === 1 &&
    phone &&
    Number.isFinite(phone.verifiedAt) &&
    phone.verifiedAt >= 0 &&
    isVerifiedPhoneE164(phone.phoneE164)
    ? phone
    : null;
}

async function preferenceRows(ctx: ReminderCtx, entitlementId: Id<"customerJourneyEntitlements">) {
  return await ctx.db
    .query("customerJourneyReminderPreferences")
    .withIndex("by_entitlementId", (q) => q.eq("entitlementId", entitlementId))
    .take(2);
}

async function currentConsentRevision(
  ctx: ReminderCtx,
  preference: Doc<"customerJourneyReminderPreferences">
) {
  const revision = await ctx.db.get(
    "customerJourneyReminderConsentRevisions",
    preference.currentConsentRevisionId
  );
  return revision &&
    revision.authUserId === preference.authUserId &&
    revision.entitlementId === preference.entitlementId
    ? revision
    : null;
}

async function confirmedTripRelationsMatch(
  ctx: ReminderCtx,
  entitlement: Doc<"customerJourneyEntitlements">
) {
  if (!(entitlement.confirmedOfferId && entitlement.queryId)) {
    return false;
  }
  const [offer, queryRow] = await Promise.all([
    ctx.db.get("confirmedOffers", entitlement.confirmedOfferId),
    ctx.db.get("queries", entitlement.queryId),
  ]);
  return Boolean(
    offer?.queryId === entitlement.queryId &&
      queryRow?.confirmedOfferId === entitlement.confirmedOfferId
  );
}

async function exactActiveEntitlement(
  ctx: ReminderCtx,
  authUserId: string,
  confirmedOfferId: Id<"confirmedOffers">
) {
  const rows = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_confirmedOfferId_authUserId", (q) =>
      q.eq("confirmedOfferId", confirmedOfferId).eq("authUserId", authUserId)
    )
    .take(2);
  const [entitlement] = rows;
  return rows.length === 1 &&
    entitlement &&
    isActiveConfirmedEntitlement(entitlement) &&
    (await confirmedTripRelationsMatch(ctx, entitlement))
    ? entitlement
    : null;
}

function emptyPreferenceState(
  phone: Doc<"customerPhoneVerifications"> | null,
  deliveryStates: Array<{
    channel: JourneyReminderChannel;
    milestone: JourneyReminderMilestone;
    status: Doc<"customerJourneyReminderDeliveries">["status"];
    updatedAt: number;
  }> = []
) {
  const milestones: JourneyReminderMilestone[] = [];
  return {
    active: false,
    available: Boolean(phone),
    deliveryStates,
    maskedPhone: phone ? maskVerifiedPhone(phone.phoneE164) : null,
    milestones,
    optedInAt: null,
    optedOutAt: null,
  };
}

async function recentDeliveryStates(
  ctx: ReminderCtx,
  entitlementId: Id<"customerJourneyEntitlements">
) {
  const deliveries = await ctx.db
    .query("customerJourneyReminderDeliveries")
    .withIndex("by_entitlementId_createdAt", (q) => q.eq("entitlementId", entitlementId))
    .order("desc")
    .take(16);
  const seen = new Set<string>();
  return deliveries
    .filter((delivery) => {
      const key = `${delivery.milestone}:${delivery.channel}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map(({ channel, milestone, status, updatedAt }) => ({
      channel,
      milestone,
      status,
      updatedAt,
    }));
}

export async function reminderPreferenceForEntitlement(
  ctx: ReminderCtx,
  entitlement: Doc<"customerJourneyEntitlements">
) {
  const [rows, phone, deliveryStates] = await Promise.all([
    preferenceRows(ctx, entitlement._id),
    activeVerifiedPhone(ctx, entitlement.authUserId),
    recentDeliveryStates(ctx, entitlement._id),
  ]);
  const [preference] = rows;
  if (rows.length !== 1 || !preference) {
    return emptyPreferenceState(phone, deliveryStates);
  }
  const revision = await currentConsentRevision(ctx, preference);
  if (!revision) {
    return emptyPreferenceState(phone, deliveryStates);
  }
  const phoneMatches = Boolean(phone && revision.verifiedPhoneId === phone._id);
  return {
    active: Boolean(phoneMatches && revision.active && revision.milestones.length > 0),
    available: Boolean(phone),
    deliveryStates,
    maskedPhone: phone ? maskVerifiedPhone(phone.phoneE164) : null,
    milestones: orderedJourneyReminderMilestones(revision.milestones),
    optedInAt: revision.active ? revision.createdAt : null,
    optedOutAt: revision.active ? null : revision.createdAt,
  };
}

async function eligibleReminderContext(
  ctx: ReminderCtx,
  entitlementId: Id<"customerJourneyEntitlements">,
  milestone: JourneyReminderMilestone
): Promise<EligibleReminderContext | SuppressedReminderContext> {
  const entitlement = await ctx.db.get("customerJourneyEntitlements", entitlementId);
  if (
    !(
      entitlement &&
      isActiveConfirmedEntitlement(entitlement) &&
      entitlement.confirmedOfferId &&
      (await confirmedTripRelationsMatch(ctx, entitlement))
    )
  ) {
    return { eligible: false, suppressionReason: "entitlement_revoked" };
  }
  const siblings = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_confirmedOfferId_authUserId", (q) =>
      q
        .eq("confirmedOfferId", entitlement.confirmedOfferId)
        .eq("authUserId", entitlement.authUserId)
    )
    .take(2);
  if (siblings.length !== 1 || siblings[0]?._id !== entitlement._id) {
    return { eligible: false, suppressionReason: "entitlement_revoked" };
  }
  const preferences = await preferenceRows(ctx, entitlement._id);
  const [preference] = preferences;
  const consentRevision = preference ? await currentConsentRevision(ctx, preference) : null;
  if (
    preferences.length !== 1 ||
    !preference ||
    !consentRevision ||
    preference.authUserId !== entitlement.authUserId ||
    !consentRevision.active ||
    !consentRevision.milestones.includes(milestone)
  ) {
    return { eligible: false, suppressionReason: "consent_withdrawn" };
  }
  const phone = await activeVerifiedPhone(ctx, entitlement.authUserId);
  if (!(phone && consentRevision.verifiedPhoneId === phone._id)) {
    return { eligible: false, suppressionReason: "phone_unverified" };
  }
  return { consentRevision, eligible: true, entitlement, phone, preference };
}

async function activeQueuedDeliveries(
  ctx: MutationCtx,
  entitlementId: Id<"customerJourneyEntitlements">
) {
  const rows = await ctx.db
    .query("customerJourneyReminderDeliveries")
    .withIndex("by_entitlementId_status_createdAt", (q) =>
      q.eq("entitlementId", entitlementId).eq("status", "queued")
    )
    .take(MAX_ACTIVE_QUEUED_DELIVERIES_PER_ENTITLEMENT + 1);
  if (rows.length > MAX_ACTIVE_QUEUED_DELIVERIES_PER_ENTITLEMENT) {
    throw new ConvexError("JOURNEY_REMINDER_QUEUE_CONFLICT");
  }
  return rows;
}

async function readyMilestoneEvents(
  ctx: ReminderCtx,
  entitlement: Doc<"customerJourneyEntitlements">
) {
  if (!(entitlement.confirmedOfferId && entitlement.queryId)) {
    return [];
  }
  const offer = await ctx.db.get("confirmedOffers", entitlement.confirmedOfferId);
  if (!offer || offer.queryId !== entitlement.queryId) {
    return [];
  }
  const events: Array<{
    milestone: JourneyReminderMilestone;
    sourceEventId: string;
  }> = [
    {
      milestone: "arrival_pack_ready",
      sourceEventId: `confirmed-offer:${String(offer._id)}:arrival-pack-v1`,
    },
  ];
  if (offer.proposalQueryHandoffId) {
    const handoff = await ctx.db.get("proposalQueryHandoffs", offer.proposalQueryHandoffId);
    const travel = confirmedTravelSummaryProjection({
      handoff,
      offer,
      queryId: entitlement.queryId,
    });
    if (handoff && travel.asOf !== null) {
      events.push({
        milestone: "confirmed_travel_summary_ready",
        sourceEventId: `proposal-handoff:${String(handoff._id)}:travel-v1`,
      });
    }
  }
  return events;
}

async function queueJourneyReminderInMutation(
  ctx: MutationCtx,
  args: {
    entitlementId: Id<"customerJourneyEntitlements">;
    milestone: JourneyReminderMilestone;
    sourceEventId: string;
  }
) {
  if (
    !SOURCE_EVENT_ID.test(args.sourceEventId) ||
    args.sourceEventId.length > MAX_SOURCE_EVENT_ID_LENGTH
  ) {
    throw new ConvexError("Invalid reminder event identity");
  }
  const logicalKey = await journeyReminderLogicalKey({
    entitlementId: String(args.entitlementId),
    milestone: args.milestone,
    sourceEventId: args.sourceEventId,
  });
  const existing = await ctx.db
    .query("customerJourneyReminderDeliveries")
    .withIndex("by_logicalKey_channel", (q) =>
      q.eq("logicalKey", logicalKey).eq("channel", "whatsapp")
    )
    .take(2);
  if (existing.length > 1) {
    throw new ConvexError("JOURNEY_REMINDER_DELIVERY_CONFLICT");
  }
  if (existing[0]) {
    return { deliveryId: existing[0]._id, status: existing[0].status };
  }
  const eligibility = await eligibleReminderContext(ctx, args.entitlementId, args.milestone);
  const timestamp = Date.now();
  const requestKey = await journeyReminderProviderKey(logicalKey, "whatsapp");
  if (!eligibility.eligible) {
    const deliveryId = await ctx.db.insert("customerJourneyReminderDeliveries", {
      channel: "whatsapp",
      createdAt: timestamp,
      entitlementId: args.entitlementId,
      logicalKey,
      milestone: args.milestone,
      requestKey,
      status: "suppressed",
      suppressionReason: eligibility.suppressionReason,
      updatedAt: timestamp,
    });
    return { deliveryId, status: "suppressed" as const };
  }
  if (
    (await activeQueuedDeliveries(ctx, args.entitlementId)).length >=
    MAX_ACTIVE_QUEUED_DELIVERIES_PER_ENTITLEMENT
  ) {
    throw new ConvexError("JOURNEY_REMINDER_QUEUE_LIMIT");
  }
  const deliveryId = await ctx.db.insert("customerJourneyReminderDeliveries", {
    channel: "whatsapp",
    consentRevisionId: eligibility.consentRevision._id,
    createdAt: timestamp,
    entitlementId: args.entitlementId,
    logicalKey,
    milestone: args.milestone,
    requestKey,
    status: "queued",
    updatedAt: timestamp,
  });
  await ctx.scheduler.runAfter(0, deliverJourneyReminderRef, { deliveryId });
  return { deliveryId, status: "queued" as const };
}

function sameMilestones(
  left: readonly JourneyReminderMilestone[],
  right: readonly JourneyReminderMilestone[]
) {
  return (
    left.length === right.length && left.every((milestone, index) => milestone === right[index])
  );
}

async function suppressIneligibleQueuedReminders(
  ctx: MutationCtx,
  entitlementId: Id<"customerJourneyEntitlements">
) {
  const queued = await activeQueuedDeliveries(ctx, entitlementId);
  await Promise.all(
    queued.map(async (delivery) => {
      const eligibility = await eligibleReminderContext(ctx, entitlementId, delivery.milestone);
      if (!eligibility.eligible) {
        await ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
          status: "suppressed",
          suppressionReason: eligibility.suppressionReason,
          updatedAt: Date.now(),
        });
      }
    })
  );
}

export async function suppressQueuedJourneyRemindersForEntitlement(
  ctx: MutationCtx,
  entitlementId: Id<"customerJourneyEntitlements">,
  suppressionReason: SuppressionReason
) {
  const deliveries = await activeQueuedDeliveries(ctx, entitlementId);
  const timestamp = Date.now();
  await Promise.all(
    deliveries.map((delivery) =>
      ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
        status: "suppressed",
        suppressionReason,
        updatedAt: timestamp,
      })
    )
  );
}

async function queueReadyMilestones(
  ctx: MutationCtx,
  entitlement: Doc<"customerJourneyEntitlements">,
  milestones: readonly JourneyReminderMilestone[]
) {
  const readyEvents = await readyMilestoneEvents(ctx, entitlement);
  await Promise.all(
    readyEvents
      .filter((event) => milestones.includes(event.milestone))
      .map((event) =>
        queueJourneyReminderInMutation(ctx, {
          entitlementId: entitlement._id,
          ...event,
        })
      )
  );
}

function validatedMilestones(values: readonly string[]) {
  if (
    values.length > JOURNEY_REMINDER_MILESTONES.length ||
    new Set(values).size !== values.length ||
    values.some((milestone) => !isJourneyReminderMilestone(milestone))
  ) {
    throw new ConvexError("Invalid reminder choices");
  }
  return orderedJourneyReminderMilestones(values);
}

async function writeConsentRevision(
  ctx: MutationCtx,
  input: {
    authUserId: string;
    entitlement: Doc<"customerJourneyEntitlements">;
    existing?: Doc<"customerJourneyReminderPreferences">;
    milestones: JourneyReminderMilestone[];
    phone: Doc<"customerPhoneVerifications"> | null;
  }
) {
  const existingRevision = input.existing
    ? await currentConsentRevision(ctx, input.existing)
    : null;
  if (input.existing && !existingRevision) {
    throw new ConvexError("JOURNEY_REMINDER_CONSENT_CONFLICT");
  }
  const active = input.milestones.length > 0;
  if (
    existingRevision &&
    existingRevision.active === active &&
    sameMilestones(
      orderedJourneyReminderMilestones(existingRevision.milestones),
      input.milestones
    ) &&
    (!active || existingRevision.verifiedPhoneId === input.phone?._id)
  ) {
    return false;
  }
  const timestamp = Date.now();
  const consentRevisionId = await ctx.db.insert("customerJourneyReminderConsentRevisions", {
    active,
    authUserId: input.authUserId,
    consentVersion: CONSENT_VERSION,
    createdAt: timestamp,
    entitlementId: input.entitlement._id,
    milestones: input.milestones,
    previousRevisionId: existingRevision?._id,
    verifiedPhoneId: active ? input.phone?._id : existingRevision?.verifiedPhoneId,
  });
  if (input.existing) {
    await ctx.db.patch("customerJourneyReminderPreferences", input.existing._id, {
      currentConsentRevisionId: consentRevisionId,
      updatedAt: timestamp,
    });
  } else {
    await ctx.db.insert("customerJourneyReminderPreferences", {
      authUserId: input.authUserId,
      createdAt: timestamp,
      currentConsentRevisionId: consentRevisionId,
      entitlementId: input.entitlement._id,
      updatedAt: timestamp,
    });
  }
  return true;
}

export const setMyJourneyReminderPreferences = mutation({
  args: {
    confirmedOfferId: v.id("confirmedOffers"),
    milestones: v.array(milestoneValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const authUserId = identity ? canonicalAuthUserId(identity) : null;
    if (!authUserId) {
      throw new ConvexError("UNAUTHORIZED");
    }
    const entitlement = await exactActiveEntitlement(ctx, authUserId, args.confirmedOfferId);
    if (!entitlement) {
      throw new ConvexError("Journey not found");
    }
    const milestones = validatedMilestones(args.milestones);
    const [preferences, phone] = await Promise.all([
      preferenceRows(ctx, entitlement._id),
      activeVerifiedPhone(ctx, authUserId),
    ]);
    if (preferences.length > 1) {
      throw new ConvexError("JOURNEY_REMINDER_PREFERENCE_CONFLICT");
    }
    if (milestones.length > 0 && !phone) {
      throw new ConvexError("VERIFIED_PHONE_REQUIRED");
    }
    const [existing] = preferences;
    if (!(existing || milestones.length > 0)) {
      return emptyPreferenceState(phone);
    }
    const changed = await writeConsentRevision(ctx, {
      authUserId,
      entitlement,
      existing,
      milestones,
      phone,
    });
    if (changed) {
      await suppressIneligibleQueuedReminders(ctx, entitlement._id);
    }
    if (milestones.length > 0) {
      await queueReadyMilestones(ctx, entitlement, milestones);
    }
    return await reminderPreferenceForEntitlement(ctx, entitlement);
  },
  returns: journeyReminderPreferenceValidator,
});

export const queueJourneyReminder = internalMutation({
  args: {
    entitlementId: v.id("customerJourneyEntitlements"),
    milestone: milestoneValidator,
    sourceEventId: v.string(),
  },
  handler: queueJourneyReminderInMutation,
  returns: v.object({
    deliveryId: v.id("customerJourneyReminderDeliveries"),
    status: deliveryStatusValidator,
  }),
});

async function validRcsFallback(
  ctx: MutationCtx,
  delivery: Doc<"customerJourneyReminderDeliveries">
) {
  if (
    delivery.channel !== "rcs" ||
    !(delivery.fallbackOfDeliveryId && delivery.fallbackAuthorizedByReceiptId)
  ) {
    return delivery.channel === "whatsapp";
  }
  const [whatsapp, receipt] = await Promise.all([
    ctx.db.get("customerJourneyReminderDeliveries", delivery.fallbackOfDeliveryId),
    ctx.db.get("customerJourneyReminderWebhookReceipts", delivery.fallbackAuthorizedByReceiptId),
  ]);
  return Boolean(
    whatsapp &&
      whatsapp.channel === "whatsapp" &&
      whatsapp.logicalKey === delivery.logicalKey &&
      whatsapp.consentRevisionId === delivery.consentRevisionId &&
      whatsapp.status === "failed" &&
      receipt?.applied &&
      receipt.deliveryId === whatsapp._id &&
      receipt.eventType === "message.failed" &&
      receipt.channel === "whatsapp" &&
      receipt.status === "failed" &&
      receipt.messageId === whatsapp.providerMessageId
  );
}

export const claimJourneyReminderDelivery = internalMutation({
  args: { deliveryId: v.id("customerJourneyReminderDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("customerJourneyReminderDeliveries", args.deliveryId);
    if (!(delivery && delivery.status === "queued")) {
      return null;
    }
    const eligibility = await eligibleReminderContext(
      ctx,
      delivery.entitlementId,
      delivery.milestone
    );
    if (!(eligibility.eligible && (await validRcsFallback(ctx, delivery)))) {
      await ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
        status: "suppressed",
        suppressionReason: eligibility.eligible
          ? "fallback_not_authorized"
          : eligibility.suppressionReason,
        updatedAt: Date.now(),
      });
      return null;
    }
    if (
      delivery.channel === "rcs" &&
      delivery.consentRevisionId !== eligibility.consentRevision._id
    ) {
      await ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
        status: "suppressed",
        suppressionReason: "fallback_not_authorized",
        updatedAt: Date.now(),
      });
      return null;
    }
    await ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
      // Mark the uncertain crash boundary before the network call. A later
      // exact response may narrow this state, but a lost response never can.
      consentRevisionId:
        delivery.channel === "whatsapp"
          ? eligibility.consentRevision._id
          : delivery.consentRevisionId,
      status: "ambiguous",
      updatedAt: Date.now(),
    });
    return {
      channel: delivery.channel,
      idempotencyKey: delivery.requestKey,
      phoneE164: eligibility.phone.phoneE164,
    };
  },
  returns: v.union(
    v.object({ channel: channelValidator, idempotencyKey: v.string(), phoneE164: v.string() }),
    v.null()
  ),
});

async function maybeQueueRcsFallback(
  ctx: MutationCtx,
  delivery: Doc<"customerJourneyReminderDeliveries">,
  receipt: Doc<"customerJourneyReminderWebhookReceipts">
) {
  if (
    !(
      receipt.applied &&
      receipt.eventType === "message.failed" &&
      receipt.status === "failed" &&
      receipt.channel === "whatsapp" &&
      delivery.channel === "whatsapp"
    )
  ) {
    return false;
  }
  const eligibility = await eligibleReminderContext(
    ctx,
    delivery.entitlementId,
    delivery.milestone
  );
  if (!eligibility.eligible || delivery.consentRevisionId !== eligibility.consentRevision._id) {
    return false;
  }
  const existingFallbacks = await ctx.db
    .query("customerJourneyReminderDeliveries")
    .withIndex("by_logicalKey_channel", (q) =>
      q.eq("logicalKey", delivery.logicalKey).eq("channel", "rcs")
    )
    .take(2);
  if (existingFallbacks.length > 1) {
    throw new ConvexError("JOURNEY_REMINDER_DELIVERY_CONFLICT");
  }
  if (existingFallbacks[0]) {
    return false;
  }
  const timestamp = Date.now();
  const fallbackId = await ctx.db.insert("customerJourneyReminderDeliveries", {
    channel: "rcs",
    consentRevisionId: eligibility.consentRevision._id,
    createdAt: timestamp,
    entitlementId: delivery.entitlementId,
    fallbackAuthorizedByReceiptId: receipt._id,
    fallbackOfDeliveryId: delivery._id,
    logicalKey: delivery.logicalKey,
    milestone: delivery.milestone,
    requestKey: await journeyReminderProviderKey(delivery.logicalKey, "rcs"),
    status: "queued",
    updatedAt: timestamp,
  });
  await ctx.scheduler.runAfter(0, deliverJourneyReminderRef, { deliveryId: fallbackId });
  return true;
}

async function applyWebhookReceiptToDelivery(
  ctx: MutationCtx,
  delivery: Doc<"customerJourneyReminderDeliveries">,
  receipt: Doc<"customerJourneyReminderWebhookReceipts">
) {
  const applied = shouldApplyJourneyReminderStatus({
    currentEventAt: delivery.providerUpdatedAt,
    currentStatus: delivery.status,
    incomingEventAt: receipt.providerEventAt,
    incomingStatus: receipt.status,
  });
  await ctx.db.patch("customerJourneyReminderWebhookReceipts", receipt._id, {
    applied,
    deliveryId: delivery._id,
  });
  const linkedReceipt = { ...receipt, applied, deliveryId: delivery._id };
  if (!applied) {
    return { fallbackQueued: false, nextDelivery: delivery, outcome: "stale" as const };
  }
  const updatedAt = Date.now();
  await ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
    providerUpdatedAt: receipt.providerEventAt,
    status: receipt.status,
    updatedAt,
  });
  const nextDelivery = {
    ...delivery,
    providerUpdatedAt: receipt.providerEventAt,
    status: receipt.status,
    updatedAt,
  };
  return {
    fallbackQueued: await maybeQueueRcsFallback(ctx, nextDelivery, linkedReceipt),
    nextDelivery,
    outcome: "applied" as const,
  };
}

async function reconcilePendingWebhookReceipts(
  ctx: MutationCtx,
  delivery: Doc<"customerJourneyReminderDeliveries">,
  receipts: Doc<"customerJourneyReminderWebhookReceipts">[],
  index = 0
): Promise<Doc<"customerJourneyReminderDeliveries">> {
  const receipt = receipts[index];
  if (!receipt) {
    return delivery;
  }
  const nextDelivery =
    receipt.deliveryId || receipt.channel !== delivery.channel
      ? delivery
      : (await applyWebhookReceiptToDelivery(ctx, delivery, receipt)).nextDelivery;
  return await reconcilePendingWebhookReceipts(ctx, nextDelivery, receipts, index + 1);
}

export const recordJourneyReminderSendOutcome = internalMutation({
  args: {
    deliveryId: v.id("customerJourneyReminderDeliveries"),
    outcome: v.union(
      v.literal("accepted"),
      v.literal("ambiguous"),
      v.literal("rejected"),
      v.literal("provider_not_configured")
    ),
    providerMessageId: v.optional(v.string()),
    providerStatus: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("customerJourneyReminderDeliveries", args.deliveryId);
    if (!(delivery && delivery.status === "ambiguous")) {
      return null;
    }
    if (args.outcome === "provider_not_configured") {
      await ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
        status: "suppressed",
        suppressionReason: "provider_not_configured",
        updatedAt: Date.now(),
      });
      return null;
    }
    const { providerMessageId } = args;
    if (args.outcome === "accepted" && isSentProviderMessageId(providerMessageId)) {
      const collisions = await ctx.db
        .query("customerJourneyReminderDeliveries")
        .withIndex("by_providerMessageId", (q) => q.eq("providerMessageId", providerMessageId))
        .take(2);
      if (collisions.some((row) => row._id !== delivery._id)) {
        await ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
          status: "ambiguous",
          updatedAt: Date.now(),
        });
        return null;
      }
      const acceptedAt = Date.now();
      await ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
        providerMessageId,
        status: "accepted",
        updatedAt: acceptedAt,
      });
      const currentDelivery: Doc<"customerJourneyReminderDeliveries"> = {
        ...delivery,
        providerMessageId,
        status: "accepted" as const,
        updatedAt: acceptedAt,
      };
      const pendingReceipts = await ctx.db
        .query("customerJourneyReminderWebhookReceipts")
        .withIndex("by_messageId_createdAt", (q) => q.eq("messageId", providerMessageId))
        .take(MAX_PROVIDER_STATUS_EVENTS_PER_MESSAGE + 1);
      if (pendingReceipts.length > MAX_PROVIDER_STATUS_EVENTS_PER_MESSAGE) {
        throw new ConvexError("JOURNEY_REMINDER_WEBHOOK_RECEIPT_CONFLICT");
      }
      pendingReceipts.sort(
        (left, right) =>
          left.providerEventAt - right.providerEventAt || left.createdAt - right.createdAt
      );
      await reconcilePendingWebhookReceipts(ctx, currentDelivery, pendingReceipts);
      return null;
    }
    await ctx.db.patch("customerJourneyReminderDeliveries", delivery._id, {
      providerStatus: args.outcome === "rejected" ? args.providerStatus : undefined,
      status: args.outcome === "rejected" ? "rejected" : "ambiguous",
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const deliverJourneyReminder = internalAction({
  args: { deliveryId: v.id("customerJourneyReminderDeliveries") },
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(claimJourneyReminderDeliveryRef, args);
    if (!claim) {
      return null;
    }
    const templateId =
      claim.channel === "whatsapp"
        ? env.SENT_JOURNEY_REMINDER_WHATSAPP_TEMPLATE_ID
        : env.SENT_JOURNEY_REMINDER_RCS_TEMPLATE_ID;
    if (!(env.SENT_API_KEY && templateId)) {
      await ctx.runMutation(recordJourneyReminderSendOutcomeRef, {
        deliveryId: args.deliveryId,
        outcome: "provider_not_configured",
      });
      return null;
    }
    const result = await sendSentJourneyReminder({
      apiKey: env.SENT_API_KEY,
      channel: claim.channel,
      idempotencyKey: claim.idempotencyKey,
      phoneE164: claim.phoneE164,
      templateId,
    });
    if (result.kind === "accepted") {
      await ctx.runMutation(recordJourneyReminderSendOutcomeRef, {
        deliveryId: args.deliveryId,
        outcome: result.kind,
        providerMessageId: result.providerMessageId,
      });
    } else if (result.kind === "rejected") {
      await ctx.runMutation(recordJourneyReminderSendOutcomeRef, {
        deliveryId: args.deliveryId,
        outcome: result.kind,
        providerStatus: result.providerStatus,
      });
    } else {
      await ctx.runMutation(recordJourneyReminderSendOutcomeRef, {
        deliveryId: args.deliveryId,
        outcome: result.kind,
      });
    }
    return null;
  },
  returns: v.null(),
});

export const applySentJourneyReminderWebhook = internalMutation({
  args: {
    channel: channelValidator,
    eventAt: v.number(),
    eventKey: v.string(),
    eventType: v.string(),
    messageId: v.string(),
    status: v.union(
      v.literal("blocked"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("filtered"),
      v.literal("queued"),
      v.literal("read"),
      v.literal("routed"),
      v.literal("scheduled"),
      v.literal("sent")
    ),
  },
  handler: async (ctx, args) => {
    if (!isSentProviderMessageId(args.messageId) || args.eventType !== `message.${args.status}`) {
      return { fallbackQueued: false, outcome: "ignored" as const };
    }
    const priorReceipt = await ctx.db
      .query("customerJourneyReminderWebhookReceipts")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", args.eventKey))
      .first();
    if (priorReceipt) {
      return { fallbackQueued: false, outcome: "duplicate" as const };
    }
    const receiptId = await ctx.db.insert("customerJourneyReminderWebhookReceipts", {
      applied: false,
      channel: args.channel,
      createdAt: Date.now(),
      eventKey: args.eventKey,
      eventType: args.eventType,
      messageId: args.messageId,
      providerEventAt: args.eventAt,
      status: args.status,
    });
    const deliveries = await ctx.db
      .query("customerJourneyReminderDeliveries")
      .withIndex("by_providerMessageId", (q) => q.eq("providerMessageId", args.messageId))
      .take(2);
    const [delivery] = deliveries;
    if (deliveries.length !== 1 || !delivery || delivery.channel !== args.channel) {
      return { fallbackQueued: false, outcome: "pending" as const };
    }
    const receipt = await ctx.db.get("customerJourneyReminderWebhookReceipts", receiptId);
    if (!receipt) {
      throw new ConvexError("JOURNEY_REMINDER_WEBHOOK_RECEIPT_MISSING");
    }
    const result = await applyWebhookReceiptToDelivery(ctx, delivery, receipt);
    return { fallbackQueued: result.fallbackQueued, outcome: result.outcome };
  },
  returns: v.object({
    fallbackQueued: v.boolean(),
    outcome: v.union(
      v.literal("applied"),
      v.literal("duplicate"),
      v.literal("ignored"),
      v.literal("pending"),
      v.literal("stale")
    ),
  }),
});

export type SentJourneyReminderWebhookArgs = SentMessageWebhookEvent;
