import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { UserIdentity } from "convex/server";
import { normalizeEmail } from "./crm/lib";
import { syncAuthRecords } from "./lib/authSync";

const getIdentityOrThrow = async (ctx: MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
};

const identityToSyncInput = (identity: UserIdentity) => ({
  authUserId: identity.subject,
  email: identity.email ?? "",
  name: identity.name ?? undefined,
  image: typeof identity.picture === "string" ? identity.picture : undefined,
});

export const syncFromIdentity = internalMutation({
  args: {
    authUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await syncAuthRecords(ctx, args);
  },
});

export const syncMyAuthIdentity = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentityOrThrow(ctx);
    return await syncAuthRecords(ctx, identityToSyncInput(identity));
  },
});

export const repairAuthLinks = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.MIGRATION_SECRET;
    if (!expected || args.secret !== expected) {
      throw new ConvexError("Invalid migration secret");
    }

    const staffRows = await ctx.db.query("staffUsers").collect();
    const profiles = await ctx.db.query("userProfiles").collect();
    const now = Date.now();
    let staffRelinked = 0;
    let profilesRelinked = 0;
    let duplicatesRemoved = 0;

    const profilesByEmail = new Map<string, typeof profiles>();
    for (const profile of profiles) {
      const key = normalizeEmail(profile.email);
      if (!key) {
        continue;
      }
      const bucket = profilesByEmail.get(key) ?? [];
      bucket.push(profile);
      profilesByEmail.set(key, bucket);
    }

    for (const staff of staffRows) {
      if (!staff.authUserId) {
        continue;
      }
      const profileByAuth = profiles.find(
        (profile) => profile.authUserId === staff.authUserId,
      );
      if (profileByAuth) {
        continue;
      }

      const emailKey = staff.emailNormalized || normalizeEmail(staff.email);
      const bucket = profilesByEmail.get(emailKey) ?? [];
      const orphan = bucket.find((profile) => profile.authUserId !== staff.authUserId);
      if (!orphan) {
        continue;
      }

      await ctx.db.patch(orphan._id, {
        authUserId: staff.authUserId,
        email: staff.email,
        name: staff.name || orphan.name,
        updatedAt: now,
      });
      profilesRelinked += 1;
    }

    for (const staff of staffRows) {
      const emailKey = staff.emailNormalized || normalizeEmail(staff.email);
      if (!emailKey) {
        continue;
      }

      const bucket = profilesByEmail.get(emailKey) ?? [];
      if (bucket.length <= 1) {
        continue;
      }

      const canonicalAuthUserId =
        staff.authUserId ??
        bucket.find((profile) => profile.authUserId)?.authUserId ??
        bucket[0]?.authUserId;
      if (!canonicalAuthUserId) {
        continue;
      }

      const keeper =
        bucket.find((profile) => profile.authUserId === canonicalAuthUserId) ??
        bucket[0];
      if (!keeper) {
        continue;
      }

      if (keeper.authUserId !== canonicalAuthUserId) {
        await ctx.db.patch(keeper._id, {
          authUserId: canonicalAuthUserId,
          updatedAt: now,
        });
        profilesRelinked += 1;
      }

      for (const profile of bucket) {
        if (profile._id === keeper._id) {
          continue;
        }
        await ctx.db.delete(profile._id);
        duplicatesRemoved += 1;
      }

      if (staff.authUserId !== canonicalAuthUserId) {
        await ctx.db.patch(staff._id, {
          authUserId: canonicalAuthUserId,
          updatedAt: now,
        });
        staffRelinked += 1;
      }
    }

    return {
      staffRelinked,
      profilesRelinked,
      duplicatesRemoved,
      staffTotal: staffRows.length,
      profileTotal: profiles.length,
    };
  },
});
