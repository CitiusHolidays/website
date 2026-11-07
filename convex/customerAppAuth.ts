import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { normalizeEmail } from "./crm/lib/staffAccess";
import { getBootstrapAdminEmails } from "./lib/bootstrapAuthority";
import {
  SIGN_IN_DEVICE_SECRET_PATTERN,
  SIGN_IN_LINK_ROW_TTL_MS,
  SIGN_IN_LINK_WINDOW_MS,
  SIGN_IN_LINKS_OVERALL_PER_HOUR,
  SIGN_IN_LINKS_PER_DEVICE_PER_HOUR,
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
 * Records one sign-in link request, unless a limit is reached. `inbox_limited` sends nothing and
 * answers like a sent link (the form never reveals an address); `device_limited` and `busy` are
 * refused with "try again later". Rows older than a day go with the daily purge
 * (`crm/customerAppSignInRetention`).
 */
export const recordSignInLink = internalMutation({
  args: { deviceDigest: v.string(), recipientDigest: v.string(), tokenDigest: v.string() },
  handler: async (ctx, args) => {
    const since = Date.now() - SIGN_IN_LINK_WINDOW_MS;
    const [inbox, device, overall] = await Promise.all([
      ctx.db
        .query("customerAppSignInLinks")
        .withIndex("by_recipientDigest_and_requestedAt", (q) =>
          q.eq("recipientDigest", args.recipientDigest).gt("requestedAt", since)
        )
        .take(SIGN_IN_LINKS_PER_HOUR),
      ctx.db
        .query("customerAppSignInLinks")
        .withIndex("by_deviceDigest_and_requestedAt", (q) =>
          q.eq("deviceDigest", args.deviceDigest).gt("requestedAt", since)
        )
        .take(SIGN_IN_LINKS_PER_DEVICE_PER_HOUR),
      ctx.db
        .query("customerAppSignInLinks")
        .withIndex("by_requestedAt", (q) => q.gt("requestedAt", since))
        .take(SIGN_IN_LINKS_OVERALL_PER_HOUR),
    ]);
    if (overall.length >= SIGN_IN_LINKS_OVERALL_PER_HOUR) {
      return "busy" as const;
    }
    if (device.length >= SIGN_IN_LINKS_PER_DEVICE_PER_HOUR) {
      return "device_limited" as const;
    }
    if (inbox.length >= SIGN_IN_LINKS_PER_HOUR) {
      return "inbox_limited" as const;
    }
    await ctx.db.insert("customerAppSignInLinks", { ...args, requestedAt: Date.now() });
    return "recorded" as const;
  },
  returns: v.union(
    v.literal("recorded"),
    v.literal("inbox_limited"),
    v.literal("device_limited"),
    v.literal("busy")
  ),
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
    if (
      !row ||
      row.consumedAt !== undefined ||
      Date.now() - row.requestedAt > SIGN_IN_LINK_ROW_TTL_MS
    ) {
      return false;
    }
    if ((await sha256Hex(args.deviceSecret)) !== row.deviceDigest) {
      return false;
    }
    // Kept, used, so it still counts toward the hour's limits until the daily purge.
    await ctx.db.patch("customerAppSignInLinks", row._id, { consumedAt: Date.now() });
    return true;
  },
  returns: v.boolean(),
});
