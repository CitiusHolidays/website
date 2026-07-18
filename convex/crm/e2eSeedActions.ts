"use node";

import { hashPassword } from "better-auth/crypto";
import { ConvexError, v } from "convex/values";
import { components, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { createAuth } from "../betterAuth/auth";
import { findAuthAccountsByUserId, findAuthUserByEmail } from "../lib/betterAuthLookup";
import { listE2eStaffProfileSeeds } from "./e2eStaffProfiles";
import { assertE2eSecret } from "./lib/e2eAuth";

const seedProfileResultValidator = v.object({
  authLinked: v.boolean(),
  created: v.boolean(),
  email: v.string(),
  key: v.string(),
  staffId: v.id("staffUsers"),
  verified: v.boolean(),
});

async function markAuthUserVerified(
  ctx: Parameters<typeof findAuthUserByEmail>[0],
  userId: string
) {
  await ctx.runMutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "user",
      update: {
        emailVerified: true,
        updatedAt: Date.now(),
      },
      where: [{ field: "_id", operator: "eq", value: userId }],
    },
  });
}

async function ensureCredentialPassword(
  ctx: Parameters<typeof findAuthUserByEmail>[0],
  userId: string,
  password: string
) {
  const accounts = await findAuthAccountsByUserId(ctx, userId);
  const credential = accounts.find((account) => account.providerId === "credential");
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  if (credential?._id) {
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "account",
        update: { password: passwordHash, updatedAt: now },
        where: [{ field: "_id", operator: "eq", value: credential._id }],
      },
    });
    return;
  }

  await ctx.runMutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        accountId: userId,
        createdAt: now,
        password: passwordHash,
        providerId: "credential",
        updatedAt: now,
        userId,
      },
      model: "account",
    },
  });
}

async function ensureCredentialAuthUser(
  ctx: Parameters<typeof findAuthUserByEmail>[0],
  args: { email: string; name: string; password: string }
) {
  const auth = createAuth(ctx);
  const existing = await findAuthUserByEmail(ctx, args.email);

  if (existing?._id) {
    const authUserId = String(existing._id);
    await markAuthUserVerified(ctx, authUserId);
    await ensureCredentialPassword(ctx, authUserId, args.password);
    return { authUserId, created: false, verified: true };
  }

  const result = await auth.api.signUpEmail({
    body: {
      email: args.email,
      name: args.name,
      password: args.password,
    },
  });

  if (!result?.user?.id) {
    throw new ConvexError(`Failed to create auth user for ${args.email}`);
  }

  await markAuthUserVerified(ctx, result.user.id);
  return { authUserId: result.user.id, created: true, verified: true };
}

export const run = action({
  args: {
    secret: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      authLinked: boolean;
      created: boolean;
      email: string;
      key: string;
      staffId: import("../_generated/dataModel").Id<"staffUsers">;
      verified: boolean;
    }>
  > => {
    assertE2eSecret(args.secret);
    const password = process.env.E2E_STAFF_PASSWORD;
    if (!password || password.length < 8) {
      throw new ConvexError("E2E_STAFF_PASSWORD must be set and at least 8 characters");
    }

    const staffRows = await ctx.runMutation(internal.crm.e2eSeed.seedStaffProfiles, {
      secret: args.secret,
    });

    const profilesByKey = new Map(
      listE2eStaffProfileSeeds().map((profile) => [profile.key, profile])
    );
    const results: Array<{
      authLinked: boolean;
      created: boolean;
      email: string;
      key: string;
      staffId: import("../_generated/dataModel").Id<"staffUsers">;
      verified: boolean;
    }> = [];

    for (const staffRow of staffRows) {
      const profile = profilesByKey.get(staffRow.key);
      if (!profile) {
        throw new ConvexError(`Missing E2E profile config for ${staffRow.key}`);
      }

      // biome-ignore lint/performance/noAwaitInLoops: auth provisioning must stay sequential for rate limits
      const auth = await ensureCredentialAuthUser(ctx, {
        email: profile.email,
        name: profile.name,
        password,
      });

      await ctx.runMutation(internal.crm.staff.linkAuthUserId, {
        authUserId: auth.authUserId,
        email: profile.email,
        name: profile.name,
        staffId: staffRow.staffId,
      });

      await ctx.runMutation(internal.crm.staff.clearPendingPasswordSetup, {
        staffId: staffRow.staffId,
      });

      results.push({
        authLinked: true,
        created: staffRow.created,
        email: staffRow.email,
        key: staffRow.key,
        staffId: staffRow.staffId,
        verified: auth.verified,
      });
    }

    return results;
  },
  returns: v.array(seedProfileResultValidator),
});
