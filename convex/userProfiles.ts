import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { legacyAuthUserId } from "./lib/authIdentity";
import { syncAuthRecords } from "./lib/authSync";
import {
  authorizedCustomerIdentityIds,
  ensureCanonicalIdentityLink,
  establishCanonicalIdentityLink,
  publicAccountId,
} from "./lib/customerIdentityAccess";
import { stableProfileTimestamps } from "./lib/profileFallback";
import {
  nullablePublicUserProfileValidator,
  publicUserProfileValidator,
} from "./publicReturnContracts";

const now = () => Date.now();
const getIdentityImage = (identity: UserIdentity) =>
  typeof identity.picture === "string" ? identity.picture : "";

const toApiUser = async (profile: Doc<"userProfiles"> | null, identity: UserIdentity) => {
  const timestamps = stableProfileTimestamps(profile, identity);

  return {
    createdAt: timestamps.createdAt,
    email: profile?.email ?? identity.email ?? "",
    hasPassportDetails: Boolean(profile?.passportDetailsEncrypted),
    id: await publicAccountId(identity, profile?._id),
    image: profile?.image ?? (getIdentityImage(identity) || null),
    name: profile?.name ?? identity.name ?? "Traveler",
    phoneNumber: profile?.phoneNumber ?? "",
    updatedAt: timestamps.updatedAt,
  };
};

const getIdentityOrThrow = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
};

const getProfileByAuthUserId = async (ctx: QueryCtx | MutationCtx, authUserId: string) =>
  await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();

export const establishMyIdentity = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentityOrThrow(ctx);
    return await establishCanonicalIdentityLink(ctx, identity);
  },
  returns: v.union(
    v.object({ authUserId: v.string(), status: v.literal("linked") }),
    v.object({ authUserId: v.null(), status: v.literal("conflict") })
  ),
});

async function getProfileForIdentity(ctx: QueryCtx | MutationCtx, identity: UserIdentity) {
  const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
  const profiles = await Promise.all(identityIds.map((id) => getProfileByAuthUserId(ctx, id)));
  return profiles.find(Boolean) ?? null;
}

export const ensureMyProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentityOrThrow(ctx);
    const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
    await syncAuthRecords(ctx, {
      authUserId,
      email: identity.email ?? "",
      image: getIdentityImage(identity) || undefined,
      legacyAuthUserId: legacyAuthUserId(identity) ?? undefined,
      name: identity.name ?? undefined,
    });

    const existing = await getProfileByAuthUserId(ctx, authUserId);
    if (existing) {
      return await toApiUser(existing, identity);
    }

    const createdAt = now();
    return {
      createdAt: new Date(createdAt).toISOString(),
      email: identity.email ?? "",
      hasPassportDetails: false,
      id: await publicAccountId(identity),
      image: getIdentityImage(identity) || null,
      name: identity.name ?? "Traveler",
      phoneNumber: "",
      updatedAt: new Date(createdAt).toISOString(),
    };
  },
  returns: publicUserProfileValidator,
});

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const profile = await getProfileForIdentity(ctx, identity);
    return await toApiUser(profile, identity);
  },
  returns: nullablePublicUserProfileValidator,
});

export const updateMyProfile = mutation({
  args: {
    name: v.string(),
    phoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
    const current = await getProfileForIdentity(ctx, identity);
    const updatedAt = now();

    if (!current) {
      await syncAuthRecords(ctx, {
        authUserId,
        email: identity.email ?? "",
        image: getIdentityImage(identity) || undefined,
        legacyAuthUserId: legacyAuthUserId(identity) ?? undefined,
        name: args.name,
      });
      const created = await getProfileByAuthUserId(ctx, authUserId);
      if (created) {
        await ctx.db.patch(created._id, {
          name: args.name,
          phoneNumber: args.phoneNumber ?? "",
          updatedAt,
        });
      }
      return {
        createdAt: new Date(updatedAt).toISOString(),
        email: identity.email ?? "",
        hasPassportDetails: false,
        id: await publicAccountId(identity, created?._id),
        image: getIdentityImage(identity) || null,
        name: args.name,
        phoneNumber: args.phoneNumber ?? "",
        updatedAt: new Date(updatedAt).toISOString(),
      };
    }

    await ctx.db.patch(current._id, {
      name: args.name,
      phoneNumber: args.phoneNumber ?? "",
      updatedAt,
    });

    return {
      createdAt: new Date(current.createdAt).toISOString(),
      email: current.email,
      hasPassportDetails: Boolean(current.passportDetailsEncrypted),
      id: await publicAccountId(identity, current._id),
      image: current.image ?? null,
      name: args.name,
      phoneNumber: args.phoneNumber ?? "",
      updatedAt: new Date(updatedAt).toISOString(),
    };
  },
  returns: publicUserProfileValidator,
});
