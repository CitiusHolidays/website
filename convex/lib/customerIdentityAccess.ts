import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { type AuthIdentityLike, canonicalAuthUserId, legacyAuthUserId } from "./authIdentity";

type IdentityCtx = QueryCtx | MutationCtx;

export interface CustomerJourneyEntitlementProjection {
  role: "purchaser" | "organizer" | "traveller";
  source:
    | "public_booking_owner"
    | "crm_operator_grant"
    | "identity_migration"
    | "legacy_booking_owner";
}

export async function privacySafeIdentityHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function publicAccountId(identity: AuthIdentityLike, profileId?: string | null) {
  if (profileId) {
    return String(profileId);
  }
  const authUserId = canonicalAuthUserId(identity);
  if (!authUserId) {
    throw new ConvexError("UNAUTHORIZED");
  }
  const digest = await privacySafeIdentityHash(authUserId);
  return `account_${digest.slice(0, 32)}`;
}

export async function isIdentityQuarantined(
  ctx: IdentityCtx,
  args: { legacyAuthUserId: string; table: string }
) {
  const legacyAuthUserIdHash = await privacySafeIdentityHash(args.legacyAuthUserId);
  const existing = await ctx.db
    .query("authIdentityQuarantines")
    .withIndex("by_hash_table", (q) =>
      q.eq("legacyAuthUserIdHash", legacyAuthUserIdHash).eq("table", args.table)
    )
    .first();
  return Boolean(existing && existing.resolvedAt === undefined);
}

export async function recordIdentityQuarantine(
  ctx: MutationCtx,
  args: {
    legacyAuthUserId: string;
    reason: "conflicting_canonical_link" | "ambiguous_owner";
    table: string;
  }
) {
  const legacyAuthUserIdHash = await privacySafeIdentityHash(args.legacyAuthUserId);
  const existing = await ctx.db
    .query("authIdentityQuarantines")
    .withIndex("by_hash_table", (q) =>
      q.eq("legacyAuthUserIdHash", legacyAuthUserIdHash).eq("table", args.table)
    )
    .first();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("authIdentityQuarantines", {
    createdAt: Date.now(),
    legacyAuthUserIdHash,
    reason: args.reason,
    table: args.table,
  });
}

export async function establishCanonicalIdentityLink(ctx: MutationCtx, identity: UserIdentity) {
  const canonical = canonicalAuthUserId(identity);
  const legacy = legacyAuthUserId(identity);
  if (!canonical) {
    throw new ConvexError("UNAUTHORIZED");
  }
  if (!(legacy && legacy !== canonical)) {
    return { authUserId: canonical, status: "linked" as const };
  }
  const existing = await ctx.db
    .query("authIdentityLinks")
    .withIndex("by_legacyAuthUserId", (q) => q.eq("legacyAuthUserId", legacy))
    .take(3);
  const conflict = existing.find((row) => row.canonicalAuthUserId !== canonical);
  if (conflict) {
    await Promise.all(
      existing.map((row) =>
        ctx.db.patch("authIdentityLinks", row._id, { status: "quarantined", updatedAt: Date.now() })
      )
    );
    await recordIdentityQuarantine(ctx, {
      legacyAuthUserId: legacy,
      reason: "conflicting_canonical_link",
      table: "authIdentityLinks",
    });
    return { authUserId: null, status: "conflict" as const };
  }
  const linked = existing.find((row) => row.canonicalAuthUserId === canonical);
  if (linked) {
    if (linked.status !== "linked") {
      return { authUserId: null, status: "conflict" as const };
    }
    return { authUserId: canonical, status: "linked" as const };
  }
  const timestamp = Date.now();
  await ctx.db.insert("authIdentityLinks", {
    canonicalAuthUserId: canonical,
    createdAt: timestamp,
    legacyAuthUserId: legacy,
    status: "linked",
    updatedAt: timestamp,
  });
  return { authUserId: canonical, status: "linked" as const };
}

export async function ensureCanonicalIdentityLink(ctx: MutationCtx, identity: UserIdentity) {
  const result = await establishCanonicalIdentityLink(ctx, identity);
  if (result.status === "conflict" || !result.authUserId) {
    throw new ConvexError("AUTH_IDENTITY_CONFLICT");
  }
  return result.authUserId;
}

export async function authorizedCustomerIdentityIds(ctx: IdentityCtx, identity: AuthIdentityLike) {
  const canonical = canonicalAuthUserId(identity);
  const legacy = legacyAuthUserId(identity);
  if (!canonical) {
    return [];
  }
  if (!(identity.tokenIdentifier && legacy && legacy !== canonical)) {
    return [canonical];
  }
  const links = await ctx.db
    .query("authIdentityLinks")
    .withIndex("by_legacyAuthUserId", (q) => q.eq("legacyAuthUserId", legacy))
    .take(3);
  const matching = links.filter(
    (row) => row.status === "linked" && row.canonicalAuthUserId === canonical
  );
  const conflicting = links.some(
    (row) => row.status !== "linked" || row.canonicalAuthUserId !== canonical
  );
  return matching.length === 1 && !conflicting ? [canonical, legacy] : [canonical];
}

function activeEntitlement(row: Doc<"customerJourneyEntitlements">) {
  return row.revokedAt === undefined;
}

export function projectJourneyEntitlement(
  row: Doc<"customerJourneyEntitlements">
): CustomerJourneyEntitlementProjection {
  return { role: row.role, source: row.source };
}

export async function findBookingEntitlement(
  ctx: QueryCtx,
  identityIds: string[],
  booking: Doc<"bookings">
): Promise<CustomerJourneyEntitlementProjection | null> {
  const pages = await Promise.all(
    identityIds.map((authUserId) =>
      ctx.db
        .query("customerJourneyEntitlements")
        .withIndex("by_bookingId_authUserId", (q) =>
          q.eq("bookingId", booking._id).eq("authUserId", authUserId)
        )
        .take(2)
    )
  );
  const explicitEntitlements = [
    ...new Map(pages.flat().map((row) => [String(row._id), row] as const)).values(),
  ];
  // Explicit rows are authoritative, and a non-unique entitlement key is an
  // authorization conflict rather than a reason to select the active sibling.
  if (explicitEntitlements.length !== 1) {
    return explicitEntitlements.length === 0 && identityIds.includes(booking.userId)
      ? { role: "purchaser", source: "legacy_booking_owner" }
      : null;
  }
  const [entitlement] = explicitEntitlements;
  if (!(activeEntitlement(entitlement) && entitlement.capabilities.includes("view_booking"))) {
    return null;
  }
  return projectJourneyEntitlement(entitlement);
}

export async function upsertBookingEntitlement(
  ctx: MutationCtx,
  args: {
    authUserId: string;
    bookingId: Id<"bookings">;
    legacyAuthUserId?: string;
    legacyAuthUserIds?: readonly string[];
    source: "public_booking_owner" | "identity_migration";
  }
) {
  const legacyAuthUserIds = [
    ...new Set(
      [args.legacyAuthUserId, ...(args.legacyAuthUserIds ?? [])].filter((value): value is string =>
        Boolean(value && value !== args.authUserId)
      )
    ),
  ].slice(0, 3);
  const [canonicalRows, ...legacyPages] = await Promise.all([
    ctx.db
      .query("customerJourneyEntitlements")
      .withIndex("by_bookingId_authUserId", (q) =>
        q.eq("bookingId", args.bookingId).eq("authUserId", args.authUserId)
      )
      .take(2),
    ...legacyAuthUserIds.map((legacyIdentity) =>
      ctx.db
        .query("customerJourneyEntitlements")
        .withIndex("by_bookingId_authUserId", (q) =>
          q.eq("bookingId", args.bookingId).eq("authUserId", legacyIdentity)
        )
        .take(2)
    ),
  ]);
  const legacyRows = legacyPages.flat();
  const rows = [
    ...new Map(
      [...canonicalRows, ...legacyRows].map((row) => [String(row._id), row] as const)
    ).values(),
  ];
  const timestamp = Date.now();
  const revoked = rows.find((row) => row.revokedAt !== undefined);
  if (revoked) {
    const [canonical] = canonicalRows;
    if (canonical && canonical.revokedAt === undefined) {
      await ctx.db.patch("customerJourneyEntitlements", canonical._id, {
        revokedAt: revoked.revokedAt,
        updatedAt: timestamp,
      });
      return canonical._id;
    }
    if (!canonical) {
      await ctx.db.patch("customerJourneyEntitlements", revoked._id, {
        authUserId: args.authUserId,
        updatedAt: timestamp,
      });
    }
    return canonical?._id ?? revoked._id;
  }
  if (rows.length > 1) {
    throw new ConvexError("BOOKING_ENTITLEMENT_CONFLICT");
  }
  const [existing] = rows;
  if (existing) {
    await ctx.db.patch("customerJourneyEntitlements", existing._id, {
      authUserId: args.authUserId,
      capabilities: ["view_booking"],
      role: "purchaser",
      source: args.source,
      updatedAt: timestamp,
    });
    return existing._id;
  }
  return await ctx.db.insert("customerJourneyEntitlements", {
    authUserId: args.authUserId,
    bookingId: args.bookingId,
    capabilities: ["view_booking"],
    createdAt: timestamp,
    role: "purchaser",
    source: args.source,
    updatedAt: timestamp,
  });
}

export async function upsertConfirmedJourneyEntitlement(
  ctx: MutationCtx,
  args: {
    accountHolderProfileId: Id<"userProfiles">;
    authUserId: string;
    confirmedOfferId: Id<"confirmedOffers">;
    grantedByStaffId: Id<"staffUsers">;
    queryId: Id<"queries">;
    role: "organizer" | "traveller";
  }
) {
  const existingRows = await ctx.db
    .query("customerJourneyEntitlements")
    .withIndex("by_confirmedOfferId_authUserId", (q) =>
      q.eq("confirmedOfferId", args.confirmedOfferId).eq("authUserId", args.authUserId)
    )
    .take(2);
  const timestamp = Date.now();
  if (existingRows.length > 1) {
    throw new ConvexError("JOURNEY_ENTITLEMENT_CONFLICT");
  }
  const [existing] = existingRows;
  if (existing) {
    if (existing.revokedAt !== undefined) {
      throw new ConvexError("JOURNEY_ENTITLEMENT_RESTORE_REQUIRED");
    }
    if (
      existing.accountHolderProfileId !== args.accountHolderProfileId ||
      existing.queryId !== args.queryId ||
      existing.role !== args.role ||
      !existing.capabilities.includes("view_confirmed_trip")
    ) {
      throw new ConvexError("JOURNEY_ENTITLEMENT_CONFLICT");
    }
    return existing._id;
  }
  return await ctx.db.insert("customerJourneyEntitlements", {
    accountHolderProfileId: args.accountHolderProfileId,
    authUserId: args.authUserId,
    capabilities: ["view_confirmed_trip"],
    confirmedOfferId: args.confirmedOfferId,
    createdAt: timestamp,
    grantedByStaffId: args.grantedByStaffId,
    queryId: args.queryId,
    role: args.role,
    source: "crm_operator_grant",
    updatedAt: timestamp,
  });
}
