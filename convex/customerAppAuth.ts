import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { normalizeEmail } from "./crm/lib/staffAccess";
import { getBootstrapAdminEmails } from "./lib/bootstrapAuthority";
import {
  SIGN_IN_DEVICE_SECRET_PATTERN,
  SIGN_IN_LINK_ROW_TTL_MS,
  SIGN_IN_LINK_WINDOW_MS,
  SIGN_IN_LINKS_PER_HOUR,
  sha256Hex,
} from "./lib/customerAppSignIn";

/**
 * Staff sign in with their password (Citius Connect, the portal), never with the customer app's
 * email link, so a staff mailbox alone cannot open a staff session without the password. The
 * bootstrap Admin mailboxes (`PORTAL_BOOTSTRAP_ADMINS`) count as staff too.
 */
export const isStaffEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      return false;
    }
    // A configured break-glass Admin mailbox is staff whether or not its window is open now.
    if (getBootstrapAdminEmails().includes(email)) {
      return true;
    }
    const rows = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", email))
      .take(5);
    return rows.some((row) => row.active);
  },
  returns: v.boolean(),
});

/**
 * Records one sign-in link request, unless its address already had its hourly share. The caller
 * sends no email when this returns false; the form answers the same either way.
 */
export const recordSignInLink = internalMutation({
  args: { deviceDigest: v.string(), recipientDigest: v.string(), tokenDigest: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const recentQuery = ctx.db
      .query("customerAppSignInLinks")
      .withIndex("by_recipientDigest_and_requestedAt", (q) =>
        q
          .eq("recipientDigest", args.recipientDigest)
          .gt("requestedAt", now - SIGN_IN_LINK_WINDOW_MS)
      )
      .take(SIGN_IN_LINKS_PER_HOUR);
    const staleQuery = ctx.db
      .query("customerAppSignInLinks")
      .withIndex("by_recipientDigest_and_requestedAt", (q) =>
        q
          .eq("recipientDigest", args.recipientDigest)
          .lt("requestedAt", now - SIGN_IN_LINK_ROW_TTL_MS)
      )
      .take(50);
    const [recent, stale] = await Promise.all([recentQuery, staleQuery]);
    await Promise.all(stale.map((row) => ctx.db.delete("customerAppSignInLinks", row._id)));
    if (recent.length >= SIGN_IN_LINKS_PER_HOUR) {
      return false;
    }
    await ctx.db.insert("customerAppSignInLinks", { ...args, requestedAt: now });
    return true;
  },
  returns: v.boolean(),
});

/**
 * Whether the device presenting a sign-in link is the one that asked for it. A match is used up,
 * so a second open of the same link fails here too.
 */
export const consumeSignInDevice = internalMutation({
  args: { deviceSecret: v.string(), tokenDigest: v.string() },
  handler: async (ctx, args) => {
    if (!SIGN_IN_DEVICE_SECRET_PATTERN.test(args.deviceSecret)) {
      return false;
    }
    const row = await ctx.db
      .query("customerAppSignInLinks")
      .withIndex("by_tokenDigest", (q) => q.eq("tokenDigest", args.tokenDigest))
      .first();
    if (!row || Date.now() - row.requestedAt > SIGN_IN_LINK_ROW_TTL_MS) {
      return false;
    }
    if ((await sha256Hex(args.deviceSecret)) !== row.deviceDigest) {
      return false;
    }
    await ctx.db.delete("customerAppSignInLinks", row._id);
    return true;
  },
  returns: v.boolean(),
});
