import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeEmail } from "../crm/lib/staffAccess";
import { ACCOUNT_DELETION_ERRORS } from "./accountDeletionContract";
import { withoutIdentityDocuments } from "./bookingTravellerDocuments";
import { readBoundedGroupMemberCount } from "./sacredBharatGroups";

/** Per-store bound for one deletion transaction. A customer account is far below it. */
const MAX_ROWS_PER_STORE = 1000;
const BETTER_AUTH_PAGE_SIZE = 100;

/**
 * One customer account to erase. Shared by self-service deletion (`accountDeletion`) and the
 * inactive-account retention job (`crm/retention/customerAccounts`) so the two cannot drift.
 */
export interface AccountErasureTarget {
  /** Better Auth user ids (token `subject`s) whose login, sessions and sign-ins go. */
  betterAuthUserIds: string[];
  /**
   * Journey Entitlements: self-service deletion revokes and detaches them, keeping the grant's
   * audit trail (ADR 0019); the retention job deletes them (docs/DATA_RETENTION.md).
   */
  entitlements: "delete" | "revoke";
  /** Every identity id that owns this Account Holder's rows: canonical, linked legacy, old-site. */
  identityIds: string[];
  /** Emails known for the login; used only to find archived duplicate profiles. */
  loginEmails: string[];
  now: number;
  /** The owner value written into records that are kept. */
  tombstone: string;
}

export type AccountErasureCounts = Doc<"accountDeletionReceipts">["erased"];

function bounded<T>(rows: T[]) {
  if (rows.length > MAX_ROWS_PER_STORE) {
    throw new ConvexError(ACCOUNT_DELETION_ERRORS.tooLarge);
  }
  return rows;
}

interface DeletedPage {
  continueCursor: string;
  count: number;
  isDone: boolean;
}

/** Runs a Better Auth `deleteMany` page by page until nothing matches. */
async function deleteAllPages(deletePage: (cursor: string | null) => Promise<DeletedPage>) {
  let deleted = 0;
  let cursor: string | null = null;
  for (;;) {
    // biome-ignore lint/performance/noAwaitInLoops: each page continues from the previous page's cursor.
    const page: DeletedPage = await deletePage(cursor);
    deleted += page.count;
    if (page.isDone) {
      return deleted;
    }
    cursor = page.continueCursor;
  }
}

/**
 * Verification tokens have no index on their user id, so walk only the live ones through the
 * `expiresAt` index; a full-table scan would grow with every abandoned reset link. An expired
 * token can no longer be used and names only the deleted user id.
 */
async function deleteLiveVerifications(ctx: MutationCtx, betterAuthUserId: string, now: number) {
  const ownedIds: string[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: {
      continueCursor: string;
      isDone: boolean;
      page: { _id: string; value?: string }[];
    } =
      // biome-ignore lint/performance/noAwaitInLoops: each page continues from the previous page's cursor.
      await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "verification",
        paginationOpts: { cursor, numItems: BETTER_AUTH_PAGE_SIZE },
        where: [{ field: "expiresAt", operator: "gt", value: now }],
      });
    ownedIds.push(
      ...page.page.filter((row) => row.value === betterAuthUserId).map((row) => row._id)
    );
    if (page.isDone) {
      break;
    }
    cursor = page.continueCursor;
  }
  await Promise.all(
    ownedIds.map((id) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: "verification", where: [{ field: "_id", operator: "eq", value: id }] },
      })
    )
  );
  return ownedIds.length;
}

async function eraseOneBetterAuthLogin(ctx: MutationCtx, betterAuthUserId: string, now: number) {
  const paginationOpts = (cursor: string | null) => ({ cursor, numItems: BETTER_AUTH_PAGE_SIZE });
  const authSessions = await deleteAllPages((cursor) =>
    ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "session",
        where: [{ field: "userId", operator: "eq", value: betterAuthUserId }],
      },
      paginationOpts: paginationOpts(cursor),
    })
  );
  const authAccounts = await deleteAllPages((cursor) =>
    ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "account",
        where: [{ field: "userId", operator: "eq", value: betterAuthUserId }],
      },
      paginationOpts: paginationOpts(cursor),
    })
  );
  const authVerifications = await deleteLiveVerifications(ctx, betterAuthUserId, now);
  const removedUser = await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
    input: { model: "user", where: [{ field: "_id", operator: "eq", value: betterAuthUserId }] },
  });
  return { authAccounts, authSessions, authUser: removedUser ? 1 : 0, authVerifications };
}

/**
 * Better Auth owns the login: the user, every session (so all devices sign out), every linked
 * provider account (password and Google) and live verification tokens.
 */
async function eraseBetterAuthLogins(ctx: MutationCtx, betterAuthUserIds: string[], now: number) {
  const totals = { authAccounts: 0, authSessions: 0, authUser: 0, authVerifications: 0 };
  for (const betterAuthUserId of new Set(betterAuthUserIds)) {
    // biome-ignore lint/performance/noAwaitInLoops: each login's component writes run in turn.
    const erased = await eraseOneBetterAuthLogin(ctx, betterAuthUserId, now);
    totals.authAccounts += erased.authAccounts;
    totals.authSessions += erased.authSessions;
    totals.authUser += erased.authUser;
    totals.authVerifications += erased.authVerifications;
  }
  return totals;
}

async function eraseProfiles(ctx: MutationCtx, target: AccountErasureTarget) {
  const owned = (
    await Promise.all(
      target.identityIds.map((authUserId) =>
        ctx.db
          .query("userProfiles")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
          .take(MAX_ROWS_PER_STORE + 1)
      )
    )
  ).flat();
  const ownedIds = new Set<Id<"userProfiles">>(owned.map((profile) => profile._id));
  // Archived duplicates keep the email but drop the live owner, so find them through the email
  // index and accept only rows provably tied to this login.
  const archived = (
    await Promise.all(
      Array.from(new Set(target.loginEmails.map(normalizeEmail).filter(Boolean))).map(
        (emailNormalized) =>
          ctx.db
            .query("userProfiles")
            .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
            .take(MAX_ROWS_PER_STORE + 1)
      )
    )
  )
    .flat()
    .filter(
      (profile) =>
        !ownedIds.has(profile._id) &&
        profile.archivedAt !== undefined &&
        ((profile.archivedAuthUserId !== undefined &&
          target.identityIds.includes(profile.archivedAuthUserId)) ||
          (profile.mergedIntoProfileId !== undefined && ownedIds.has(profile.mergedIntoProfileId)))
    );
  const profiles = bounded([...owned, ...archived]);
  await Promise.all(profiles.map((profile) => ctx.db.delete("userProfiles", profile._id)));
  return profiles.length;
}

async function eraseIdentityLinks(ctx: MutationCtx, target: AccountErasureTarget) {
  const pages = await Promise.all(
    target.identityIds.flatMap((authUserId) => [
      ctx.db
        .query("authIdentityLinks")
        .withIndex("by_canonicalAuthUserId", (q) => q.eq("canonicalAuthUserId", authUserId))
        .take(MAX_ROWS_PER_STORE + 1),
      ctx.db
        .query("authIdentityLinks")
        .withIndex("by_legacyAuthUserId", (q) => q.eq("legacyAuthUserId", authUserId))
        .take(MAX_ROWS_PER_STORE + 1),
    ])
  );
  const links = bounded([...new Map(pages.flat().map((row) => [String(row._id), row])).values()]);
  await Promise.all(links.map((row) => ctx.db.delete("authIdentityLinks", row._id)));
  return links.length;
}

type SacredBharatOwnedTable =
  | "sacredBharatInviteAttempts"
  | "sacredBharatLeaderboardSummaries"
  | "sacredBharatProfiles"
  | "sacredBharatVisits"
  | "sacredBharatWishlist";

const SACRED_BHARAT_OWNED_TABLES: SacredBharatOwnedTable[] = [
  "sacredBharatProfiles",
  "sacredBharatLeaderboardSummaries",
  "sacredBharatVisits",
  "sacredBharatWishlist",
  "sacredBharatInviteAttempts",
];

async function eraseSacredBharatOwnedRows(
  ctx: MutationCtx,
  table: SacredBharatOwnedTable,
  identityIds: string[]
) {
  const rows = bounded(
    (
      await Promise.all(
        identityIds.map((authUserId) =>
          ctx.db
            .query(table)
            .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
            .take(MAX_ROWS_PER_STORE + 1)
        )
      )
    ).flat()
  );
  await Promise.all(rows.map((row) => ctx.db.delete(table, row._id)));
  return rows.length;
}

/**
 * The Yatri profile, leaderboard entry, visits, wishlist and invite throttle are deleted. Group
 * memberships end; a group this person owned is archived, renamed and detached, because its other
 * members' memberships are theirs, not this account's.
 */
async function eraseSacredBharat(ctx: MutationCtx, target: AccountErasureTarget) {
  const ownedCounts = await Promise.all(
    SACRED_BHARAT_OWNED_TABLES.map((table) =>
      eraseSacredBharatOwnedRows(ctx, table, target.identityIds)
    )
  );
  const memberships = bounded(
    (
      await Promise.all(
        target.identityIds.map((authUserId) =>
          ctx.db
            .query("sacredBharatGroupMembers")
            .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
            .take(MAX_ROWS_PER_STORE + 1)
        )
      )
    ).flat()
  );
  await Promise.all(
    memberships.map((membership) => ctx.db.delete("sacredBharatGroupMembers", membership._id))
  );
  const ownedGroups = bounded(
    (
      await Promise.all(
        target.identityIds.map((authUserId) =>
          ctx.db
            .query("sacredBharatGroups")
            .withIndex("by_ownerAuthUserId", (q) => q.eq("ownerAuthUserId", authUserId))
            .take(MAX_ROWS_PER_STORE + 1)
        )
      )
    ).flat()
  );
  const ownedGroupIds = new Set(ownedGroups.map((group) => group._id));
  const joinedGroupIds = Array.from(
    new Set(memberships.map((membership) => membership.groupId))
  ).filter((groupId) => !ownedGroupIds.has(groupId));
  // Memberships are deleted above, so each recount sees the group without this person.
  await Promise.all([
    ...ownedGroups.map(async (group) =>
      ctx.db.patch("sacredBharatGroups", group._id, {
        isArchived: true,
        memberCount: await readBoundedGroupMemberCount(ctx, group._id),
        name: "Archived group",
        ownerAuthUserId: target.tombstone,
        updatedAt: target.now,
      })
    ),
    ...joinedGroupIds.map(async (groupId) => {
      if (await ctx.db.get("sacredBharatGroups", groupId)) {
        await ctx.db.patch("sacredBharatGroups", groupId, {
          memberCount: await readBoundedGroupMemberCount(ctx, groupId),
          updatedAt: target.now,
        });
      }
    }),
  ]);
  const erased =
    ownedCounts.reduce((total, count) => total + count, 0) +
    memberships.length +
    ownedGroups.length;
  return erased;
}

/**
 * Customer app trips (ADR 0020): the invite an Account Holder claimed stays as Operations' record,
 * detached from the login like the entitlement it hangs off. The parental consents they recorded
 * are deleted with the account (owner decision, 7 Nov 2026). The Traveller rows are the
 * operation's and are not touched.
 */
async function detachTripRecords(
  ctx: MutationCtx,
  target: AccountErasureTarget,
  entitlements: Doc<"customerJourneyEntitlements">[]
) {
  const holders = new Set(target.identityIds);
  const travellerIds = [
    ...new Set(entitlements.flatMap((row) => (row.travellerId ? [row.travellerId] : []))),
  ];
  const invites = bounded(
    (
      await Promise.all(
        travellerIds.map((travellerId) =>
          ctx.db
            .query("customerTripInvites")
            .withIndex("by_travellerId_and_createdAt", (q) => q.eq("travellerId", travellerId))
            .take(MAX_ROWS_PER_STORE + 1)
        )
      )
    )
      .flat()
      .filter(
        (row) => row.claimedByAuthUserId !== undefined && holders.has(row.claimedByAuthUserId)
      )
  );
  const consents = bounded(
    (
      await Promise.all(
        entitlements.map((row) =>
          ctx.db
            .query("customerParentalConsents")
            .withIndex("by_entitlementId", (q) => q.eq("entitlementId", row._id))
            .take(MAX_ROWS_PER_STORE + 1)
        )
      )
    ).flat()
  );
  await Promise.all([
    ...invites.map((row) =>
      ctx.db.patch("customerTripInvites", row._id, {
        claimedByAuthUserId: target.tombstone,
        updatedAt: target.now,
      })
    ),
    ...consents.map((row) => ctx.db.delete("customerParentalConsents", row._id)),
  ]);
}

/** Entitlements are revoked and detached (the row is the grant's audit trail), or deleted. */
async function endEntitlements(ctx: MutationCtx, target: AccountErasureTarget) {
  const rows = bounded(
    (
      await Promise.all(
        target.identityIds.map((authUserId) =>
          ctx.db
            .query("customerJourneyEntitlements")
            .withIndex("by_authUserId_createdAt", (q) => q.eq("authUserId", authUserId))
            .take(MAX_ROWS_PER_STORE + 1)
        )
      )
    ).flat()
  );
  await detachTripRecords(ctx, target, rows);
  await Promise.all(
    rows.map((row) =>
      target.entitlements === "delete"
        ? ctx.db.delete("customerJourneyEntitlements", row._id)
        : ctx.db.patch("customerJourneyEntitlements", row._id, {
            accountHolderProfileId: undefined,
            authUserId: target.tombstone,
            revokedAt: row.revokedAt ?? target.now,
            updatedAt: target.now,
          })
    )
  );
  return rows.length;
}

/**
 * Bookings and their payment events are kept for the tax retention period. The booking is
 * detached from the login, loses the purchaser's free-text note and loses identity documents from
 * its checkout traveller details (owner decision, 7 Nov 2026); amounts, payment ids, status,
 * dates, trip, traveller names and contacts are unchanged.
 */
async function detachBookings(ctx: MutationCtx, target: AccountErasureTarget) {
  const rows = bounded(
    (
      await Promise.all(
        target.identityIds.map((userId) =>
          ctx.db
            .query("bookings")
            .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
            .take(MAX_ROWS_PER_STORE + 1)
        )
      )
    ).flat()
  );
  let documentFields = 0;
  await Promise.all(
    rows.map((row) => {
      const details =
        row.travelerDetails === undefined ? null : withoutIdentityDocuments(row.travelerDetails);
      documentFields += details?.removed ?? 0;
      const patch: Partial<Doc<"bookings">> = {
        notes: undefined,
        updatedAt: target.now,
        userId: target.tombstone,
      };
      if (details) {
        patch.travelerDetails = details.value;
      }
      return ctx.db.patch("bookings", row._id, patch);
    })
  );
  return { bookingDocumentFields: documentFields, bookingsDetached: rows.length };
}

/**
 * Deletes or detaches everything the Account Holder's login owns, inside the caller's transaction.
 * Every step only touches rows still keyed to the identity, so running it again is a no-op.
 *
 * Not touched: Job Card Travellers and CRM records (the operation's), enquiries, invoices,
 * content-free email receipts, and staff records. Feedback photos: no website photo store records a
 * customer account as its author (ADR 0019), so the count is reported as zero.
 */
export async function eraseCustomerAccount(
  ctx: MutationCtx,
  target: AccountErasureTarget
): Promise<AccountErasureCounts> {
  const profiles = await eraseProfiles(ctx, target);
  const sacredBharatRows = await eraseSacredBharat(ctx, target);
  const entitlementsRevoked = await endEntitlements(ctx, target);
  const bookings = await detachBookings(ctx, target);
  const identityLinks = await eraseIdentityLinks(ctx, target);
  const login = await eraseBetterAuthLogins(ctx, target.betterAuthUserIds, target.now);
  return {
    ...login,
    ...bookings,
    entitlementsRevoked,
    feedbackPhotos: 0,
    identityLinks,
    profiles,
    sacredBharatRows,
  };
}
