import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  canSeeJobCardRecord,
  isExternalTourManagerAccess,
  PERMISSIONS,
  type PortalAccess,
  requireStaff,
} from "./crm/lib";
import { createActivity } from "./crm/lib/activity";
import { resolveTravellerAccess, travellerInGroupScope } from "./crm/tourManagerGroupScope";
import {
  TRIP_INVITE_BATCH_LIMIT,
  TRIP_INVITE_HASH_PATTERN,
  TRIP_INVITE_TTL_MS,
} from "./lib/customerTripInvites";

/**
 * Staff side of customer-app trip invites (ADR 0020). Operations create one single-use invite per
 * adult Traveller; the browser makes the token and sends only its hash, then shows the link once
 * so staff can send it. Sending through sent.dm (SMS or WhatsApp) and bulk sending are a later
 * delivery step on top of the same records: `channel` says how the link went out.
 */

const channelValidator = v.union(
  v.literal("link"),
  v.literal("email"),
  v.literal("sms"),
  v.literal("whatsapp")
);

const inviteRowValidator = v.object({
  appAccess: v.union(v.literal("none"), v.literal("invited"), v.literal("joined")),
  fullName: v.string(),
  invite: v.union(
    v.null(),
    v.object({
      channel: channelValidator,
      claimedAt: v.union(v.number(), v.null()),
      createdAt: v.number(),
      createdByName: v.string(),
      expiresAt: v.number(),
      id: v.id("customerTripInvites"),
      status: v.union(
        v.literal("pending"),
        v.literal("claimed"),
        v.literal("revoked"),
        v.literal("expired")
      ),
    })
  ),
  /** Why staff cannot invite this Traveller, or null when they can. */
  inviteBlockedReason: v.union(v.null(), v.literal("minor"), v.literal("age_not_recorded")),
  isMinor: v.boolean(),
  travellerId: v.id("travellers"),
});

function inviteBlockedReason(traveller: Doc<"travellers">) {
  if (traveller.isMinor === true) {
    return "minor" as const;
  }
  // ADR 0018: an unset minor flag means the age was not recorded, never that the person is adult.
  return traveller.isMinor === false ? null : ("age_not_recorded" as const);
}

/**
 * The Job Card and the travellers the caller may see on it: a Tour Manager-only grant narrows to
 * their own groups, as on the CRM traveller list.
 */
async function loadInviteJob(ctx: QueryCtx | MutationCtx, access: PortalAccess, rawId: string) {
  if (isExternalTourManagerAccess(access)) {
    throw new ConvexError("FORBIDDEN");
  }
  const jobCardId = ctx.db.normalizeId("jobCards", rawId);
  const job = jobCardId ? await ctx.db.get("jobCards", jobCardId) : null;
  const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
    throw new ConvexError("Job Card not found");
  }
  const travellerAccess = await resolveTravellerAccess(ctx, access, job, linkedQuery);
  if (!travellerAccess) {
    throw new ConvexError("Job Card not found");
  }
  return {
    inScope: (traveller: Pick<Doc<"travellers">, "travelBatchId">) =>
      travellerInGroupScope(travellerAccess.scope, traveller),
    job,
  };
}

async function latestInvite(ctx: QueryCtx | MutationCtx, travellerId: Id<"travellers">) {
  return await ctx.db
    .query("customerTripInvites")
    .withIndex("by_travellerId_and_createdAt", (q) => q.eq("travellerId", travellerId))
    .order("desc")
    .first();
}

async function activeTravellerEntitlement(
  ctx: QueryCtx | MutationCtx,
  travellerId: Id<"travellers">
) {
  const rows = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
    .take(5);
  return rows.find((row) => row.revokedAt === undefined) ?? null;
}

function inviteStatus(invite: Doc<"customerTripInvites">, now: number) {
  if (invite.status === "pending" && invite.expiresAt <= now) {
    return "expired" as const;
  }
  return invite.status;
}

/**
 * Each Traveller on the Job Card with their invite and app-access state, for the invite panel,
 * and whether the caller may create invites.
 */
export const listForJobCard = query({
  args: { jobCardId: v.string(), referenceNow: v.number() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const { inScope, job } = await loadInviteJob(ctx, access, args.jobCardId);
    const travellers = await ctx.db
      .query("travellers")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
      .take(2000);
    const rows = await Promise.all(
      travellers
        .filter((row) => !row.cancellation && inScope(row))
        .map(async (traveller) => {
          const [invite, entitlement] = await Promise.all([
            latestInvite(ctx, traveller._id),
            activeTravellerEntitlement(ctx, traveller._id),
          ]);
          let appAccess: "none" | "invited" | "joined" = "none";
          if (entitlement) {
            appAccess = "joined";
          } else if (invite && inviteStatus(invite, args.referenceNow) === "pending") {
            appAccess = "invited";
          }
          return {
            appAccess,
            fullName: traveller.fullName,
            invite: invite
              ? {
                  channel: invite.channel,
                  claimedAt: invite.claimedAt ?? null,
                  createdAt: invite.createdAt,
                  createdByName: invite.createdByName,
                  expiresAt: invite.expiresAt,
                  id: invite._id,
                  status: inviteStatus(invite, args.referenceNow),
                }
              : null,
            inviteBlockedReason: inviteBlockedReason(traveller),
            isMinor: traveller.isMinor === true,
            travellerId: traveller._id,
          };
        })
    );
    return {
      canInvite: access.permissions.includes(PERMISSIONS.MANAGE_TRAVELLERS),
      rows: rows.sort((a, b) => a.fullName.localeCompare(b.fullName)),
    };
  },
  returns: v.object({ canInvite: v.boolean(), rows: v.array(inviteRowValidator) }),
});

/**
 * Creates single-use invites. Each item names an adult, not cancelled Traveller on this Job Card
 * and the SHA-256 hash of a fresh token. A new invite revokes that Traveller's earlier pending
 * one. Minors never get an invite: their guardians see them (ADR 0018).
 */
export const createInvites = mutation({
  args: {
    channel: channelValidator,
    invites: v.array(v.object({ tokenHash: v.string(), travellerId: v.id("travellers") })),
    jobCardId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    if (!access.staffId) {
      throw new ConvexError("FORBIDDEN");
    }
    // The batch size depends only on the arguments, so check it before reading the Job Card.
    if (args.invites.length === 0 || args.invites.length > TRIP_INVITE_BATCH_LIMIT) {
      throw new ConvexError(`Send between 1 and ${TRIP_INVITE_BATCH_LIMIT} invites at a time`);
    }
    const { inScope, job } = await loadInviteJob(ctx, access, args.jobCardId);
    const seen = new Set<string>();
    const now = Date.now();
    const created: {
      expiresAt: number;
      inviteId: Id<"customerTripInvites">;
      travellerId: Id<"travellers">;
    }[] = [];
    for (const item of args.invites) {
      if (!TRIP_INVITE_HASH_PATTERN.test(item.tokenHash) || seen.has(item.travellerId)) {
        throw new ConvexError("Each invite needs its own traveller and token");
      }
      seen.add(item.travellerId);
      // biome-ignore lint/performance/noAwaitInLoops: each invite revokes the previous one in order
      const traveller = await ctx.db.get("travellers", item.travellerId);
      if (
        !traveller ||
        traveller.jobCardId !== job._id ||
        traveller.cancellation ||
        !inScope(traveller)
      ) {
        throw new ConvexError("Traveller not found on this Job Card");
      }
      const blocked = inviteBlockedReason(traveller);
      if (blocked === "minor") {
        throw new ConvexError(`${traveller.fullName} is a minor; invite their guardian instead`);
      }
      if (blocked === "age_not_recorded") {
        throw new ConvexError(
          `Record whether ${traveller.fullName} is an adult before inviting them to the app`
        );
      }
      const reused = await ctx.db
        .query("customerTripInvites")
        .withIndex("by_tokenHash", (q) => q.eq("tokenHash", item.tokenHash))
        .first();
      if (reused) {
        throw new ConvexError("Each invite needs its own traveller and token");
      }
      const previous = await latestInvite(ctx, traveller._id);
      if (previous?.status === "pending") {
        await ctx.db.patch("customerTripInvites", previous._id, {
          revokedAt: now,
          revokedByName: access.name,
          status: "revoked",
          updatedAt: now,
        });
      }
      const expiresAt = now + TRIP_INVITE_TTL_MS;
      const inviteId = await ctx.db.insert("customerTripInvites", {
        channel: args.channel,
        createdAt: now,
        createdByName: access.name,
        createdByStaffId: access.staffId,
        expiresAt,
        jobCardId: job._id,
        status: "pending",
        tokenHash: item.tokenHash,
        travellerId: traveller._id,
        updatedAt: now,
      });
      created.push({ expiresAt, inviteId, travellerId: traveller._id });
    }
    await createActivity(ctx, access, {
      action: "customer_app_invites_created",
      entityId: job._id,
      entityType: "jobCard",
      message: `${job.jobCode}: ${created.length} customer app invite${created.length === 1 ? "" : "s"} created`,
    });
    return created;
  },
  returns: v.array(
    v.object({
      expiresAt: v.number(),
      inviteId: v.id("customerTripInvites"),
      travellerId: v.id("travellers"),
    })
  ),
});

/** Revokes a pending invite. A claimed invite is ended with `revokeTravellerAccess` instead. */
export const revokeInvite = mutation({
  args: { inviteId: v.id("customerTripInvites") },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    const invite = await ctx.db.get("customerTripInvites", args.inviteId);
    if (!invite) {
      throw new ConvexError("Invite not found");
    }
    const { inScope, job } = await loadInviteJob(ctx, access, invite.jobCardId);
    const invited = await ctx.db.get("travellers", invite.travellerId);
    if (!(invited && inScope(invited))) {
      throw new ConvexError("Invite not found");
    }
    if (invite.status !== "pending") {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch("customerTripInvites", invite._id, {
      revokedAt: now,
      revokedByName: access.name,
      status: "revoked",
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      action: "customer_app_invite_revoked",
      entityId: job._id,
      entityType: "jobCard",
      message: `${job.jobCode}: a customer app invite was revoked`,
    });
    return null;
  },
  returns: v.null(),
});

/**
 * Ends a Traveller's app access to this trip: revokes the entitlement their claimed invite made.
 * An operator grant the claim only linked to the Traveller keeps its own access (its website
 * view) and loses just the Traveller link. The account itself stays; other trips are untouched.
 */
export const revokeTravellerAccess = mutation({
  args: { travellerId: v.id("travellers") },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    const traveller = await ctx.db.get("travellers", args.travellerId);
    if (!traveller) {
      throw new ConvexError("Traveller not found");
    }
    // Both are reads; if the Job Card check throws, the mutation fails and nothing is written.
    const [{ inScope, job }, entitlement] = await Promise.all([
      loadInviteJob(ctx, access, traveller.jobCardId),
      activeTravellerEntitlement(ctx, traveller._id),
    ]);
    if (!inScope(traveller)) {
      throw new ConvexError("Traveller not found");
    }
    if (!entitlement) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(
      "customerJourneyEntitlements",
      entitlement._id,
      entitlement.source === "trip_invite"
        ? { revokedAt: now, updatedAt: now }
        : { travellerId: undefined, updatedAt: now }
    );
    await createActivity(ctx, access, {
      action: "customer_app_access_revoked",
      entityId: job._id,
      entityType: "jobCard",
      message: `${job.jobCode}: customer app access ended for one traveller`,
    });
    return null;
  },
  returns: v.null(),
});
