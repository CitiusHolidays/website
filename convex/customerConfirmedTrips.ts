import type { PaginationOptions } from "convex/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { resolveCommandReceipt, storeCommandReceipt } from "./crm/commandReceipts";
import { canSeeQueryRecord, PERMISSIONS, requireStaff } from "./crm/lib";
import { createActivity } from "./crm/lib/activity";
import {
  journeyReminderPreferenceValidator,
  reminderPreferenceForEntitlement,
  suppressQueuedJourneyRemindersForEntitlement,
} from "./customerJourneyReminders";
import { canonicalAuthUserId } from "./lib/authIdentity";
import {
  authoritativeConfirmedTimestamp,
  confirmedTravelSummaryProjection,
} from "./lib/customerConfirmedTripReadiness";
import { upsertConfirmedJourneyEntitlement } from "./lib/customerIdentityAccess";
import { isRuntimeObject, isRuntimeString, type RuntimeValue } from "./lib/runtimeValues";

const CONFIRMED_TRIP_PAGE_SIZE = 20;
const MAX_ENTITLEMENT_SIBLINGS = 20;
const GRANT_ACCESS_OPERATION = "customer_journey_access.grant";
const REVOKE_ACCESS_OPERATION = "customer_journey_access.revoke";
const RESTORE_ACCESS_OPERATION = "customer_journey_access.restore";

const accountHolderOptionValidator = v.object({
  email: v.string(),
  id: v.id("userProfiles"),
  name: v.string(),
});

const accessChangeValidator = v.object({
  action: v.union(v.literal("granted"), v.literal("revoked"), v.literal("restored")),
  actorName: v.string(),
  at: v.number(),
  reason: v.union(v.string(), v.null()),
});

const confirmedTripAccessValidator = v.object({
  accountHolder: v.object({
    email: v.string(),
    id: v.union(v.id("userProfiles"), v.null()),
    name: v.string(),
  }),
  grantedAt: v.number(),
  grantedBy: v.union(v.string(), v.null()),
  id: v.id("customerJourneyEntitlements"),
  lastChange: v.union(accessChangeValidator, v.null()),
  revokedAt: v.union(v.number(), v.null()),
  role: v.union(v.literal("organizer"), v.literal("traveller")),
  source: v.union(v.literal("crm_operator_grant"), v.literal("identity_migration")),
  status: v.union(v.literal("active"), v.literal("revoked")),
  updatedAt: v.number(),
});

const confirmedTripAccessContextValidator = v.object({
  destination: v.string(),
  queryCode: v.string(),
  travelEndDate: v.union(v.string(), v.null()),
  travelStartDate: v.string(),
});

const accessMutationResultValidator = v.object({
  changed: v.boolean(),
  entitlementId: v.id("customerJourneyEntitlements"),
  status: v.union(v.literal("active"), v.literal("revoked")),
});

const confirmedTripPacketValidator = v.object({
  confirmation: v.object({
    at: v.union(v.number(), v.null()),
    status: v.union(v.literal("confirmed"), v.literal("unknown")),
  }),
  confirmedOfferId: v.id("confirmedOffers"),
  entitlement: v.object({
    role: v.union(v.literal("organizer"), v.literal("traveller")),
    source: v.union(v.literal("crm_operator_grant"), v.literal("identity_migration")),
  }),
  nextAction: v.object({
    kind: v.literal("download_arrival_pack"),
    label: v.literal("Download offline Arrival Pack"),
  }),
  readOnly: v.literal(true as const),
  reminders: journeyReminderPreferenceValidator,
  staySummary: v.object({
    asOf: v.null(),
    source: v.literal("unknown"),
    status: v.literal("unknown"),
    summary: v.null(),
  }),
  travel: v.object({
    asOf: v.union(v.number(), v.null()),
    destination: v.union(v.string(), v.null()),
    endDate: v.union(v.string(), v.null()),
    source: v.literal("confirmed_offer"),
    startDate: v.union(v.string(), v.null()),
  }),
});

async function packetForQuery(
  ctx: QueryCtx,
  queryRow: Doc<"queries">,
  entitlement: Doc<"customerJourneyEntitlements">
) {
  if (
    !queryRow.confirmedOfferId ||
    queryRow.confirmedOfferId !== entitlement.confirmedOfferId ||
    entitlement.role === "purchaser" ||
    entitlement.source === "public_booking_owner"
  ) {
    return null;
  }
  const offer = await ctx.db.get("confirmedOffers", queryRow.confirmedOfferId);
  if (!(offer && offer.queryId === queryRow._id)) {
    return null;
  }
  const confirmedAt = authoritativeConfirmedTimestamp(offer.confirmedAt);
  const handoff =
    offer.proposalQueryHandoffId &&
    Number.isSafeInteger(offer.proposalRevision) &&
    Number(offer.proposalRevision) > 0
      ? await ctx.db.get("proposalQueryHandoffs", offer.proposalQueryHandoffId)
      : null;
  const travel = confirmedTravelSummaryProjection({ handoff, offer, queryId: queryRow._id });
  const reminders = await reminderPreferenceForEntitlement(ctx, entitlement);
  return {
    confirmation: {
      at: confirmedAt,
      status: confirmedAt === null ? ("unknown" as const) : ("confirmed" as const),
    },
    confirmedOfferId: offer._id,
    entitlement: { role: entitlement.role, source: entitlement.source },
    nextAction: {
      kind: "download_arrival_pack" as const,
      label: "Download offline Arrival Pack" as const,
    },
    readOnly: true as const,
    reminders,
    staySummary: {
      asOf: null,
      source: "unknown" as const,
      status: "unknown" as const,
      summary: null,
    },
    travel: {
      ...travel,
      source: "confirmed_offer" as const,
    },
  };
}

function boundedPaginationOptions(options: PaginationOptions): PaginationOptions {
  return {
    ...options,
    maximumRowsRead: CONFIRMED_TRIP_PAGE_SIZE,
    numItems: Math.max(1, Math.min(options.numItems, CONFIRMED_TRIP_PAGE_SIZE)),
  };
}

function isConfirmedTripEntitlement(
  row: Doc<"customerJourneyEntitlements">
): row is Doc<"customerJourneyEntitlements"> & {
  confirmedOfferId: Id<"confirmedOffers">;
  queryId: Id<"queries">;
  role: "organizer" | "traveller";
  source: "crm_operator_grant" | "identity_migration";
} {
  return (
    row.revokedAt === undefined &&
    row.queryId !== undefined &&
    row.confirmedOfferId !== undefined &&
    row.capabilities.includes("view_confirmed_trip") &&
    row.role !== "purchaser" &&
    row.source !== "public_booking_owner"
  );
}

async function authorizedConfirmedTripEntitlement(
  ctx: QueryCtx,
  row: Doc<"customerJourneyEntitlements">
) {
  if (!isConfirmedTripEntitlement(row)) {
    return null;
  }
  const siblings = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_confirmedOfferId_authUserId", (q) =>
      q.eq("confirmedOfferId", row.confirmedOfferId).eq("authUserId", row.authUserId)
    )
    .take(2);
  return siblings.length === 1 && siblings[0]._id === row._id ? row : null;
}

function isManagedConfirmedTripEntitlement(
  row: Doc<"customerJourneyEntitlements">
): row is Doc<"customerJourneyEntitlements"> & {
  confirmedOfferId: Id<"confirmedOffers">;
  queryId: Id<"queries">;
  role: "organizer" | "traveller";
  source: "crm_operator_grant" | "identity_migration";
} {
  return (
    row.queryId !== undefined &&
    row.confirmedOfferId !== undefined &&
    row.capabilities.includes("view_confirmed_trip") &&
    row.role !== "purchaser" &&
    row.source !== "public_booking_owner"
  );
}

async function requireManagedConfirmedQuery(ctx: QueryCtx | MutationCtx, queryId: Id<"queries">) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
  const { staffId } = access;
  if (!staffId) {
    throw new ConvexError("FORBIDDEN");
  }
  const queryRow = await ctx.db.get("queries", queryId);
  const confirmedOfferId = queryRow?.confirmedOfferId;
  if (!(queryRow && confirmedOfferId && canSeeQueryRecord(access, queryRow))) {
    throw new ConvexError("Confirmed Query not found");
  }
  const offer = await ctx.db.get("confirmedOffers", confirmedOfferId);
  if (!(offer && offer.queryId === queryRow._id)) {
    throw new ConvexError("Confirmed Query not found");
  }
  return { access, confirmedOfferId, offer, queryRow, staffId };
}

function requiredAccessReason(value: string) {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 240) {
    throw new ConvexError("Reason must be between 3 and 240 characters");
  }
  return reason;
}

function activityReason(metadata: RuntimeValue) {
  if (!(isRuntimeObject(metadata) && "reason" in metadata && isRuntimeString(metadata.reason))) {
    return null;
  }
  return metadata.reason;
}

async function entitlementActivity(
  ctx: QueryCtx,
  entitlementId: Id<"customerJourneyEntitlements">
) {
  return await ctx.db
    .query("activityLogs")
    .withIndex("by_entity", (q) =>
      q.eq("entityType", "customerJourneyEntitlement").eq("entityId", String(entitlementId))
    )
    .order("desc")
    .first();
}

async function requireManagedEntitlement(
  ctx: MutationCtx,
  queryId: Id<"queries">,
  entitlementId: Id<"customerJourneyEntitlements">
) {
  const managed = await requireManagedConfirmedQuery(ctx, queryId);
  const entitlement = await ctx.db.get("customerJourneyEntitlements", entitlementId);
  if (
    !(
      entitlement &&
      isManagedConfirmedTripEntitlement(entitlement) &&
      entitlement.queryId === queryId &&
      entitlement.confirmedOfferId === managed.queryRow.confirmedOfferId
    )
  ) {
    throw new ConvexError("Journey Entitlement not found");
  }
  return { ...managed, entitlement };
}

async function managedEntitlementSiblings(
  ctx: MutationCtx,
  entitlement: Doc<"customerJourneyEntitlements"> & {
    confirmedOfferId: Id<"confirmedOffers">;
    queryId: Id<"queries">;
  }
) {
  const rows = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_confirmedOfferId_authUserId", (q) =>
      q
        .eq("confirmedOfferId", entitlement.confirmedOfferId)
        .eq("authUserId", entitlement.authUserId)
    )
    .take(MAX_ENTITLEMENT_SIBLINGS + 1);
  if (rows.length > MAX_ENTITLEMENT_SIBLINGS) {
    throw new ConvexError("JOURNEY_ENTITLEMENT_CONFLICT");
  }
  const siblings = rows.filter(
    (row) =>
      isManagedConfirmedTripEntitlement(row) &&
      row.queryId === entitlement.queryId &&
      row.confirmedOfferId === entitlement.confirmedOfferId
  );
  if (siblings.length !== rows.length) {
    throw new ConvexError("JOURNEY_ENTITLEMENT_CONFLICT");
  }
  return siblings;
}

export async function loadConfirmedTripPacketPage(
  ctx: QueryCtx,
  authUserId: string,
  paginationOpts: PaginationOptions
) {
  const entitlementPage = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_authUserId_createdAt", (q) => q.eq("authUserId", authUserId))
    .order("desc")
    .paginate(boundedPaginationOptions(paginationOpts));
  const entitlements = (
    await Promise.all(
      entitlementPage.page.map((row) => authorizedConfirmedTripEntitlement(ctx, row))
    )
  ).filter((row): row is NonNullable<typeof row> => row !== null);
  const queryRows = await Promise.all(
    entitlements.map((row) => ctx.db.get("queries", row.queryId))
  );
  const packets = await Promise.all(
    entitlements.map((entitlement, index) => {
      const queryRow = queryRows[index];
      return queryRow ? packetForQuery(ctx, queryRow, entitlement) : null;
    })
  );
  return {
    ...entitlementPage,
    page: packets
      .filter((packet): packet is NonNullable<typeof packet> => packet !== null)
      .sort((left, right) =>
        (right.travel.startDate ?? "").localeCompare(left.travel.startDate ?? "")
      ),
  };
}

export const getMyConfirmedTripPackets = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const authUserId = identity ? canonicalAuthUserId(identity) : null;
    if (!authUserId) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    return await loadConfirmedTripPacketPage(ctx, authUserId, args.paginationOpts);
  },
  returns: paginationResultValidator(confirmedTripPacketValidator),
});

export const getMyConfirmedTripPacket = query({
  args: { confirmedOfferId: v.id("confirmedOffers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const authUserId = identity ? canonicalAuthUserId(identity) : null;
    if (!authUserId) {
      return null;
    }
    const entitlements = await ctx.db
      .query("customerJourneyEntitlements")
      .withIndex("by_confirmedOfferId_authUserId", (q) =>
        q.eq("confirmedOfferId", args.confirmedOfferId).eq("authUserId", authUserId)
      )
      .take(2);
    const [entitlement] = entitlements;
    if (entitlements.length !== 1 || !entitlement || !isConfirmedTripEntitlement(entitlement)) {
      return null;
    }
    const queryRow = await ctx.db.get("queries", entitlement.queryId);
    return queryRow ? await packetForQuery(ctx, queryRow, entitlement) : null;
  },
  returns: v.union(confirmedTripPacketValidator, v.null()),
});

export const listAccountHolderOptions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    queryId: v.id("queries"),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireManagedConfirmedQuery(ctx, args.queryId);
    const search = args.search?.trim().toLowerCase() ?? "";
    const result = await ctx.db
      .query("userProfiles")
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    return {
      ...result,
      page: result.page.flatMap((profile) =>
        !profile.archivedAt &&
        profile.authUserId?.includes("|") &&
        (!search ||
          profile.name.toLowerCase().includes(search) ||
          profile.email.toLowerCase().includes(search))
          ? [{ email: profile.email, id: profile._id, name: profile.name }]
          : []
      ),
    };
  },
  returns: paginationResultValidator(accountHolderOptionValidator),
});

export const listConfirmedTripAccess = query({
  args: { paginationOpts: paginationOptsValidator, queryId: v.id("queries") },
  handler: async (ctx, args) => {
    await requireManagedConfirmedQuery(ctx, args.queryId);
    const result = await ctx.db
      .query("customerJourneyEntitlements")
      .withIndex("by_queryId_authUserId", (q) => q.eq("queryId", args.queryId))
      .paginate(boundedPaginationOptions(args.paginationOpts));
    const page = await Promise.all(
      result.page.filter(isManagedConfirmedTripEntitlement).map(async (entitlement) => {
        const [accountHolder, grantedBy, lastChange] = await Promise.all([
          entitlement.accountHolderProfileId
            ? ctx.db.get("userProfiles", entitlement.accountHolderProfileId)
            : null,
          entitlement.grantedByStaffId
            ? ctx.db.get("staffUsers", entitlement.grantedByStaffId)
            : null,
          entitlementActivity(ctx, entitlement._id),
        ]);
        let action: "granted" | "revoked" | "restored" | null = null;
        if (lastChange?.action === "customer_journey_access_granted") {
          action = "granted";
        } else if (lastChange?.action === "customer_journey_access_revoked") {
          action = "revoked";
        } else if (lastChange?.action === "customer_journey_access_restored") {
          action = "restored";
        }
        return {
          accountHolder: {
            email: accountHolder?.email ?? "",
            id: accountHolder?._id ?? null,
            name: accountHolder?.name ?? "Account Holder unavailable",
          },
          grantedAt: entitlement.createdAt,
          grantedBy: grantedBy?.name ?? null,
          id: entitlement._id,
          lastChange:
            action && lastChange
              ? {
                  action,
                  actorName: lastChange.actorName,
                  at: lastChange.createdAt,
                  reason: activityReason(lastChange.metadata),
                }
              : null,
          revokedAt: entitlement.revokedAt ?? null,
          role: entitlement.role,
          source: entitlement.source,
          status: entitlement.revokedAt === undefined ? ("active" as const) : ("revoked" as const),
          updatedAt: entitlement.updatedAt,
        };
      })
    );
    return { ...result, page };
  },
  returns: paginationResultValidator(confirmedTripAccessValidator),
});

export const getConfirmedTripAccessContext = query({
  args: { queryId: v.id("queries") },
  handler: async (ctx, args) => {
    const { offer, queryRow } = await requireManagedConfirmedQuery(ctx, args.queryId);
    return {
      destination: offer.destination ?? queryRow.destination ?? "Destination details to follow",
      queryCode: queryRow.queryCode,
      travelEndDate: offer.travelEndDate ?? null,
      travelStartDate: offer.travelStartDate,
    };
  },
  returns: confirmedTripAccessContextValidator,
});

export const grantConfirmedTripEntitlement = mutation({
  args: {
    accountHolderProfileId: v.id("userProfiles"),
    commandId: v.string(),
    queryId: v.id("queries"),
    role: v.union(v.literal("organizer"), v.literal("traveller")),
  },
  handler: async (ctx: MutationCtx, args) => {
    const { access, confirmedOfferId, queryRow, staffId } = await requireManagedConfirmedQuery(
      ctx,
      args.queryId
    );
    if (args.role === "traveller") {
      throw new ConvexError("TRAVELLER_BINDING_REQUIRED");
    }
    const receipt = await resolveCommandReceipt(ctx, {
      access,
      commandId: args.commandId,
      operation: GRANT_ACCESS_OPERATION,
      payload: {
        accountHolderProfileId: String(args.accountHolderProfileId),
        queryId: String(args.queryId),
        role: args.role,
      },
      targetId: String(args.queryId),
    });
    if (receipt.replayedResultId) {
      // SAFETY: this operation stores only Customer Journey Entitlement IDs in its command receipts.
      const replayed = await ctx.db.get(
        "customerJourneyEntitlements",
        receipt.replayedResultId as Id<"customerJourneyEntitlements">
      );
      if (
        !(
          replayed &&
          isManagedConfirmedTripEntitlement(replayed) &&
          replayed.queryId === args.queryId &&
          replayed.accountHolderProfileId === args.accountHolderProfileId &&
          replayed.role === args.role
        )
      ) {
        throw new ConvexError("Stored Customer Journey access command is invalid");
      }
      return { entitlementId: replayed._id };
    }
    const accountHolder = await ctx.db.get("userProfiles", args.accountHolderProfileId);
    if (!(accountHolder && !accountHolder.archivedAt && accountHolder.authUserId?.includes("|"))) {
      throw new ConvexError("Account Holder not found");
    }
    const entitlementId = await upsertConfirmedJourneyEntitlement(ctx, {
      accountHolderProfileId: accountHolder._id,
      authUserId: accountHolder.authUserId,
      confirmedOfferId,
      grantedByStaffId: staffId,
      queryId: queryRow._id,
      role: args.role,
    });
    await createActivity(ctx, access, {
      action: "customer_journey_access_granted",
      entityId: String(entitlementId),
      entityType: "customerJourneyEntitlement",
      message: "Customer Journey access granted",
      metadata: { queryId: String(queryRow._id), role: args.role },
    });
    await storeCommandReceipt(ctx, {
      actorKey: receipt.actorKey,
      commandId: args.commandId,
      operation: GRANT_ACCESS_OPERATION,
      payloadDigest: receipt.payloadDigest,
      resultId: String(entitlementId),
      targetId: String(args.queryId),
    });
    return { entitlementId };
  },
  returns: v.object({ entitlementId: v.id("customerJourneyEntitlements") }),
});

export const revokeConfirmedTripEntitlement = mutation({
  args: {
    commandId: v.string(),
    entitlementId: v.id("customerJourneyEntitlements"),
    queryId: v.id("queries"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const reason = requiredAccessReason(args.reason);
    const { access, entitlement, queryRow } = await requireManagedEntitlement(
      ctx,
      args.queryId,
      args.entitlementId
    );
    const receipt = await resolveCommandReceipt(ctx, {
      access,
      commandId: args.commandId,
      operation: REVOKE_ACCESS_OPERATION,
      payload: {
        entitlementId: String(args.entitlementId),
        queryId: String(args.queryId),
        reason,
      },
      targetId: String(args.entitlementId),
    });
    if (receipt.replayedResultId) {
      if (receipt.replayedResultId !== String(entitlement._id)) {
        throw new ConvexError("Stored Customer Journey access command is invalid");
      }
      return { changed: false, entitlementId: entitlement._id, status: "revoked" as const };
    }
    const siblings = await managedEntitlementSiblings(ctx, entitlement);
    const activeSiblings = siblings.filter((row) => row.revokedAt === undefined);
    const timestamp = Date.now();
    await Promise.all(
      activeSiblings.flatMap((row) => [
        ctx.db.patch("customerJourneyEntitlements", row._id, {
          revokedAt: timestamp,
          updatedAt: timestamp,
        }),
        createActivity(ctx, access, {
          action: "customer_journey_access_revoked",
          entityId: String(row._id),
          entityType: "customerJourneyEntitlement",
          message: "Customer Journey access revoked",
          metadata: { queryId: String(queryRow._id), reason },
        }),
      ])
    );
    await Promise.all(
      activeSiblings.map((row) =>
        suppressQueuedJourneyRemindersForEntitlement(ctx, row._id, "entitlement_revoked")
      )
    );
    await storeCommandReceipt(ctx, {
      actorKey: receipt.actorKey,
      commandId: args.commandId,
      operation: REVOKE_ACCESS_OPERATION,
      payloadDigest: receipt.payloadDigest,
      resultId: String(entitlement._id),
      targetId: String(entitlement._id),
    });
    return {
      changed: activeSiblings.length > 0,
      entitlementId: entitlement._id,
      status: "revoked" as const,
    };
  },
  returns: accessMutationResultValidator,
});

export const restoreConfirmedTripEntitlement = mutation({
  args: {
    commandId: v.string(),
    entitlementId: v.id("customerJourneyEntitlements"),
    queryId: v.id("queries"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const reason = requiredAccessReason(args.reason);
    const { access, entitlement, queryRow } = await requireManagedEntitlement(
      ctx,
      args.queryId,
      args.entitlementId
    );
    const receipt = await resolveCommandReceipt(ctx, {
      access,
      commandId: args.commandId,
      operation: RESTORE_ACCESS_OPERATION,
      payload: {
        entitlementId: String(args.entitlementId),
        queryId: String(args.queryId),
        reason,
      },
      targetId: String(args.entitlementId),
    });
    if (receipt.replayedResultId) {
      if (receipt.replayedResultId !== String(entitlement._id)) {
        throw new ConvexError("Stored Customer Journey access command is invalid");
      }
      return { changed: false, entitlementId: entitlement._id, status: "active" as const };
    }
    const siblings = await managedEntitlementSiblings(ctx, entitlement);
    if (siblings.length !== 1) {
      throw new ConvexError("JOURNEY_ENTITLEMENT_CONFLICT");
    }
    if (entitlement.role === "traveller") {
      throw new ConvexError("TRAVELLER_BINDING_REQUIRED");
    }
    if (entitlement.revokedAt === undefined) {
      await storeCommandReceipt(ctx, {
        actorKey: receipt.actorKey,
        commandId: args.commandId,
        operation: RESTORE_ACCESS_OPERATION,
        payloadDigest: receipt.payloadDigest,
        resultId: String(entitlement._id),
        targetId: String(entitlement._id),
      });
      return { changed: false, entitlementId: entitlement._id, status: "active" as const };
    }
    const accountHolder = entitlement.accountHolderProfileId
      ? await ctx.db.get("userProfiles", entitlement.accountHolderProfileId)
      : null;
    if (
      !(
        accountHolder &&
        !accountHolder.archivedAt &&
        accountHolder.authUserId === entitlement.authUserId &&
        accountHolder.authUserId.includes("|")
      )
    ) {
      throw new ConvexError("Account Holder not found");
    }
    const timestamp = Date.now();
    await ctx.db.patch("customerJourneyEntitlements", entitlement._id, {
      revokedAt: undefined,
      updatedAt: timestamp,
    });
    await createActivity(ctx, access, {
      action: "customer_journey_access_restored",
      entityId: String(entitlement._id),
      entityType: "customerJourneyEntitlement",
      message: "Customer Journey access restored",
      metadata: { queryId: String(queryRow._id), reason },
    });
    await storeCommandReceipt(ctx, {
      actorKey: receipt.actorKey,
      commandId: args.commandId,
      operation: RESTORE_ACCESS_OPERATION,
      payloadDigest: receipt.payloadDigest,
      resultId: String(entitlement._id),
      targetId: String(entitlement._id),
    });
    return { changed: true, entitlementId: entitlement._id, status: "active" as const };
  },
  returns: accessMutationResultValidator,
});
