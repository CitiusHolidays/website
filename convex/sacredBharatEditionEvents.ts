import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { isAdmin, requireStaff } from "./crm/lib/staffAccess";

const EDITION = "001" as const;
const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const METRICS_READ_LIMIT = 2000;
const PLAYER_TOKEN_PATTERN = /^[a-f0-9]{24}$/;
const SHARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/;
const EVENT_ID_PATTERN = /^[a-f0-9]{32}$/;

const eventValidator = v.union(
  v.literal("edition_started"),
  v.literal("question_answered"),
  v.literal("edition_completed"),
  v.literal("share_clicked"),
  v.literal("share_link_copied"),
  v.literal("result_downloaded"),
  v.literal("journey_cta_clicked"),
  v.literal("edition_restarted")
);
const questionIdValidator = v.union(
  v.literal("varanasi"),
  v.literal("amritsar"),
  v.literal("madurai"),
  v.literal("kedarnath"),
  v.literal("konark")
);
const styleValidator = v.union(v.literal("archive"), v.literal("temple-red"), v.literal("monsoon"));

type EditionEvent =
  | "edition_started"
  | "question_answered"
  | "edition_completed"
  | "share_clicked"
  | "share_link_copied"
  | "result_downloaded"
  | "journey_cta_clicked"
  | "edition_restarted";

interface EventPayload {
  correct?: boolean;
  event: EditionEvent;
  questionId?: "varanasi" | "amritsar" | "madurai" | "kedarnath" | "konark";
  referrerToken?: string;
  score?: number;
  shareToken?: string;
  style?: "archive" | "temple-red" | "monsoon";
}

function assertGatewaySecret(secret: string) {
  const expected = process.env.SACRED_BHARAT_EVENT_GATEWAY_SECRET?.trim();
  if (!(expected && secret === expected)) {
    throw new ConvexError("FORBIDDEN");
  }
}

function assertPlayerToken(token: string) {
  if (!PLAYER_TOKEN_PATTERN.test(token)) {
    throw new ConvexError("INVALID_SACRED_BHARAT_PLAYER_TOKEN");
  }
}

function assertShareToken(token: string, kind: "referrer" | "share") {
  if (!SHARE_TOKEN_PATTERN.test(token)) {
    throw new ConvexError(
      kind === "share"
        ? "INVALID_SACRED_BHARAT_SHARE_TOKEN"
        : "INVALID_SACRED_BHARAT_REFERRER_TOKEN"
    );
  }
}

function hasOnlyPayload(
  payload: EventPayload,
  allowed: ReadonlySet<keyof Omit<EventPayload, "event">>
) {
  return (
    ["correct", "questionId", "referrerToken", "score", "shareToken", "style"] as const
  ).every((key) => payload[key] === undefined || allowed.has(key));
}

function isValidScore(score: number | undefined) {
  return score !== undefined && Number.isInteger(score) && score >= 0 && score <= 5;
}

function assertEventPayload(payload: EventPayload) {
  let valid = false;
  switch (payload.event) {
    case "edition_started":
      valid =
        hasOnlyPayload(payload, new Set(["referrerToken", "shareToken"])) &&
        payload.shareToken !== undefined;
      break;
    case "question_answered":
      valid =
        hasOnlyPayload(payload, new Set(["correct", "questionId"])) &&
        payload.correct !== undefined &&
        payload.questionId !== undefined;
      break;
    case "edition_completed":
    case "journey_cta_clicked":
      valid = hasOnlyPayload(payload, new Set(["score"])) && isValidScore(payload.score);
      break;
    case "share_clicked":
    case "share_link_copied":
    case "result_downloaded":
      valid =
        hasOnlyPayload(payload, new Set(["score", "style"])) &&
        isValidScore(payload.score) &&
        payload.style !== undefined;
      break;
    case "edition_restarted":
      valid = hasOnlyPayload(payload, new Set());
      break;
    default:
      valid = false;
  }
  if (!valid) {
    throw new ConvexError("INVALID_SACRED_BHARAT_EVENT_PAYLOAD");
  }
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function tokenHash(token: string) {
  return hex(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

function sameOptional<T>(left: T | undefined, right: T | undefined) {
  return left === right;
}

async function assertShareTokenOwner(
  ctx: MutationCtx,
  shareTokenHash: string | undefined,
  playerTokenHash: string
) {
  if (!shareTokenHash) {
    return;
  }
  const existingShareRows = await ctx.db
    .query("sacredBharatEditionEvents")
    .withIndex("by_shareTokenHash", (index) => index.eq("shareTokenHash", shareTokenHash))
    .take(2);
  if (existingShareRows.some((row) => row.playerTokenHash !== playerTokenHash)) {
    throw new ConvexError("SACRED_BHARAT_SHARE_TOKEN_CONFLICT");
  }
}

async function referrerPlayerForToken(
  ctx: MutationCtx,
  referrerTokenHash: string | undefined,
  playerTokenHash: string
) {
  if (!referrerTokenHash) {
    return;
  }
  const referrerRows = await ctx.db
    .query("sacredBharatEditionEvents")
    .withIndex("by_shareTokenHash", (index) => index.eq("shareTokenHash", referrerTokenHash))
    .take(2);
  const referrerPlayers = new Set(referrerRows.map((row) => row.playerTokenHash));
  if (referrerPlayers.size !== 1) {
    throw new ConvexError("INVALID_SACRED_BHARAT_REFERRER_TOKEN");
  }
  const [referrerPlayerTokenHash] = referrerPlayers;
  if (referrerPlayerTokenHash === playerTokenHash) {
    throw new ConvexError("SACRED_BHARAT_SELF_REFERRAL");
  }
  return referrerPlayerTokenHash;
}

const recordResultValidator = v.object({
  attributed: v.boolean(),
  eventRecordId: v.id("sacredBharatEditionEvents"),
  replayed: v.boolean(),
});

const purgeEdition001EventRef = makeFunctionReference<
  "mutation",
  { eventRecordId: Id<"sacredBharatEditionEvents"> },
  { deleted: boolean }
>("sacredBharatEditionEvents:purgeEdition001Event");

export const recordEdition001EventGateway = mutation({
  args: {
    correct: v.optional(v.boolean()),
    edition: v.literal("001"),
    event: eventValidator,
    eventId: v.string(),
    gatewaySecret: v.string(),
    playerToken: v.string(),
    questionId: v.optional(questionIdValidator),
    referrerToken: v.optional(v.string()),
    score: v.optional(v.number()),
    shareToken: v.optional(v.string()),
    style: v.optional(styleValidator),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    if (!EVENT_ID_PATTERN.test(args.eventId)) {
      throw new ConvexError("INVALID_SACRED_BHARAT_EVENT_ID");
    }
    assertPlayerToken(args.playerToken);
    if (args.shareToken !== undefined) {
      assertShareToken(args.shareToken, "share");
    }
    if (args.referrerToken !== undefined) {
      assertShareToken(args.referrerToken, "referrer");
    }
    assertEventPayload(args);

    const playerTokenHash = await tokenHash(args.playerToken);
    const referrerTokenHash = args.referrerToken ? await tokenHash(args.referrerToken) : undefined;
    const shareTokenHash = args.shareToken ? await tokenHash(args.shareToken) : undefined;
    const existingRows = await ctx.db
      .query("sacredBharatEditionEvents")
      .withIndex("by_eventId", (index) => index.eq("eventId", args.eventId))
      .take(2);
    if (existingRows.length > 1) {
      throw new ConvexError("SACRED_BHARAT_EVENT_ID_CONFLICT");
    }
    const [existing] = existingRows;
    if (existing) {
      const sameCommand =
        existing.edition === args.edition &&
        existing.event === args.event &&
        existing.playerTokenHash === playerTokenHash &&
        sameOptional(existing.referrerTokenHash, referrerTokenHash) &&
        sameOptional(existing.shareTokenHash, shareTokenHash) &&
        sameOptional(existing.correct, args.correct) &&
        sameOptional(existing.questionId, args.questionId) &&
        sameOptional(existing.score, args.score) &&
        sameOptional(existing.style, args.style);
      if (!sameCommand) {
        throw new ConvexError("SACRED_BHARAT_EVENT_ID_CONFLICT");
      }
      return {
        attributed: existing.attributedReferrerPlayerTokenHash !== undefined,
        eventRecordId: existing._id,
        replayed: true,
      };
    }

    const now = Date.now();
    await assertShareTokenOwner(ctx, shareTokenHash, playerTokenHash);
    const referrerPlayerTokenHash = await referrerPlayerForToken(
      ctx,
      referrerTokenHash,
      playerTokenHash
    );
    const latest = await ctx.db
      .query("sacredBharatEditionEvents")
      .withIndex("by_playerTokenHash_createdAt", (index) =>
        index.eq("playerTokenHash", playerTokenHash)
      )
      .order("desc")
      .first();
    const activePriorAttribution =
      latest?.attributedReferrerPlayerTokenHash &&
      latest.attributionExpiresAt !== undefined &&
      latest.attributionExpiresAt > now
        ? {
            expiresAt: latest.attributionExpiresAt,
            referrerPlayerTokenHash: latest.attributedReferrerPlayerTokenHash,
          }
        : null;
    const attribution = referrerPlayerTokenHash
      ? {
          expiresAt: now + ATTRIBUTION_WINDOW_MS,
          referrerPlayerTokenHash,
        }
      : activePriorAttribution;
    const eventRecordId = await ctx.db.insert("sacredBharatEditionEvents", {
      ...(attribution
        ? {
            attributedReferrerPlayerTokenHash: attribution.referrerPlayerTokenHash,
            attributionExpiresAt: attribution.expiresAt,
          }
        : {}),
      correct: args.correct,
      createdAt: now,
      edition: EDITION,
      event: args.event,
      eventId: args.eventId,
      playerTokenHash,
      questionId: args.questionId,
      referrerTokenHash,
      score: args.score,
      shareTokenHash,
      style: args.style,
    });
    await ctx.scheduler.runAt(now + ATTRIBUTION_WINDOW_MS, purgeEdition001EventRef, {
      eventRecordId,
    });
    return { attributed: attribution !== null, eventRecordId, replayed: false };
  },
  returns: recordResultValidator,
});

export const purgeEdition001Event = internalMutation({
  args: { eventRecordId: v.id("sacredBharatEditionEvents") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventRecordId);
    if (!event) {
      return { deleted: false };
    }
    const purgeAt = event.createdAt + ATTRIBUTION_WINDOW_MS;
    if (Date.now() < purgeAt) {
      await ctx.scheduler.runAt(purgeAt, purgeEdition001EventRef, args);
      return { deleted: false };
    }
    await ctx.db.delete(event._id);
    return { deleted: true };
  },
  returns: v.object({ deleted: v.boolean() }),
});

async function requireExactAdmin(ctx: Parameters<typeof requireStaff>[0]) {
  const access = await requireStaff(ctx);
  if (!(access.staffId && isAdmin(access))) {
    throw new ConvexError("FORBIDDEN");
  }
}

const eventCountsValidator = v.object({
  edition_completed: v.number(),
  edition_restarted: v.number(),
  edition_started: v.number(),
  journey_cta_clicked: v.number(),
  question_answered: v.number(),
  result_downloaded: v.number(),
  share_clicked: v.number(),
  share_link_copied: v.number(),
});

export const getEdition001AttributionMetrics = query({
  args: {
    edition: v.literal("001"),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    await requireExactAdmin(ctx);
    if (
      !(Number.isFinite(args.from) && Number.isFinite(args.to)) ||
      args.from < 0 ||
      args.to < args.from ||
      args.to - args.from > ATTRIBUTION_WINDOW_MS
    ) {
      throw new ConvexError("INVALID_SACRED_BHARAT_METRICS_RANGE");
    }
    const page = await ctx.db
      .query("sacredBharatEditionEvents")
      .withIndex("by_edition_createdAt", (index) =>
        index.eq("edition", EDITION).gte("createdAt", args.from).lte("createdAt", args.to)
      )
      .take(METRICS_READ_LIMIT + 1);
    const rows = page.slice(0, METRICS_READ_LIMIT);
    const eventCounts: Record<EditionEvent, number> = {
      edition_completed: 0,
      edition_restarted: 0,
      edition_started: 0,
      journey_cta_clicked: 0,
      question_answered: 0,
      result_downloaded: 0,
      share_clicked: 0,
      share_link_copied: 0,
    };
    for (const row of rows) {
      eventCounts[row.event] += 1;
    }
    return {
      anonymousPlayers: new Set(rows.map((row) => row.playerTokenHash)).size,
      attributedCompletions: rows.filter(
        (row) =>
          row.event === "edition_completed" && row.attributedReferrerPlayerTokenHash !== undefined
      ).length,
      attributedStarts: rows.filter(
        (row) =>
          row.event === "edition_started" && row.attributedReferrerPlayerTokenHash !== undefined
      ).length,
      eventCounts,
      scannedEvents: rows.length,
      truncated: page.length > METRICS_READ_LIMIT,
    };
  },
  returns: v.object({
    anonymousPlayers: v.number(),
    attributedCompletions: v.number(),
    attributedStarts: v.number(),
    eventCounts: eventCountsValidator,
    scannedEvents: v.number(),
    truncated: v.boolean(),
  }),
});
