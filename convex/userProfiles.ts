import type { UserIdentity } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { syncAuthRecords } from "./lib/authSync";

const now = () => Date.now();
const getIdentityImage = (identity: UserIdentity) =>
  typeof identity.picture === "string" ? identity.picture : "";

const toApiUser = (profile: Doc<"userProfiles"> | null, identity: UserIdentity) => {
  const createdAt = profile?.createdAt ?? now();
  const updatedAt = profile?.updatedAt ?? createdAt;

  return {
    createdAt: new Date(createdAt).toISOString(),
    email: profile?.email ?? identity.email ?? "",
    id: identity.subject,
    image: profile?.image ?? (getIdentityImage(identity) || null),
    name: profile?.name ?? identity.name ?? "Traveler",
    passportDetailsEncrypted: profile?.passportDetailsEncrypted ?? null,
    phoneNumber: profile?.phoneNumber ?? "",
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

const getProfileByAuthUserId = async (ctx: QueryCtx | MutationCtx, authUserId: string) =>
  await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();

export const ensureMyProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentityOrThrow(ctx);
    await syncAuthRecords(ctx, {
      authUserId: identity.subject,
      email: identity.email ?? "",
      image: getIdentityImage(identity) || undefined,
      name: identity.name ?? undefined,
    });

    const existing = await getProfileByAuthUserId(ctx, identity.subject);
    if (existing) {
      return toApiUser(existing, identity);
    }

    const createdAt = now();
    return {
      createdAt: new Date(createdAt).toISOString(),
      email: identity.email ?? "",
      id: identity.subject,
      image: getIdentityImage(identity) || null,
      name: identity.name ?? "Traveler",
      passportDetailsEncrypted: "",
      phoneNumber: "",
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
      await syncAuthRecords(ctx, {
        authUserId: identity.subject,
        email: identity.email ?? "",
        image: getIdentityImage(identity) || undefined,
        name: args.name,
      });
      const created = await getProfileByAuthUserId(ctx, identity.subject);
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
        id: identity.subject,
        image: getIdentityImage(identity) || null,
        name: args.name,
        passportDetailsEncrypted: "",
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
      id: identity.subject,
      image: current.image ?? null,
      name: args.name,
      passportDetailsEncrypted: current.passportDetailsEncrypted ?? "",
      phoneNumber: args.phoneNumber ?? "",
      updatedAt: new Date(updatedAt).toISOString(),
    };
  },
});
