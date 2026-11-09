/**
 * A staff member's password is set only through a link emailed to their inbox: the office's setup
 * link, or a reset link, which is the same kind of link.
 *
 * Anyone can sign up on the public site with an address before the office adds that person as
 * staff, choosing the password themselves. That account cannot sign in until the address is
 * verified, and only the real person can verify it; but once they do, or once the office links
 * the account, the stranger's password would open a staff session until the real person finished
 * setup. So when provisioning links an account and when a pending staff member verifies their
 * address, a password not set through a link is removed with every session it may have opened.
 * Staff who already set their password through a link keep it.
 */
import { v } from "convex/values";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { normalizeEmail } from "./lib";

const BETTER_AUTH_PAGE_SIZE = 100;

interface DeletedPage {
  continueCursor: string;
  count: number;
  isDone: boolean;
}

/** Runs a Better Auth `deleteMany` page by page until nothing matches. */
async function deleteEveryPage(deletePage: (cursor: string | null) => Promise<DeletedPage>) {
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

/** Called by Better Auth after a password reset (`onPasswordReset`): the link proved the inbox. */
export const recordPasswordSetByLink = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const emailNormalized = normalizeEmail(args.email);
    const staff = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
      .take(2);
    const now = Date.now();
    await Promise.all(
      staff.map((row) =>
        ctx.db.patch("staffUsers", row._id, { passwordSetByLinkAt: now, updatedAt: now })
      )
    );
    return null;
  },
  returns: v.null(),
});

async function staffSetPasswordByLink(ctx: MutationCtx, staffId: Id<"staffUsers">) {
  const staff = await ctx.db.get("staffUsers", staffId);
  return staff?.passwordSetByLinkAt !== undefined;
}

/**
 * Removes the account's password and signs out every session, unless the staff member set that
 * password through a link. Returns whether a password was removed.
 */
export const discardPasswordNotSetByLink = internalMutation({
  args: { authUserId: v.string(), staffId: v.id("staffUsers") },
  handler: async (ctx, args) => {
    if (await staffSetPasswordByLink(ctx, args.staffId)) {
      return false;
    }
    const paginationOpts = (cursor: string | null) => ({ cursor, numItems: BETTER_AUTH_PAGE_SIZE });
    const removed = await deleteEveryPage((cursor) =>
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "account",
          where: [
            { field: "providerId", operator: "eq", value: "credential" },
            { field: "userId", operator: "eq", value: args.authUserId },
          ],
        },
        paginationOpts: paginationOpts(cursor),
      })
    );
    if (removed === 0) {
      return false;
    }
    await deleteEveryPage((cursor) =>
      ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: {
          model: "session",
          where: [{ field: "userId", operator: "eq", value: args.authUserId }],
        },
        paginationOpts: paginationOpts(cursor),
      })
    );
    console.warn(JSON.stringify({ event: "staff.password_not_set_by_link_removed" }));
    return true;
  },
  returns: v.boolean(),
});
