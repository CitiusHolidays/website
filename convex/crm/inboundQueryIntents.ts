import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation, query } from "../_generated/server";
import { isRuntimeString, propertiesWhen } from "../lib/runtimeValues";
import { isDirectorOrAdmin, PERMISSIONS, publishWorkflowNotification, requireStaff } from "./lib";
import {
  type OperationalTestContext,
  recordOperationalEffect,
  resolveOperationalControl,
} from "./lib/operationalControls";
import { boundedPaginationOptions } from "./paginationPolicy";
import { handleQueryCreate } from "./queryCreation";
import { queryTypeValidator, travelTypeValidator } from "./queryValidators";

const inboundSourceValidator = v.union(
  v.literal("Citius Concierge"),
  v.literal("Sacred Bharat"),
  v.literal("Website")
);
const sacredBharatContextValidator = v.object({
  entryPoint: v.union(v.literal("journey_planner"), v.literal("trail")),
  templeId: v.optional(v.string()),
  trailSlug: v.optional(v.string()),
});
const inboundStatusValidator = v.union(
  v.literal("pending"),
  v.literal("converted" as const),
  v.literal("dismissed" as const)
);
const dismissalReasonValidator = v.union(
  v.literal("duplicate_enquiry"),
  v.literal("not_qualified"),
  v.literal("unable_to_reach")
);

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SACRED_CONTEXT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CLIENT_NAME_LENGTH = 160;
const MAX_CONTACT_EMAIL_LENGTH = 254;
const MAX_CONTACT_MOBILE_LENGTH = 50;
const MAX_DESTINATION_LENGTH = 240;
const MAX_NOTES_LENGTH = 5000;
const MAX_PAX_COUNT = 1000;
const INBOUND_RATE_LIMIT = 5;
const INBOUND_RATE_WINDOW_MS = 15 * 60 * 1000;
const INBOUND_RATE_RETENTION_MS = 24 * 60 * 60 * 1000;
const INBOUND_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const INBOUND_SALES_ROLES = new Set(["Sales", "Sales Head"]);
const WEBSITE_CONTACT_EMAIL = "info@citius.in";

const inboundIntentPublicValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("inboundQueryIntents"),
  clientName: v.string(),
  consentAt: v.number(),
  contactEmail: v.optional(v.string()),
  contactMobile: v.optional(v.string()),
  convertedAt: v.optional(v.number()),
  convertedQueryId: v.optional(v.string()),
  createdAt: v.number(),
  destination: v.optional(v.string()),
  dismissalReason: v.optional(dismissalReasonValidator),
  dismissedAt: v.optional(v.number()),
  isSynthetic: v.boolean(),
  notes: v.optional(v.string()),
  paxCount: v.optional(v.number()),
  sacredBharatContext: v.optional(sacredBharatContextValidator),
  source: inboundSourceValidator,
  status: inboundStatusValidator,
  travelStartDate: v.optional(v.string()),
  triagedAt: v.optional(v.number()),
  triagedByStaffId: v.optional(v.id("staffUsers")),
});

function presentInboundIntent(intent: Doc<"inboundQueryIntents">) {
  return {
    _creationTime: intent._creationTime,
    _id: intent._id,
    clientName: intent.clientName,
    consentAt: intent.consentAt,
    ...propertiesWhen(!(intent.contactEmail === undefined), () => ({
      contactEmail: intent.contactEmail,
    })),
    ...propertiesWhen(!(intent.contactMobile === undefined), () => ({
      contactMobile: intent.contactMobile,
    })),
    ...propertiesWhen(!(intent.convertedAt === undefined), () => ({
      convertedAt: intent.convertedAt,
    })),
    ...propertiesWhen(!(intent.convertedQueryId === undefined), () => ({
      convertedQueryId: intent.convertedQueryId,
    })),
    createdAt: intent.createdAt,
    ...propertiesWhen(!(intent.destination === undefined), () => ({
      destination: intent.destination,
    })),
    ...propertiesWhen(!(intent.dismissalReason === undefined), () => ({
      dismissalReason: intent.dismissalReason,
    })),
    ...propertiesWhen(!(intent.dismissedAt === undefined), () => ({
      dismissedAt: intent.dismissedAt,
    })),
    isSynthetic: intent.isSynthetic ?? false,
    ...propertiesWhen(!(intent.notes === undefined), () => ({ notes: intent.notes })),
    ...propertiesWhen(!(intent.paxCount === undefined), () => ({ paxCount: intent.paxCount })),
    ...propertiesWhen(!(intent.sacredBharatContext === undefined), () => ({
      sacredBharatContext: intent.sacredBharatContext,
    })),
    source: intent.source,
    status: intent.status,
    ...propertiesWhen(!(intent.triagedAt === undefined), () => ({ triagedAt: intent.triagedAt })),
    ...propertiesWhen(!(intent.triagedByStaffId === undefined), () => ({
      triagedByStaffId: intent.triagedByStaffId,
    })),
    ...propertiesWhen(!(intent.travelStartDate === undefined), () => ({
      travelStartDate: intent.travelStartDate,
    })),
  };
}

function presentInboundIntentPage<T extends { page: Doc<"inboundQueryIntents">[] }>(page: T) {
  return { ...page, page: page.page.map(presentInboundIntent) };
}

const gatewayResultValidator = v.object({
  effects: v.object({
    crmIntake: v.union(
      v.literal("created"),
      v.literal("duplicate"),
      v.literal("suppressed"),
      v.literal("throttled")
    ),
    infoMailboxEmail: v.union(
      v.literal("not_applicable"),
      v.literal("queued"),
      v.literal("suppressed")
    ),
    salesBell: v.union(v.literal("not_applicable"), v.literal("queued"), v.literal("suppressed")),
    salesEmail: v.union(v.literal("not_applicable"), v.literal("queued"), v.literal("suppressed")),
  }),
  intentId: v.union(v.id("inboundQueryIntents"), v.null()),
  status: v.union(
    v.literal("created" as const),
    v.literal("duplicate" as const),
    v.literal("disabled" as const),
    v.literal("throttled" as const)
  ),
});

const convertResultValidator = v.object({
  intentId: v.id("inboundQueryIntents"),
  queryCode: v.string(),
  queryId: v.id("queries"),
  replayed: v.boolean(),
});

const dismissResultValidator = v.object({
  intentId: v.id("inboundQueryIntents"),
  replayed: v.boolean(),
  status: v.literal("dismissed" as const),
});

interface GatewayResult {
  effects: {
    crmIntake: "created" | "duplicate" | "suppressed" | "throttled";
    infoMailboxEmail: "not_applicable" | "queued" | "suppressed";
    salesBell: "not_applicable" | "queued" | "suppressed";
    salesEmail: "not_applicable" | "queued" | "suppressed";
  };
  intentId: Id<"inboundQueryIntents"> | null;
  status: "created" | "disabled" | "duplicate" | "throttled";
}

interface InboundIntentInput {
  clientName: string;
  consent: true;
  contactEmail?: string;
  contactMobile?: string;
  destination?: string;
  notes?: string;
  operationalTestToken?: string;
  paxCount?: number;
  sacredBharatContext?: {
    entryPoint: "journey_planner" | "trail";
    templeId?: string;
    trailSlug?: string;
  };
  source: "Citius Concierge" | "Sacred Bharat" | "Website";
  submissionKeyHash: string;
  synthetic?: boolean;
  travelStartDate?: string;
}

function operationalTestContext(args: InboundIntentInput): OperationalTestContext | undefined {
  const synthetic = args.synthetic === true;
  const token = args.operationalTestToken;
  if (!synthetic) {
    if (token) {
      throw new ConvexError("INVALID_OPERATIONAL_TEST_OVERRIDE");
    }
    return;
  }
  if (!token) {
    throw new ConvexError("INVALID_OPERATIONAL_TEST_OVERRIDE");
  }
  return {
    scope: "inbound_contact",
    synthetic: true,
    token,
  };
}

const noNotificationEffects = {
  infoMailboxEmail: "not_applicable" as const,
  salesBell: "not_applicable" as const,
  salesEmail: "not_applicable" as const,
};

function assertInboundText(value: string | undefined, maxLength: number, label: string) {
  if (value !== undefined && value.length > maxLength) {
    throw new ConvexError(`${label} is too long`);
  }
}

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function validateIntentInput(args: InboundIntentInput) {
  const clientName = args.clientName.trim();
  if (!clientName) {
    throw new ConvexError("Client name is required");
  }
  assertInboundText(clientName, MAX_CLIENT_NAME_LENGTH, "Client name");
  assertInboundText(args.contactEmail, MAX_CONTACT_EMAIL_LENGTH, "Contact email");
  assertInboundText(args.contactMobile, MAX_CONTACT_MOBILE_LENGTH, "Contact mobile");
  assertInboundText(args.destination, MAX_DESTINATION_LENGTH, "Destination");
  assertInboundText(args.notes, MAX_NOTES_LENGTH, "Notes");
  if (
    args.paxCount !== undefined &&
    !(Number.isInteger(args.paxCount) && args.paxCount >= 1 && args.paxCount <= MAX_PAX_COUNT)
  ) {
    throw new ConvexError("Pax count must be a whole number between 1 and 1,000");
  }
  if (!HASH_PATTERN.test(args.submissionKeyHash)) {
    throw new ConvexError("Invalid inbound submission key");
  }
  const context = args.sacredBharatContext;
  if (args.source !== "Sacred Bharat" && context !== undefined) {
    throw new ConvexError("Sacred Bharat context does not match the inbound source");
  }
  if (args.source === "Sacred Bharat") {
    const validPlanner =
      context?.entryPoint === "journey_planner" &&
      context.trailSlug === undefined &&
      isRuntimeString(context.templeId) &&
      context.templeId.length <= 100 &&
      SACRED_CONTEXT_SLUG_PATTERN.test(context.templeId);
    const validTrail =
      context?.entryPoint === "trail" &&
      context.templeId === undefined &&
      isRuntimeString(context.trailSlug) &&
      context.trailSlug.length <= 100 &&
      SACRED_CONTEXT_SLUG_PATTERN.test(context.trailSlug);
    if (!(validPlanner || validTrail)) {
      throw new ConvexError("Select one valid Sacred Bharat planning context");
    }
  }
  return { clientName };
}

function buildListSearchText(args: InboundIntentInput) {
  return [
    args.clientName,
    args.contactEmail,
    args.contactMobile,
    args.destination,
    args.notes,
    args.sacredBharatContext?.templeId,
    args.sacredBharatContext?.trailSlug,
    args.source,
  ]
    .filter(Boolean)
    .join(" ");
}

function assertGatewaySecret(gatewaySecret: string) {
  const expected = process.env.INBOUND_INTENT_GATEWAY_SECRET;
  if (!(isRuntimeString(expected) && expected.trim().length > 0 && gatewaySecret === expected)) {
    throw new ConvexError("FORBIDDEN");
  }
}

async function findRecentDuplicate(
  ctx: MutationCtx,
  submissionKeyHash: string,
  now: number,
  syntheticTestSessionId?: Id<"operationalControlTestSessions">
) {
  const candidates = await ctx.db
    .query("inboundQueryIntents")
    .withIndex("by_submissionKeyHash_createdAt", (q) =>
      q.eq("submissionKeyHash", submissionKeyHash).gte("createdAt", now - INBOUND_DEDUPE_WINDOW_MS)
    )
    .order("desc")
    .take(100);
  return (
    candidates.find((candidate) =>
      syntheticTestSessionId
        ? candidate.isSynthetic === true &&
          candidate.syntheticTestSessionId === syntheticTestSessionId
        : candidate.isSynthetic !== true
    ) ?? null
  );
}

function inboundAttemptEffectId(
  submissionKeyHash: string,
  syntheticTestSessionId: Id<"operationalControlTestSessions"> | undefined,
  suffix: string
) {
  const namespace = syntheticTestSessionId ? `synthetic:${String(syntheticTestSessionId)}` : "real";
  return `inbound-attempt:${namespace}:${submissionKeyHash}:${suffix}`;
}

async function requireInboundSales(ctx: Parameters<typeof requireStaff>[0]) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_QUERIES);
  if (isDirectorOrAdmin(access) || access.roles.some((role) => INBOUND_SALES_ROLES.has(role))) {
    return access;
  }
  throw new ConvexError("FORBIDDEN");
}

async function createIntent(ctx: MutationCtx, args: InboundIntentInput) {
  const { clientName } = validateIntentInput(args);
  const now = Date.now();
  const test = operationalTestContext(args);
  const intakeControl = await resolveOperationalControl(ctx, "inbound.crm_intake", {
    at: now,
    test,
  });
  if (!intakeControl.enabled) {
    await recordOperationalEffect(ctx, {
      control: intakeControl,
      disposition: "suppressed",
      effectId: inboundAttemptEffectId(
        args.submissionKeyHash,
        intakeControl.testSessionId,
        "crm_intake"
      ),
      entityType: "inboundQueryIntent",
      synthetic: args.synthetic,
    });
    return {
      duplicate: false,
      effects: { crmIntake: "suppressed" as const, ...noNotificationEffects },
      id: null,
    } as const;
  }
  const existing = await findRecentDuplicate(
    ctx,
    args.submissionKeyHash,
    now,
    intakeControl.testSessionId
  );
  if (existing) {
    await recordOperationalEffect(ctx, {
      control: intakeControl,
      disposition: "duplicate",
      effectId: `inbound:${String(existing._id)}:crm_intake:duplicate`,
      entityId: String(existing._id),
      entityType: "inboundQueryIntent",
      synthetic: args.synthetic,
    });
    return {
      duplicate: true,
      effects: { crmIntake: "duplicate" as const, ...noNotificationEffects },
      id: existing._id,
    } as const;
  }

  const intentId = await ctx.db.insert("inboundQueryIntents", {
    clientName,
    consentAt: now,
    contactEmail: normalizeOptional(args.contactEmail),
    contactEmailNormalized: normalizeOptional(args.contactEmail)?.toLowerCase(),
    contactMobile: normalizeOptional(args.contactMobile),
    createdAt: now,
    destination: normalizeOptional(args.destination),
    isSynthetic: args.synthetic === true,
    listSearchText: buildListSearchText({ ...args, clientName }),
    notes: normalizeOptional(args.notes),
    paxCount: args.paxCount,
    sacredBharatContext: args.sacredBharatContext,
    source: args.source,
    status: "pending",
    submissionKeyHash: args.submissionKeyHash,
    syntheticTestSessionId: intakeControl.testSessionId,
    travelStartDate: normalizeOptional(args.travelStartDate),
  });
  const handoffEventId = await ctx.db.insert("crmHandoffEvents", {
    createdAt: now,
    inboundIntentId: intentId,
    isSynthetic: args.synthetic === true,
    source: args.source,
  });
  await ctx.db.patch("inboundQueryIntents", intentId, { handoffEventId });
  await recordOperationalEffect(ctx, {
    control: intakeControl,
    disposition: "created",
    effectId: `inbound:${String(intentId)}:crm_intake`,
    entityId: String(intentId),
    entityType: "inboundQueryIntent",
    synthetic: args.synthetic,
  });
  const recipientRoles = ["Sales", "Sales Head"];
  const notificationPrefix = args.synthetic ? "[TEST] " : "";
  const notification = await publishWorkflowNotification(ctx, {
    ...propertiesWhen(args.source === "Website", () => ({
      additionalEmailRecipients: [WEBSITE_CONTACT_EMAIL],
    })),
    bellTargets: { kind: "roles", roles: recipientRoles },
    content: {
      body: `${notificationPrefix}New inbound lead from ${args.source}: ${clientName}`,
      entityId: String(intentId),
      entityType: "inboundQueryIntent",
      title: `${notificationPrefix}${
        args.source === "Website" ? "New website enquiry" : "Qualified inbound query"
      }`,
    },
    emailTargets: { kind: "roles", roles: recipientRoles },
    operationalControls: {
      additionalEmailKey: "inbound.info_mailbox_email",
      bellKey: "inbound.sales_bell",
      effectId: `inbound:${String(intentId)}`,
      emailKey: "inbound.sales_email",
      synthetic: args.synthetic,
      test,
    },
  });
  return {
    duplicate: false,
    effects: {
      crmIntake: "created" as const,
      infoMailboxEmail: notification.additionalEmail?.disposition ?? "not_applicable",
      salesBell: notification.bell.disposition,
      salesEmail: notification.email.disposition,
    },
    id: intentId,
  } as const;
}

export const submitIntentInternal = internalMutation({
  args: {
    clientName: v.string(),
    consent: v.literal(true),
    contactEmail: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    destination: v.optional(v.string()),
    notes: v.optional(v.string()),
    operationalTestToken: v.optional(v.string()),
    paxCount: v.optional(v.number()),
    sacredBharatContext: v.optional(sacredBharatContextValidator),
    source: inboundSourceValidator,
    submissionKeyHash: v.string(),
    synthetic: v.optional(v.boolean()),
    travelStartDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => await createIntent(ctx, args),
  returns: v.object({
    duplicate: v.boolean(),
    effects: gatewayResultValidator.fields.effects,
    id: v.union(v.id("inboundQueryIntents"), v.null()),
  }),
});

/**
 * Server-only bridge called by the same-origin Next route after its request,
 * Turnstile, and payload checks. The secret is never exposed to the browser.
 */
export const submitIntentGateway = mutation({
  args: {
    clientName: v.string(),
    consent: v.literal(true),
    contactEmail: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    destination: v.optional(v.string()),
    gatewaySecret: v.string(),
    notes: v.optional(v.string()),
    operationalTestToken: v.optional(v.string()),
    paxCount: v.optional(v.number()),
    rateLimitKeyHash: v.string(),
    sacredBharatContext: v.optional(sacredBharatContextValidator),
    source: inboundSourceValidator,
    submissionKeyHash: v.string(),
    synthetic: v.optional(v.boolean()),
    travelStartDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GatewayResult> => {
    assertGatewaySecret(args.gatewaySecret);
    if (!HASH_PATTERN.test(args.rateLimitKeyHash)) {
      throw new ConvexError("Invalid inbound rate-limit key");
    }
    validateIntentInput(args);

    const now = Date.now();
    const test = operationalTestContext(args);
    const intakeControl = await resolveOperationalControl(ctx, "inbound.crm_intake", {
      at: now,
      test,
    });
    if (!intakeControl.enabled) {
      await recordOperationalEffect(ctx, {
        control: intakeControl,
        disposition: "suppressed",
        effectId: inboundAttemptEffectId(
          args.submissionKeyHash,
          intakeControl.testSessionId,
          "crm_intake"
        ),
        entityType: "inboundQueryIntent",
        synthetic: args.synthetic,
      });
      return {
        effects: { crmIntake: "suppressed", ...noNotificationEffects },
        intentId: null,
        status: "disabled",
      };
    }
    const existing = await findRecentDuplicate(
      ctx,
      args.submissionKeyHash,
      now,
      intakeControl.testSessionId
    );
    if (existing) {
      await recordOperationalEffect(ctx, {
        control: intakeControl,
        disposition: "duplicate",
        effectId: `inbound:${String(existing._id)}:crm_intake:duplicate`,
        entityId: String(existing._id),
        entityType: "inboundQueryIntent",
        synthetic: args.synthetic,
      });
      return {
        effects: { crmIntake: "duplicate", ...noNotificationEffects },
        intentId: existing._id,
        status: "duplicate" as const,
      };
    }

    const rateLimit = args.synthetic
      ? null
      : await ctx.db
          .query("inboundIntentRateLimits")
          .withIndex("by_keyHash", (q) => q.eq("keyHash", args.rateLimitKeyHash))
          .unique();
    if (rateLimit && now < rateLimit.resetAt && rateLimit.count >= INBOUND_RATE_LIMIT) {
      await recordOperationalEffect(ctx, {
        control: intakeControl,
        disposition: "throttled",
        effectId: inboundAttemptEffectId(
          args.submissionKeyHash,
          intakeControl.testSessionId,
          "crm_intake:throttled"
        ),
        entityType: "inboundQueryIntent",
        synthetic: args.synthetic,
      });
      return {
        effects: { crmIntake: "throttled", ...noNotificationEffects },
        intentId: null,
        status: "throttled" as const,
      };
    }

    if (!args.synthetic && (!rateLimit || now >= rateLimit.resetAt)) {
      const values = {
        count: 1,
        expiresAt: now + INBOUND_RATE_WINDOW_MS + INBOUND_RATE_RETENTION_MS,
        keyHash: args.rateLimitKeyHash,
        resetAt: now + INBOUND_RATE_WINDOW_MS,
      };
      if (rateLimit) {
        await ctx.db.patch("inboundIntentRateLimits", rateLimit._id, values);
      } else {
        await ctx.db.insert("inboundIntentRateLimits", values);
      }
    } else if (!args.synthetic && rateLimit) {
      await ctx.db.patch("inboundIntentRateLimits", rateLimit._id, { count: rateLimit.count + 1 });
    }

    const created: {
      duplicate: boolean;
      effects: GatewayResult["effects"];
      id: Id<"inboundQueryIntents"> | null;
    } = await ctx.runMutation(internal.crm.inboundQueryIntents.submitIntentInternal, {
      clientName: args.clientName,
      consent: true,
      contactEmail: args.contactEmail,
      contactMobile: args.contactMobile,
      destination: args.destination,
      notes: args.notes,
      operationalTestToken: args.operationalTestToken,
      paxCount: args.paxCount,
      sacredBharatContext: args.sacredBharatContext,
      source: args.source,
      submissionKeyHash: args.submissionKeyHash,
      synthetic: args.synthetic,
      travelStartDate: args.travelStartDate,
    });
    let status: GatewayResult["status"] = "created";
    if (created.id === null) {
      status = "disabled";
    } else if (created.duplicate) {
      status = "duplicate";
    }
    return {
      effects: created.effects,
      intentId: created.id,
      status,
    };
  },
  returns: gatewayResultValidator,
});

export const list = query({
  args: {
    createdAtFrom: v.optional(v.number()),
    createdAtTo: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    source: v.optional(inboundSourceValidator),
    status: v.optional(inboundStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireInboundSales(ctx);
    const paginationOpts = boundedPaginationOptions(args.paginationOpts);
    const statusFilter = args.status ?? "pending";
    const sourceFilter = args.source;
    const searchTerm = args.search?.trim();
    if (searchTerm) {
      const searchable = ctx.db.query("inboundQueryIntents").withSearchIndex("search_list", (q) => {
        let searchQuery = q.search("listSearchText", searchTerm);
        if (statusFilter) {
          searchQuery = searchQuery.eq("status", statusFilter);
        }
        if (sourceFilter) {
          searchQuery = searchQuery.eq("source", sourceFilter);
        }
        return searchQuery;
      });
      if (args.createdAtFrom !== undefined || args.createdAtTo !== undefined) {
        return presentInboundIntentPage(
          await searchable
            .filter((q) => {
              if (args.createdAtFrom !== undefined && args.createdAtTo !== undefined) {
                return q.and(
                  q.gte(q.field("createdAt"), args.createdAtFrom),
                  q.lte(q.field("createdAt"), args.createdAtTo)
                );
              }
              if (args.createdAtFrom !== undefined) {
                return q.gte(q.field("createdAt"), args.createdAtFrom);
              }
              // SAFETY: this final branch is reached only when createdAtTo is defined.
              return q.lte(q.field("createdAt"), args.createdAtTo as number);
            })
            .paginate(paginationOpts)
        );
      }
      return presentInboundIntentPage(await searchable.paginate(paginationOpts));
    }

    let intentsQuery = ctx.db
      .query("inboundQueryIntents")
      .withIndex("by_status", (q) => q.eq("status", statusFilter))
      .order("desc");
    if (sourceFilter || args.createdAtFrom !== undefined || args.createdAtTo !== undefined) {
      intentsQuery = intentsQuery.filter((q) => {
        const clauses: ReturnType<typeof q.eq>[] = [];
        if (sourceFilter) {
          clauses.push(q.eq(q.field("source"), sourceFilter));
        }
        if (args.createdAtFrom !== undefined) {
          clauses.push(q.gte(q.field("createdAt"), args.createdAtFrom));
        }
        if (args.createdAtTo !== undefined) {
          clauses.push(q.lte(q.field("createdAt"), args.createdAtTo));
        }
        if (clauses.length === 1) {
          return clauses[0];
        }
        return q.and(...clauses);
      });
    }
    return presentInboundIntentPage(await intentsQuery.paginate(paginationOpts));
  },
  returns: paginationResultValidator(inboundIntentPublicValidator),
});

async function getSalesIntent(
  ctx: Parameters<typeof requireStaff>[0],
  intentId: Id<"inboundQueryIntents">
) {
  await requireInboundSales(ctx);
  return await ctx.db.get("inboundQueryIntents", intentId);
}

export const getForSales = query({
  args: { intentId: v.id("inboundQueryIntents") },
  handler: async (ctx, args) => {
    const intent = await getSalesIntent(ctx, args.intentId);
    return intent ? presentInboundIntent(intent) : null;
  },
  returns: v.union(inboundIntentPublicValidator, v.null()),
});

/** Compatibility name retained for existing notification consumers. */
export const getPendingIntent = query({
  args: { intentId: v.id("inboundQueryIntents") },
  handler: async (ctx, args) => {
    const intent = await getSalesIntent(ctx, args.intentId);
    return intent?.status === "pending" ? presentInboundIntent(intent) : null;
  },
  returns: v.union(inboundIntentPublicValidator, v.null()),
});

function markIntentConvertedPatch(
  queryId: Id<"queries">,
  staffId: Id<"staffUsers">,
  triagedAt: number
) {
  return {
    convertedAt: triagedAt,
    convertedQueryId: String(queryId),
    status: "converted" as const,
    triagedAt,
    triagedByStaffId: staffId,
  };
}

async function handoffEventForIntent(ctx: MutationCtx, intent: Doc<"inboundQueryIntents">) {
  if (intent.handoffEventId) {
    const event = await ctx.db.get("crmHandoffEvents", intent.handoffEventId);
    if (event?.inboundIntentId === intent._id) {
      return event;
    }
  }
  // Compatibility path for rows created before handoffEventId was stored.
  // The staged direct index replaces this bounded rollout fallback only after
  // every target reports index readiness.
  return await ctx.db
    .query("crmHandoffEvents")
    .withIndex("by_createdAt")
    .order("desc")
    .filter((q) => q.eq(q.field("inboundIntentId"), intent._id))
    .first();
}

export const convertToQuery = mutation({
  args: {
    budgetAmount: v.optional(v.number()),
    clientName: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    destination: v.optional(v.string()),
    intentId: v.id("inboundQueryIntents"),
    notes: v.optional(v.string()),
    paxCount: v.number(),
    queryType: queryTypeValidator,
    salesOwnerName: v.optional(v.string()),
    salesOwnerStaffId: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
    travelType: travelTypeValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireInboundSales(ctx);
    if (!access.staffId) {
      throw new ConvexError("FORBIDDEN");
    }
    const intent = await ctx.db.get("inboundQueryIntents", args.intentId);
    if (!intent) {
      throw new ConvexError("Inbound intent not found");
    }
    if (intent.isSynthetic) {
      throw new ConvexError("Synthetic inbound intents cannot be converted");
    }
    if (intent.status === "converted" && intent.convertedQueryId) {
      const existingQueryId = ctx.db.normalizeId("queries", intent.convertedQueryId);
      const existingQuery = existingQueryId ? await ctx.db.get("queries", existingQueryId) : null;
      if (existingQuery) {
        return {
          intentId: intent._id,
          queryCode: existingQuery.queryCode,
          queryId: existingQuery._id,
          replayed: true,
        };
      }
    }
    if (intent.status !== "pending") {
      throw new ConvexError("Inbound intent has already been triaged");
    }

    const created = await handleQueryCreate(ctx, {
      budgetAmount: args.budgetAmount,
      clientName: args.clientName?.trim() || intent.clientName,
      contactEmail: intent.contactEmail,
      contactMobile: args.contactMobile?.trim() || intent.contactMobile,
      contactPerson: args.contactPerson?.trim(),
      destination: args.destination?.trim() || intent.destination,
      inboundIntentId: args.intentId,
      notes: args.notes?.trim() || undefined,
      paxCount: args.paxCount,
      queryType: args.queryType,
      salesOwnerName: args.salesOwnerName,
      salesOwnerStaffId: args.salesOwnerStaffId,
      source: intent.source,
      sourceConsentAt: intent.consentAt,
      travelEndDate: args.travelEndDate,
      travelStartDate: args.travelStartDate || intent.travelStartDate,
      travelType: args.travelType,
    });

    const triagedAt = Date.now();
    await ctx.db.patch(
      "inboundQueryIntents",
      args.intentId,
      markIntentConvertedPatch(created.id, access.staffId, triagedAt)
    );
    const event = await handoffEventForIntent(ctx, intent);
    if (event) {
      await ctx.db.patch("crmHandoffEvents", event._id, { convertedQueryId: String(created.id) });
    }
    return {
      intentId: args.intentId,
      queryCode: created.queryCode,
      queryId: created.id,
      replayed: false,
    };
  },
  returns: convertResultValidator,
});

export const dismiss = mutation({
  args: {
    dismissalReason: dismissalReasonValidator,
    intentId: v.id("inboundQueryIntents"),
  },
  handler: async (ctx, args) => {
    const access = await requireInboundSales(ctx);
    if (!access.staffId) {
      throw new ConvexError("FORBIDDEN");
    }
    const intent = await ctx.db.get("inboundQueryIntents", args.intentId);
    if (!intent) {
      throw new ConvexError("Inbound intent not found");
    }
    if (intent.status === "dismissed" && intent.dismissalReason === args.dismissalReason) {
      return { intentId: intent._id, replayed: true, status: "dismissed" as const };
    }
    if (intent.status !== "pending") {
      throw new ConvexError("Inbound intent has already been triaged");
    }
    const triagedAt = Date.now();
    await ctx.db.patch("inboundQueryIntents", args.intentId, {
      dismissalReason: args.dismissalReason,
      dismissedAt: triagedAt,
      status: "dismissed",
      triagedAt,
      triagedByStaffId: access.staffId,
    });
    return { intentId: intent._id, replayed: false, status: "dismissed" as const };
  },
  returns: dismissResultValidator,
});

export const handoffSummary = query({
  args: { sinceMs: v.number() },
  handler: async (ctx, args) => {
    await requireInboundSales(ctx);
    const events = await ctx.db
      .query("crmHandoffEvents")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", args.sinceMs))
      .collect();
    const businessEvents = events.filter((event) => event.isSynthetic !== true);
    return {
      converted: businessEvents.filter((event) => Boolean(event.convertedQueryId)).length,
      total: businessEvents.length,
    };
  },
  returns: v.object({
    converted: v.number(),
    total: v.number(),
  }),
});
