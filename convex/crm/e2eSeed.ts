import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { listE2eStaffProfileSeeds } from "./e2eStaffProfiles";
import { ALL_ROLES } from "./lib";
import { assertE2eSecret } from "./lib/e2eAuth";

const validRoleSet = new Set<string>(ALL_ROLES);

const upsertResultValidator = v.object({
  created: v.boolean(),
  email: v.string(),
  key: v.string(),
  staffId: v.id("staffUsers"),
});

function sanitizeRoles(roles: string[]) {
  const clean = Array.from(new Set(roles.filter((role) => validRoleSet.has(role))));
  if (clean.length === 0) {
    throw new ConvexError("At least one valid role is required");
  }
  return clean;
}

async function upsertStaffProfileRow(
  ctx: MutationCtx,
  args: {
    email: string;
    emailNormalized: string;
    key: string;
    name: string;
    roles: string[];
  }
) {
  const roles = sanitizeRoles(args.roles);
  const now = Date.now();
  const existing = await ctx.db
    .query("staffUsers")
    .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", args.emailNormalized))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      active: true,
      email: args.email,
      emailNormalized: args.emailNormalized,
      name: args.name,
      pendingPasswordSetup: false,
      roles: roles as never,
      updatedAt: now,
    });
    return {
      created: false,
      email: args.email,
      key: args.key,
      staffId: existing._id,
    };
  }

  const staffId = await ctx.db.insert("staffUsers", {
    active: true,
    createdAt: now,
    email: args.email,
    emailNormalized: args.emailNormalized,
    employmentStatus: "Confirmed",
    name: args.name,
    pendingPasswordSetup: false,
    roles: roles as never,
    updatedAt: now,
  });

  return {
    created: true,
    email: args.email,
    key: args.key,
    staffId,
  };
}

export const upsertStaffProfile = internalMutation({
  args: {
    email: v.string(),
    emailNormalized: v.string(),
    key: v.string(),
    name: v.string(),
    roles: v.array(v.string()),
  },
  handler: async (ctx, args) => upsertStaffProfileRow(ctx, args),
  returns: upsertResultValidator,
});

export const seedStaffProfiles = internalMutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertE2eSecret(args.secret);
    const results = [];
    for (const profile of listE2eStaffProfileSeeds()) {
      results.push(await upsertStaffProfileRow(ctx, profile));
    }
    return results;
  },
  returns: v.array(upsertResultValidator),
});
