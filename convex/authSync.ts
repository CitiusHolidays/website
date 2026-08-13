import { paginationOptsValidator, type UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation } from "./_generated/server";
import { legacyAuthUserId } from "./lib/authIdentity";
import { syncAuthRecords } from "./lib/authSync";
import { ensureCanonicalIdentityLink } from "./lib/customerIdentityAccess";
import { processStaffAuthLinkBatch } from "./lib/staffAuthRepair";
import { authRepairResultValidator, authSyncResultValidator } from "./publicReturnContracts";

const getIdentityOrThrow = async (ctx: MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
};

const identityToSyncInput = (identity: UserIdentity) => ({
  email: identity.email ?? "",
  image: typeof identity.picture === "string" ? identity.picture : undefined,
  legacyAuthUserId: legacyAuthUserId(identity) ?? undefined,
  name: identity.name ?? undefined,
});

export const syncFromIdentity = internalMutation({
  args: {
    authUserId: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    legacyAuthUserId: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => await syncAuthRecords(ctx, args),
});

export const syncMyAuthIdentity = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentityOrThrow(ctx);
    const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
    return await syncAuthRecords(ctx, { ...identityToSyncInput(identity), authUserId });
  },
  returns: authSyncResultValidator,
});

export const repairAuthLinks = mutation({
  args: {
    mode: v.union(v.literal("inventory"), v.literal("repair")),
    paginationOpts: paginationOptsValidator,
    secret: v.string(),
  },
  handler: processStaffAuthLinkBatch,
  returns: authRepairResultValidator,
});
