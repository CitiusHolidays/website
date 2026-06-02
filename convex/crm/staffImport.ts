import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { ALL_ROLES, normalizeEmail } from "./lib";

const assertMigrationSecret = (secret: string) => {
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError("Invalid migration secret");
  }
};

const validRoleSet = new Set<string>(ALL_ROLES);

const sanitizeRoles = (roles: string[]) => {
  const clean = Array.from(new Set(roles.filter((role) => validRoleSet.has(role))));
  if (clean.length === 0) {
    throw new ConvexError("At least one valid role is required");
  }
  return clean;
};

const staffRowValidator = v.object({
  email: v.string(),
  name: v.string(),
  roles: v.array(v.string()),
  department: v.optional(v.string()),
  function: v.optional(v.string()),
  mobile: v.optional(v.string()),
  location: v.optional(v.string()),
});

async function importStaffRows(
  ctx: MutationCtx,
  args: {
    employees: Array<{
      email: string;
      name: string;
      roles: string[];
      department?: string;
      function?: string;
      mobile?: string;
      location?: string;
    }>;
    dryRun?: boolean;
    provisionAuth?: boolean;
  },
) {
  const dryRun = args.dryRun ?? false;
  const provisionAuth = args.provisionAuth ?? false;
  const now = Date.now();
  const results = await Promise.all(
    args.employees.map(async (row) => {
      const emailNormalized = normalizeEmail(row.email);
      if (!emailNormalized || !/@/.test(emailNormalized)) {
        return {
          email: row.email,
          name: row.name,
          roles: row.roles,
          action: "skipped" as const,
          message: "Invalid email",
        };
      }

      try {
        const roles = sanitizeRoles(row.roles);
        const existing = await ctx.db
          .query("staffUsers")
          .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
          .unique();

        if (dryRun) {
          return {
            email: row.email,
            name: row.name,
            roles,
            action: existing ? ("updated" as const) : ("created" as const),
          };
        }

        const payload = {
          email: row.email.trim(),
          emailNormalized,
          name: row.name.trim(),
          roles: roles as (typeof ALL_ROLES)[number][],
          department: row.department?.trim() || "",
          function: row.function?.trim() || "",
          mobile: row.mobile?.trim() || "",
          location: row.location?.trim() || "",
          active: true,
          updatedAt: now,
        };

        if (existing) {
          await ctx.db.patch(existing._id, payload);
          return {
            email: row.email,
            name: row.name,
            roles,
            action: "updated" as const,
          };
        }

        const id = await ctx.db.insert("staffUsers", {
          ...payload,
          invitedBy: "bulk-import",
          pendingPasswordSetup: true,
          createdAt: now,
        });

        if (provisionAuth) {
          await ctx.scheduler.runAfter(0, internal.crm.staffAction.provisionStaffUser, {
            staffId: id,
            email: row.email.trim(),
            name: row.name.trim(),
          });
        }

        return {
          email: row.email,
          name: row.name,
          roles,
          action: "created" as const,
        };
      } catch (error) {
        return {
          email: row.email,
          name: row.name,
          roles: row.roles,
          action: "error" as const,
          message: error instanceof Error ? error.message : "Import failed",
        };
      }
    }),
  );

  const summary = {
    created: results.filter((row) => row.action === "created").length,
    updated: results.filter((row) => row.action === "updated").length,
    skipped: results.filter((row) => row.action === "skipped").length,
    errors: results.filter((row) => row.action === "error").length,
  };

  return { summary, results };
}

export const bulkImportStaff = internalMutation({
  args: {
    employees: v.array(staffRowValidator),
    dryRun: v.optional(v.boolean()),
    provisionAuth: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => importStaffRows(ctx, args),
});

export const importStaffFromSpreadsheet = mutation({
  args: {
    secret: v.string(),
    employees: v.array(staffRowValidator),
    dryRun: v.optional(v.boolean()),
    provisionAuth: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    return await importStaffRows(ctx, args);
  },
});
