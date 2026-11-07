import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { normalizeEmail } from "./crm/lib/staffAccess";

/**
 * Staff sign in with their password (Citius Connect, the portal), never with the customer app's
 * email link, so a staff mailbox alone cannot open a staff session without the password.
 */
export const isStaffEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      return false;
    }
    const rows = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", email))
      .take(5);
    return rows.some((row) => row.active);
  },
  returns: v.boolean(),
});
