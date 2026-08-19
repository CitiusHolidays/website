import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, mutation } from "../_generated/server";
import { isStaffRole, normalizeEmail, type StaffRole } from "./lib";
import { staffImportResultValidator } from "./staffSettingsReturnContracts";

const assertMigrationSecret = (secret: string) => {
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError("Invalid migration secret");
  }
};

const EMAIL_MARKER_PATTERN = /@/;

const sanitizeRoles = (roles: string[]): StaffRole[] => {
  const clean = Array.from(new Set(roles.filter(isStaffRole)));
  if (clean.length === 0) {
    throw new ConvexError("At least one valid role is required");
  }
  return clean;
};

const staffRowValidator = v.object({
  confirmationDate: v.optional(v.string()),
  department: v.optional(v.string()),
  email: v.string(),
  employmentStatus: v.optional(v.union(v.literal("Probationer"), v.literal("Confirmed"))),
  function: v.optional(v.string()),
  joiningDate: v.optional(v.string()),
  leavePolicyGroup: v.optional(v.string()),
  location: v.optional(v.string()),
  mobile: v.optional(v.string()),
  name: v.string(),
  reportingManagerName: v.optional(v.string()),
  roles: v.array(v.string()),
});

interface StaffImportRow {
  confirmationDate?: string;
  department?: string;
  email: string;
  employmentStatus?: "Confirmed" | "Probationer";
  function?: string;
  joiningDate?: string;
  leavePolicyGroup?: string;
  location?: string;
  mobile?: string;
  name: string;
  reportingManagerName?: string;
  roles: string[];
}

async function importStaffRow(
  ctx: MutationCtx,
  row: StaffImportRow,
  options: { dryRun: boolean; now: number; provisionAuth: boolean }
) {
  const emailNormalized = normalizeEmail(row.email);
  if (!(emailNormalized && EMAIL_MARKER_PATTERN.test(emailNormalized))) {
    return {
      action: "skipped" as const,
      email: row.email,
      message: "Invalid email",
      name: row.name,
      roles: row.roles,
    };
  }
  try {
    const roles = sanitizeRoles(row.roles);
    const existing = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
      .unique();
    if (options.dryRun) {
      return {
        action: existing ? ("updated" as const) : ("created" as const),
        email: row.email,
        name: row.name,
        roles,
      };
    }
    const payload = {
      active: true,
      confirmationDate: row.confirmationDate || "",
      department: row.department?.trim() || "",
      email: row.email.trim(),
      emailNormalized,
      employmentStatus: row.employmentStatus ?? "Confirmed",
      function: row.function?.trim() || "",
      joiningDate: row.joiningDate || "",
      leavePolicyGroup: row.leavePolicyGroup?.trim() || "",
      location: row.location?.trim() || "",
      mobile: row.mobile?.trim() || "",
      name: row.name.trim(),
      reportingManagerName: row.reportingManagerName?.trim() || "",
      roles,
      updatedAt: options.now,
    };
    if (existing) {
      await ctx.db.patch("staffUsers", existing._id, payload);
      return { action: "updated" as const, email: row.email, name: row.name, roles };
    }
    const id = await ctx.db.insert("staffUsers", {
      ...payload,
      createdAt: options.now,
      invitedBy: "bulk-import",
      pendingPasswordSetup: true,
    });
    if (options.provisionAuth) {
      await ctx.scheduler.runAfter(0, internal.crm.staffAction.provisionStaffUser, {
        email: row.email.trim(),
        name: row.name.trim(),
        staffId: id,
      });
    }
    return { action: "created" as const, email: row.email, name: row.name, roles };
  } catch (error) {
    return {
      action: "error" as const,
      email: row.email,
      message: error instanceof Error ? error.message : "Import failed",
      name: row.name,
      roles: row.roles,
    };
  }
}

async function importStaffRows(
  ctx: MutationCtx,
  args: {
    employees: StaffImportRow[];
    dryRun?: boolean;
    provisionAuth?: boolean;
  }
) {
  const dryRun = args.dryRun ?? false;
  const provisionAuth = args.provisionAuth ?? false;
  const now = Date.now();
  const results = await Promise.all(
    args.employees.map((row) => importStaffRow(ctx, row, { dryRun, now, provisionAuth }))
  );

  const summary = {
    created: results.filter((row) => row.action === "created").length,
    errors: results.filter((row) => row.action === "error").length,
    skipped: results.filter((row) => row.action === "skipped").length,
    updated: results.filter((row) => row.action === "updated").length,
  };

  if (!dryRun) {
    const staffRows = await ctx.db.query("staffUsers").collect();
    const staffByName = new Map(staffRows.map((staff) => [staff.name.trim().toLowerCase(), staff]));
    await Promise.all(
      staffRows.flatMap((staff) => {
        const managerName = staff.reportingManagerName?.trim();
        if (!managerName || staff.reportingManagerStaffId) {
          return [];
        }
        const manager = staffByName.get(managerName.toLowerCase());
        if (!manager || manager._id === staff._id) {
          return [];
        }
        return [
          ctx.db.patch("staffUsers", staff._id, {
            reportingManagerName: manager.name,
            reportingManagerStaffId: manager._id,
            updatedAt: now,
          }),
        ];
      })
    );
  }

  return { results, summary };
}

export const bulkImportStaff = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    employees: v.array(staffRowValidator),
    provisionAuth: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => importStaffRows(ctx, args),
  returns: staffImportResultValidator,
});

export const importStaffFromSpreadsheet = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    employees: v.array(staffRowValidator),
    provisionAuth: v.optional(v.boolean()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    return await importStaffRows(ctx, args);
  },
  returns: staffImportResultValidator,
});
