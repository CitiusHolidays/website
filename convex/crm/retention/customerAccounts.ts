import { makeFunctionReference } from "convex/server";
import { components } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { internalMutation, internalQuery } from "../../_generated/server";
import {
  type RetentionDecision,
  type RetentionPlan,
  reportRetentionPage,
  retentionContinuationArgs,
  retentionReportArgs,
  retentionReportResult,
  retentionRunResult,
  runRetentionPage,
} from "../lib/retentionRun";
import { RETENTION_PERIODS, type RetentionCutoff, retentionCutoff } from "../lib/retentionSchedule";
import { normalizeEmail } from "../lib/staffAccess";

/**
 * Customer accounts (director decision, 7 Nov 2026) are kept until the customer deletes them, or
 * three years with no activity. Activity is the latest of: the profile's `updatedAt` (every
 * sign-in schedules `authSync.syncFromIdentity`, which rewrites it), the Better Auth user's
 * `createdAt`/`updatedAt`, any session's `updatedAt`, and any booking or journey entitlement
 * of the account. Every identity id of the account counts: the profile's id and its linked
 * canonical or legacy id from `authIdentityLinks`.
 *
 * Never touched: staff accounts (a `staffUsers` row for any of the ids or the email), accounts
 * with any Sacred Bharat profile, visit or wishlist row (the Yatri context has no retention
 * period yet), archived
 * duplicate profiles, and accounts with more bookings or entitlements than one pass reviews. Deleting an account removes the Better Auth user, its sessions and sign-in
 * methods, the profile, the identity links and journey entitlements. Bookings stay for the
 * 8-year tax rule with their account link replaced by a placeholder. Run by
 * `jobs.purge_inactive_customer_accounts`, which is off until the owner switches it on.
 */
export const DELETED_ACCOUNT_USER_ID = "retention:deleted-account";
const PAGE_SIZE = 20;
const LINK_LIMIT = 50;

const continuePurgeRef = makeFunctionReference<"mutation", { asOf: number; cursor: string }>(
  "crm/retention/customerAccounts:continuePurge"
);

/** A canonical id is `issuer|subject`; the Better Auth user id is the subject. */
function betterAuthUserId(authUserId: string) {
  return authUserId.includes("|") ? authUserId.slice(authUserId.lastIndexOf("|") + 1) : authUserId;
}

async function identityIds(ctx: QueryCtx, authUserId: string) {
  const [asCanonical, asLegacy] = await Promise.all([
    ctx.db
      .query("authIdentityLinks")
      .withIndex("by_canonicalAuthUserId", (q) => q.eq("canonicalAuthUserId", authUserId))
      .take(LINK_LIMIT),
    ctx.db
      .query("authIdentityLinks")
      .withIndex("by_legacyAuthUserId", (q) => q.eq("legacyAuthUserId", authUserId))
      .take(LINK_LIMIT),
  ]);
  const ids = new Set([authUserId, betterAuthUserId(authUserId)]);
  for (const link of [...asCanonical, ...asLegacy]) {
    ids.add(link.canonicalAuthUserId);
    ids.add(link.legacyAuthUserId);
  }
  return { ids: Array.from(ids), links: [...asCanonical, ...asLegacy] };
}

interface AuthTimestamps {
  createdAt?: number;
  updatedAt?: number;
}

function latest(rows: AuthTimestamps[]) {
  return rows.reduce(
    (max, row) => Math.max(max, row.createdAt ?? 0, row.updatedAt ?? 0),
    Number.NEGATIVE_INFINITY
  );
}

async function betterAuthActivity(ctx: QueryCtx, subjects: string[]) {
  const results = await Promise.all(
    subjects.map(async (subject) => {
      const [user, sessions] = await Promise.all([
        ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "user",
          where: [{ field: "_id", value: subject }],
        }),
        ctx.runQuery(components.betterAuth.adapter.findMany, {
          model: "session",
          paginationOpts: { cursor: null, numItems: LINK_LIMIT },
          where: [{ field: "userId", value: subject }],
        }),
      ]);
      // SAFETY: Better Auth rows carry numeric createdAt/updatedAt per the component schema.
      const rows = [user, ...sessions.page].filter(Boolean) as AuthTimestamps[];
      return { latest: latest(rows), sessions: sessions.page.length };
    })
  );
  return {
    latest: Math.max(Number.NEGATIVE_INFINITY, ...results.map((result) => result.latest)),
    tooManySessions: results.some((result) => result.sessions >= LINK_LIMIT),
  };
}

/** Every identity id of the profile, the identity links, and the Better Auth user ids. */
async function accountIdentity(ctx: QueryCtx, profile: Doc<"userProfiles">) {
  const linked = profile.authUserId
    ? await identityIds(ctx, profile.authUserId)
    : { ids: [], links: [] };
  // Bookings migrated from the old site may still carry the old user id.
  const ids = Array.from(
    new Set([...linked.ids, ...(profile.legacyUserId ? [profile.legacyUserId] : [])])
  );
  return {
    ids,
    links: linked.links,
    subjects: Array.from(new Set(linked.ids.map(betterAuthUserId))),
  };
}

async function accountLinks(ctx: QueryCtx, ids: string[]) {
  const [bookings, entitlements] = await Promise.all([
    Promise.all(
      ids.map((id) =>
        ctx.db
          .query("bookings")
          .withIndex("by_userId_createdAt", (q) => q.eq("userId", id))
          .order("desc")
          .take(LINK_LIMIT)
      )
    ),
    Promise.all(
      ids.map((id) =>
        ctx.db
          .query("customerJourneyEntitlements")
          .withIndex("by_authUserId_createdAt", (q) => q.eq("authUserId", id))
          .order("desc")
          .take(LINK_LIMIT)
      )
    ),
  ]);
  return { bookings: bookings.flat(), entitlements: entitlements.flat() };
}

async function isStaff(ctx: QueryCtx, profile: Doc<"userProfiles">, ids: string[]) {
  const email = profile.emailNormalized ?? normalizeEmail(profile.email);
  const matches = await Promise.all([
    ...ids.map((id) =>
      ctx.db
        .query("staffUsers")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", id))
        .first()
    ),
    email
      ? ctx.db
          .query("staffUsers")
          .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", email))
          .first()
      : Promise.resolve(null),
  ]);
  return matches.some((row) => row !== null);
}

/** Any Sacred Bharat profile, visit or wishlist row for the account. */
async function hasSacredBharatData(ctx: QueryCtx, ids: string[]) {
  const rows = await Promise.all(
    ids.flatMap((id) => [
      ctx.db
        .query("sacredBharatProfiles")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", id))
        .first(),
      ctx.db
        .query("sacredBharatVisits")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", id))
        .first(),
      ctx.db
        .query("sacredBharatWishlist")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", id))
        .first(),
    ])
  );
  return rows.some((row) => row !== null);
}

async function deleteBetterAuthUser(ctx: MutationCtx, subject: string) {
  await Promise.all(
    (["session", "account"] as const).map((model) =>
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model, where: [{ field: "userId", operator: "eq", value: subject }] },
        paginationOpts: { cursor: null, numItems: LINK_LIMIT },
      })
    )
  );
  await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
    input: { model: "user", where: [{ field: "_id", operator: "eq", value: subject }] },
  });
}

async function deleteAccount(ctx: MutationCtx, profile: Doc<"userProfiles">) {
  const { ids, links, subjects } = await accountIdentity(ctx, profile);
  const { bookings, entitlements } = await accountLinks(ctx, ids);
  const now = Date.now();
  await Promise.all([
    ...bookings.map((booking) =>
      ctx.db.patch("bookings", booking._id, { updatedAt: now, userId: DELETED_ACCOUNT_USER_ID })
    ),
    ...entitlements.map((entitlement) =>
      ctx.db.delete("customerJourneyEntitlements", entitlement._id)
    ),
  ]);
  if (bookings.length >= LINK_LIMIT || entitlements.length >= LINK_LIMIT) {
    // More links than one pass handles: the profile stays and the next run continues.
    return;
  }
  await Promise.all([
    ...Array.from(new Set(links.map((row) => row._id)), (id) =>
      ctx.db.delete("authIdentityLinks", id)
    ),
    ...subjects.map((subject) => deleteBetterAuthUser(ctx, subject)),
  ]);
  await ctx.db.delete("userProfiles", profile._id);
}

async function decide(
  ctx: QueryCtx,
  profile: Doc<"userProfiles">,
  cutoff: RetentionCutoff
): Promise<RetentionDecision> {
  if (profile.archivedAt !== undefined || profile.mergedIntoProfileId !== undefined) {
    return { outcome: "kept_archived_duplicate" };
  }
  if (Math.max(profile.createdAt, profile.updatedAt) >= cutoff.startMs) {
    return { outcome: "kept_active" };
  }
  const { ids, subjects } = await accountIdentity(ctx, profile);
  if (await isStaff(ctx, profile, ids)) {
    return { outcome: "kept_staff" };
  }
  const [auth, links] = await Promise.all([
    betterAuthActivity(ctx, subjects),
    accountLinks(ctx, ids),
  ]);
  if (
    auth.tooManySessions ||
    links.bookings.length >= LINK_LIMIT ||
    links.entitlements.length >= LINK_LIMIT
  ) {
    // Too many links to review in one pass; left for a person to look at.
    return { outcome: "kept_too_many_links" };
  }
  const linkActivity = latest([...links.bookings, ...links.entitlements]);
  if (Math.max(auth.latest, linkActivity) >= cutoff.startMs) {
    return { outcome: "kept_active" };
  }
  if (await hasSacredBharatData(ctx, ids)) {
    return { outcome: "kept_sacred_bharat" };
  }
  return {
    apply: async (writer) => await deleteAccount(writer, profile),
    outcome: "deleted_account",
  };
}

async function plan(ctx: QueryCtx, asOf: number, cursor: string | null): Promise<RetentionPlan> {
  const cutoff = retentionCutoff(asOf, RETENTION_PERIODS.inactiveCustomerAccounts);
  // A profile created inside the period has been active inside it.
  const page = await ctx.db
    .query("userProfiles")
    .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff.startMs))
    .paginate({ cursor, numItems: PAGE_SIZE });
  return {
    continueCursor: page.isDone ? null : page.continueCursor,
    decisions: await Promise.all(page.page.map((profile) => decide(ctx, profile, cutoff))),
  };
}

const JOB = {
  continueRef: continuePurgeRef,
  controlKey: "jobs.purge_inactive_customer_accounts",
  planner: plan,
} as const;

/** Entrypoint dispatched by the `jobs.purge_inactive_customer_accounts` scheduled job. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => await runRetentionPage(ctx, JOB, Date.now(), null),
  returns: retentionRunResult,
});

/** Continues one run in a fresh transaction with the run's fixed `asOf`. */
export const continuePurge = internalMutation({
  args: retentionContinuationArgs,
  handler: async (ctx, args) => await runRetentionPage(ctx, JOB, args.asOf, args.cursor),
  returns: retentionRunResult,
});

/** Dry run: what one page of the job would do at `asOf`, as content-free counts. */
export const dryRun = internalQuery({
  args: retentionReportArgs,
  handler: async (ctx, args) =>
    await reportRetentionPage(args.secret, () => plan(ctx, args.asOf, args.cursor)),
  returns: retentionReportResult,
});
