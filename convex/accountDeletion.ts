import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { normalizeEmail } from "./crm/lib/staffAccess";
import {
  ACCOUNT_DELETION_ERRORS,
  ACCOUNT_DELETION_REAUTH_WINDOW_MS,
  isAccountDeletionConfirmed,
} from "./lib/accountDeletionContract";
import {
  accountDeletionReference,
  accountDeletionSubjectHash,
  deletedAccountTombstone,
  findAccountDeletionReceipt,
} from "./lib/accountDeletionReceipts";
import { eraseCustomerAccount } from "./lib/accountErasure";
import { authIdentityCandidates, canonicalAuthUserId } from "./lib/authIdentity";
import {
  authorizedCustomerIdentityIds,
  ensureCanonicalIdentityLink,
} from "./lib/customerIdentityAccess";
import { isRuntimeObject, isRuntimeString } from "./lib/runtimeValues";

type Ctx = QueryCtx | MutationCtx;

interface BetterAuthLoginRow {
  email?: string;
}

interface BetterAuthSessionRow {
  createdAt: number;
  expiresAt: number;
  userId: string;
}

async function findLoginUser(ctx: Ctx, betterAuthUserId: string) {
  const row = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: betterAuthUserId }],
  });
  // SAFETY: the adapter returns a Better Auth user row or null; only `email` is read.
  return row && isRuntimeObject(row) ? (row as BetterAuthLoginRow) : null;
}

async function findTokenSession(ctx: Ctx, identity: UserIdentity) {
  const { sessionId } = identity;
  if (!isRuntimeString(sessionId) || sessionId.length === 0) {
    return null;
  }
  const row = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "session",
    where: [{ field: "_id", value: sessionId }],
  });
  // SAFETY: the adapter returns a Better Auth session row or null; the fields read are required.
  const session = row && isRuntimeObject(row) ? (row as BetterAuthSessionRow) : null;
  return session && session.userId === identity.subject ? session : null;
}

/** The session behind this token, when it was signed in recently enough to delete the account. */
async function freshSession(ctx: Ctx, identity: UserIdentity, now: number) {
  const session = await findTokenSession(ctx, identity);
  if (!session || session.expiresAt <= now) {
    return null;
  }
  const reauthenticateBy = session.createdAt + ACCOUNT_DELETION_REAUTH_WINDOW_MS;
  return reauthenticateBy > now ? { reauthenticateBy } : null;
}

function loginEmails(identity: UserIdentity, login: BetterAuthLoginRow | null) {
  return Array.from(
    new Set([login?.email, identity.email].filter(isRuntimeString).map(normalizeEmail))
  ).filter(Boolean);
}

/**
 * Staff logins share Better Auth with customers but belong to HR. Refuse when the identity is
 * linked to a staff record or the login email is a staff email, active or not.
 */
async function isStaffLogin(ctx: Ctx, identity: UserIdentity, emails: string[]) {
  const byIdentity = await Promise.all(
    authIdentityCandidates(identity).map((authUserId) =>
      ctx.db
        .query("staffUsers")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
        .first()
    )
  );
  if (byIdentity.some(Boolean)) {
    return true;
  }
  const byEmail = await Promise.all(
    emails.map((emailNormalized) =>
      ctx.db
        .query("staffUsers")
        .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
        .first()
    )
  );
  return byEmail.some(Boolean);
}

const deletionResultValidator = v.object({
  deletedAt: v.number(),
  reference: v.string(),
  status: v.literal("deleted"),
});

/**
 * Advisory status for the deletion screen. `referenceNow` is the caller's clock (queries must not
 * read it); only `deleteMyAccount` enforces the recent sign-in.
 */
export const getMyAccountDeletionEligibility = query({
  args: { referenceNow: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const canonical = identity ? canonicalAuthUserId(identity) : null;
    if (!(identity && canonical)) {
      return null;
    }
    const login = await findLoginUser(ctx, identity.subject);
    if (await isStaffLogin(ctx, identity, loginEmails(identity, login))) {
      return { status: "staff_account" as const };
    }
    const fresh = await freshSession(ctx, identity, args.referenceNow);
    return fresh
      ? { reauthenticateBy: fresh.reauthenticateBy, status: "ready" as const }
      : { status: "reauthentication_required" as const };
  },
  returns: v.union(
    v.null(),
    v.object({ status: v.literal("staff_account") }),
    v.object({ status: v.literal("reauthentication_required") }),
    v.object({ reauthenticateBy: v.number(), status: v.literal("ready") })
  ),
});

/**
 * Deletes the caller's Customer Travel Account in one transaction (ADR 0019). Callable by the web
 * Account settings and, unchanged, by the customer app with its Convex auth token.
 */
export const deleteMyAccount = mutation({
  args: { confirmation: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const canonical = identity ? canonicalAuthUserId(identity) : null;
    if (!(identity && canonical)) {
      throw new ConvexError(ACCOUNT_DELETION_ERRORS.unauthorized);
    }
    const existing = await findAccountDeletionReceipt(ctx, canonical);
    if (existing) {
      return {
        deletedAt: existing.deletedAt,
        reference: accountDeletionReference(existing.subjectHash),
        status: "deleted" as const,
      };
    }

    const now = Date.now();
    const login = await findLoginUser(ctx, identity.subject);
    const emails = loginEmails(identity, login);
    if (await isStaffLogin(ctx, identity, emails)) {
      throw new ConvexError(ACCOUNT_DELETION_ERRORS.staffAccount);
    }
    if (!isAccountDeletionConfirmed(args.confirmation)) {
      throw new ConvexError(ACCOUNT_DELETION_ERRORS.confirmationRequired);
    }
    if (!(await freshSession(ctx, identity, now))) {
      throw new ConvexError(ACCOUNT_DELETION_ERRORS.reauthenticationRequired);
    }

    // A conflicting legacy link means another person may own legacy rows; support resolves it.
    await ensureCanonicalIdentityLink(ctx, identity);
    const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
    const subjectHash = await accountDeletionSubjectHash(canonical);
    const erased = await eraseCustomerAccount(ctx, {
      betterAuthUserId: identity.subject,
      canonicalAuthUserId: canonical,
      identityIds,
      loginEmails: emails,
      now,
      tombstone: deletedAccountTombstone(subjectHash),
    });
    const receiptId = await ctx.db.insert("accountDeletionReceipts", {
      confirmationEmail: "queued",
      deletedAt: now,
      erased,
      subjectHash,
    });
    const [recipient] = emails;
    if (recipient) {
      await ctx.scheduler.runAfter(0, internal.accountDeletionEmail.sendConfirmation, {
        receiptId,
        recipient,
      });
    } else {
      await ctx.db.patch("accountDeletionReceipts", receiptId, { confirmationEmail: "skipped" });
    }
    return {
      deletedAt: now,
      reference: accountDeletionReference(subjectHash),
      status: "deleted" as const,
    };
  },
  returns: deletionResultValidator,
});

export const recordConfirmationEmail = internalMutation({
  args: {
    receiptId: v.id("accountDeletionReceipts"),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get("accountDeletionReceipts", args.receiptId);
    if (receipt && receipt.confirmationEmail !== "sent") {
      await ctx.db.patch("accountDeletionReceipts", args.receiptId, {
        confirmationEmail: args.status,
      });
    }
    return null;
  },
  returns: v.null(),
});
