import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { UserIdentity } from "convex/server";

const now = () => Date.now();
const getIdentityImage = (identity: UserIdentity) =>
  typeof identity.picture === "string" ? identity.picture : "";

const toApiUser = (profile: Doc<"userProfiles"> | null, identity: UserIdentity) => {
  const createdAt = profile?.createdAt ?? now();
  const updatedAt = profile?.updatedAt ?? createdAt;

  return {
    id: identity.subject,
    email: profile?.email ?? identity.email ?? "",
    name: profile?.name ?? identity.name ?? "Traveler",
    phoneNumber: profile?.phoneNumber ?? "",
    image: profile?.image ?? (getIdentityImage(identity) || null),
    passportDetailsEncrypted: profile?.passportDetailsEncrypted ?? null,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
  };
};

const getIdentityOrThrow = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
};

const getProfileByAuthUserId = async (ctx: QueryCtx | MutationCtx, authUserId: string) => {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
};

export const ensureMyProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentityOrThrow(ctx);
    const existing = await getProfileByAuthUserId(ctx, identity.subject);

    if (existing) {
      return toApiUser(existing, identity);
    }

    const createdAt = now();
    await ctx.db.insert("userProfiles", {
      authUserId: identity.subject,
      email: identity.email ?? "",
      name: identity.name ?? "Traveler",
      phoneNumber: "",
      passportDetailsEncrypted: "",
      image: getIdentityImage(identity),
      createdAt,
      updatedAt: createdAt,
    });

    return {
      id: identity.subject,
      email: identity.email ?? "",
      name: identity.name ?? "Traveler",
      phoneNumber: "",
      image: getIdentityImage(identity) || null,
      passportDetailsEncrypted: "",
      createdAt: new Date(createdAt).toISOString(),
      updatedAt: new Date(createdAt).toISOString(),
    };
  },
});

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const profile = await getProfileByAuthUserId(ctx, identity.subject);
    return toApiUser(profile, identity);
  },
});

export const updateMyProfile = mutation({
  args: {
    name: v.string(),
    phoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const current = await getProfileByAuthUserId(ctx, identity.subject);
    const updatedAt = now();

    if (!current) {
      const createdAt = updatedAt;
      await ctx.db.insert("userProfiles", {
        authUserId: identity.subject,
        email: identity.email ?? "",
        name: args.name,
        phoneNumber: args.phoneNumber ?? "",
        passportDetailsEncrypted: "",
        image: getIdentityImage(identity),
        createdAt,
        updatedAt,
      });
      return {
        id: identity.subject,
        email: identity.email ?? "",
        name: args.name,
        phoneNumber: args.phoneNumber ?? "",
        image: getIdentityImage(identity) || null,
        passportDetailsEncrypted: "",
        createdAt: new Date(createdAt).toISOString(),
        updatedAt: new Date(updatedAt).toISOString(),
      };
    }

    await ctx.db.patch(current._id, {
      name: args.name,
      phoneNumber: args.phoneNumber ?? "",
      updatedAt,
    });

    return {
      id: identity.subject,
      email: current.email,
      name: args.name,
      phoneNumber: args.phoneNumber ?? "",
      image: current.image ?? null,
      passportDetailsEncrypted: current.passportDetailsEncrypted ?? "",
      createdAt: new Date(current.createdAt).toISOString(),
      updatedAt: new Date(updatedAt).toISOString(),
    };
  },
});
