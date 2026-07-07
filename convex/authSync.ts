import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation } from "./_generated/server";
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
  image: typeof identity.picture === "string" ? identity.picture : undefined,
  name: identity.name ?? undefined,
});

export const syncFromIdentity = internalMutation({
  args: {
    authUserId: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => await syncAuthRecords(ctx, args),
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

    const [staffRows, profiles] = await Promise.all([
      ctx.db.query("staffUsers").collect(),
      ctx.db.query("userProfiles").collect(),
    ]);
    const now = Date.now();
    let staffRelinked = 0;
    let profilesRelinked = 0;
    let duplicatesRemoved = 0;

    const profilesByEmail = new Map<string, typeof profiles>();
    const profilesByAuthUserId = new Map<string, (typeof profiles)[number]>();
    const firstProfileWithAuthByEmail = new Map<string, (typeof profiles)[number]>();
    const profileByEmailAndAuth = new Map<string, (typeof profiles)[number]>();
    for (const profile of profiles) {
      const key = normalizeEmail(profile.email);
      if (!key) {
        continue;
      }
      const bucket = profilesByEmail.get(key) ?? [];
      bucket.push(profile);
      profilesByEmail.set(key, bucket);
      if (profile.authUserId) {
        profilesByAuthUserId.set(profile.authUserId, profile);
        firstProfileWithAuthByEmail.set(key, firstProfileWithAuthByEmail.get(key) ?? profile);
        profileByEmailAndAuth.set(`${key}:${profile.authUserId}`, profile);
      }
    }

    const orphanProfilePatches = [];
    for (const staff of staffRows) {
      if (!staff.authUserId) {
        continue;
      }
      const profileByAuth = profilesByAuthUserId.get(staff.authUserId);
      if (profileByAuth) {
        continue;
      }

      const emailKey = staff.emailNormalized || normalizeEmail(staff.email);
      const bucket = profilesByEmail.get(emailKey) ?? [];
      let orphan: (typeof profiles)[number] | undefined;
      for (const profile of bucket) {
        if (profile.authUserId !== staff.authUserId) {
          orphan = profile;
          break;
        }
      }
      if (!orphan) {
        continue;
      }

      orphanProfilePatches.push({
        id: orphan._id,
        patch: {
          authUserId: staff.authUserId,
          email: staff.email,
          name: staff.name || orphan.name,
          updatedAt: now,
        },
      });
    }
    await Promise.all(orphanProfilePatches.map(({ id, patch }) => ctx.db.patch(id, patch)));
    profilesRelinked += orphanProfilePatches.length;

    const processedEmailKeys = new Set<string>();
    const keeperPatches = [];
    const duplicateProfileIds = [];
    const staffPatches = [];
    for (const staff of staffRows) {
      const emailKey = staff.emailNormalized || normalizeEmail(staff.email);
      if (!emailKey) {
        continue;
      }
      if (processedEmailKeys.has(emailKey)) {
        continue;
      }
      processedEmailKeys.add(emailKey);

      const bucket = profilesByEmail.get(emailKey) ?? [];
      if (bucket.length <= 1) {
        continue;
      }

      const canonicalAuthUserId =
        staff.authUserId ??
        firstProfileWithAuthByEmail.get(emailKey)?.authUserId ??
        bucket[0]?.authUserId;
      if (!canonicalAuthUserId) {
        continue;
      }

      const keeper = profileByEmailAndAuth.get(`${emailKey}:${canonicalAuthUserId}`) ?? bucket[0];
      if (!keeper) {
        continue;
      }

      if (keeper.authUserId !== canonicalAuthUserId) {
        keeperPatches.push({
          id: keeper._id,
          patch: {
            authUserId: canonicalAuthUserId,
            updatedAt: now,
          },
        });
        profilesRelinked += 1;
      }

      for (const profile of bucket) {
        if (profile._id === keeper._id) {
          continue;
        }
        duplicateProfileIds.push(profile._id);
        duplicatesRemoved += 1;
      }

      if (staff.authUserId !== canonicalAuthUserId) {
        staffPatches.push({
          id: staff._id,
          patch: {
            authUserId: canonicalAuthUserId,
            updatedAt: now,
          },
        });
        staffRelinked += 1;
      }
    }
    await Promise.all([
      ...keeperPatches.map(({ id, patch }) => ctx.db.patch(id, patch)),
      ...duplicateProfileIds.map((id) => ctx.db.delete(id)),
      ...staffPatches.map(({ id, patch }) => ctx.db.patch(id, patch)),
    ]);

    return {
      duplicatesRemoved,
      profilesRelinked,
      profileTotal: profiles.length,
      staffRelinked,
      staffTotal: staffRows.length,
    };
  },
});
