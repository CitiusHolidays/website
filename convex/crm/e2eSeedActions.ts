"use node";

import { hashPassword } from "better-auth/crypto";
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
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

const seedRunResultValidator = v.object({
  customerFixture: v.object({
    destination: v.string(),
    email: v.string(),
    name: v.string(),
    queryCode: v.string(),
  }),
  profiles: v.array(seedProfileResultValidator),
  run: v.object({
    runId: v.string(),
    target: v.union(v.literal("development"), v.literal("preview")),
    targetId: v.string(),
  }),
  workflowFixtures: v.object({
    cementClientName: v.string(),
    clientName: v.string(),
    nonCementClientName: v.string(),
    proposalId: v.id("proposals"),
    queryCode: v.string(),
    queryId: v.id("queries"),
  }),
});

interface SeedProfileResult {
  authLinked: boolean;
  created: boolean;
  email: string;
  key: string;
  staffId: import("../_generated/dataModel").Id<"staffUsers">;
  verified: boolean;
}

interface WorkflowFixtureResult {
  cementClientName: string;
  clientName: string;
  nonCementClientName: string;
  proposalId: import("../_generated/dataModel").Id<"proposals">;
  queryCode: string;
  queryId: import("../_generated/dataModel").Id<"queries">;
}

interface CustomerJourneyFixtureResult {
  destination: string;
  email: string;
  name: string;
  queryCode: string;
}

const createIncompleteProposalHandoff = makeFunctionReference<
  "mutation",
  { label: string; runId: string },
  WorkflowFixtureResult
>("crm/e2eFixtures:createIncompleteProposalHandoff");

const createCustomerAccountJourney = makeFunctionReference<
  "mutation",
  {
    authUserId: string;
    canonicalAuthUserId: string;
    email: string;
    name: string;
    runId: string;
  },
  CustomerJourneyFixtureResult
>("crm/e2eFixtures:createCustomerAccountJourney");

const beginE2eRun = makeFunctionReference<
  "mutation",
  { authUserIds: string[]; runId: string; targetId: string },
  { runId: string; target: "development" | "preview"; targetId: string }
>("crm/e2eRunOwnership:begin");

const cleanupE2eRunPage = makeFunctionReference<
  "mutation",
  { pageSize: number; runId: string; targetId: string },
  { complete: boolean; deleted: number; residualCount: number; runId: string }
>("crm/e2eRunOwnership:cleanupPage");

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

export const run = internalAction({
  args: { runId: v.string(), targetId: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{
    customerFixture: CustomerJourneyFixtureResult;
    profiles: SeedProfileResult[];
    run: { runId: string; target: "development" | "preview"; targetId: string };
    workflowFixtures: WorkflowFixtureResult;
  }> => {
    assertE2eSecret();
    const password = process.env.E2E_STAFF_PASSWORD;
    if (!password || password.length < 8) {
      throw new ConvexError("E2E_STAFF_PASSWORD must be set and at least 8 characters");
    }
    const convexSiteUrl = process.env.CONVEX_SITE_URL;
    if (!(convexSiteUrl && URL.canParse(convexSiteUrl))) {
      throw new ConvexError("CONVEX_SITE_URL is required for E2E identity ownership");
    }
    const parsedConvexSiteUrl = URL.parse(convexSiteUrl);
    if (!parsedConvexSiteUrl) {
      throw new ConvexError("CONVEX_SITE_URL must be a valid URL");
    }
    const convexSiteOrigin = parsedConvexSiteUrl.origin;

    const staffRows = await ctx.runMutation(internal.crm.e2eSeed.seedStaffProfiles, {});

    const profilesByKey = new Map(
      listE2eStaffProfileSeeds().map((profile) => [profile.key, profile])
    );
    const results: SeedProfileResult[] = [];
    const authUserIds: string[] = [];

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
      authUserIds.push(auth.authUserId, `${convexSiteOrigin}|${auth.authUserId}`);
    }

    const customer = {
      email: "e2e-customer@citius-e2e.test",
      name: "E2E Customer",
    };
    const customerAuth = await ensureCredentialAuthUser(ctx, {
      ...customer,
      password,
    });
    const canonicalCustomerAuthUserId = `${convexSiteOrigin}|${customerAuth.authUserId}`;

    const runRegistration = await ctx.runMutation(beginE2eRun, {
      authUserIds: Array.from(
        new Set([...authUserIds, customerAuth.authUserId, canonicalCustomerAuthUserId])
      ),
      runId: args.runId,
      targetId: args.targetId,
    });
    const workflowFixtures = await ctx.runMutation(createIncompleteProposalHandoff, {
      label: "E2E Incomplete Proposal Guard",
      runId: args.runId,
    });
    const customerFixture = await ctx.runMutation(createCustomerAccountJourney, {
      authUserId: customerAuth.authUserId,
      canonicalAuthUserId: canonicalCustomerAuthUserId,
      email: customer.email,
      name: customer.name,
      runId: args.runId,
    });
    return { customerFixture, profiles: results, run: runRegistration, workflowFixtures };
  },
  returns: seedRunResultValidator,
});

export const cleanup = internalAction({
  args: { runId: v.string(), targetId: v.string() },
  handler: async (ctx, args) => {
    assertE2eSecret();
    let deleted = 0;
    let result = await ctx.runMutation(cleanupE2eRunPage, {
      pageSize: 50,
      runId: args.runId,
      targetId: args.targetId,
    });
    deleted += result.deleted;
    for (let page = 1; page < 20 && !result.complete; page += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: cleanup pages are intentionally sequential
      result = await ctx.runMutation(cleanupE2eRunPage, {
        pageSize: 50,
        runId: args.runId,
        targetId: args.targetId,
      });
      deleted += result.deleted;
    }
    return { ...result, deleted };
  },
  returns: v.object({
    complete: v.boolean(),
    deleted: v.number(),
    residualCount: v.number(),
    runId: v.string(),
  }),
});
