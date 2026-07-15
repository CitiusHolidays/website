import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { ALL_ROLES, normalizeEmail, PERMISSIONS, requireStaff } from "./lib";
import { staffWorkbookResultValidator } from "./staffSettingsReturnContracts";

type StaffRole = (typeof ALL_ROLES)[number];
type StaffUser = Doc<"staffUsers">;
type WorkbookValue = string | number | boolean | string[];

type StaffWorkbookRow = {
  name: string;
  email: string;
  mobile?: string;
  jobRole?: string;
  departmentTeam?: string;
  location?: string;
  level1ApproverName?: string;
  escalationApproverName?: string;
  finalAuthorityName?: string;
  hrCopyName?: string;
  notes?: string;
  sourceSheet?: string;
  sourceRowNumber?: number;
};

type StaffWorkbookPatch = {
  email: string;
  emailNormalized: string;
  name: string;
  roles: StaffRole[];
  department: string;
  function: string;
  mobile: string;
  location: string;
  leaveLevel1ApproverName: string;
  leaveLevel1ApproverStaffId?: Id<"staffUsers">;
  leaveEscalationApproverName: string;
  leaveEscalationApproverStaffId?: Id<"staffUsers">;
  leaveFinalAuthorityName: string;
  leaveFinalAuthorityStaffId?: Id<"staffUsers">;
  leaveHrCopyName: string;
  leaveHrCopyStaffId?: Id<"staffUsers">;
  active: true;
};

type StaffWorkbookPreviewRow = {
  action: "created" | "updated" | "unchanged" | "skipped";
  staffId?: Id<"staffUsers">;
  email: string;
  emailNormalized: string;
  name: string;
  before: Record<string, WorkbookValue>;
  after: Record<string, WorkbookValue>;
  changes: Array<{ field: string; before: WorkbookValue; after: WorkbookValue }>;
  message?: string;
  sourceSheet?: string;
  sourceRowNumber?: number;
};

const validRoleSet = new Set<string>(ALL_ROLES);

const staffWorkbookRowValidator = v.object({
  departmentTeam: v.optional(v.string()),
  email: v.string(),
  escalationApproverName: v.optional(v.string()),
  finalAuthorityName: v.optional(v.string()),
  hrCopyName: v.optional(v.string()),
  jobRole: v.optional(v.string()),
  level1ApproverName: v.optional(v.string()),
  location: v.optional(v.string()),
  mobile: v.optional(v.string()),
  name: v.string(),
  notes: v.optional(v.string()),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.optional(v.string()),
});

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*&\s*/g, " & ")
    .trim();
}

function comparableText(value: unknown) {
  return cleanText(value).toLowerCase();
}

function canonicalStaffJobRole(value: unknown) {
  const cleaned = cleanText(value);
  const key = comparableText(cleaned);
  if (key.includes("finance") && (key.includes("head") || key.includes("hod"))) {
    return "Finance Head";
  }
  return cleaned;
}

function addRole(roles: Set<StaffRole>, role: StaffRole) {
  if (validRoleSet.has(role)) {
    roles.add(role);
  }
}

function inferRolesFromWorkbook(jobRole: string, departmentTeam: string): StaffRole[] {
  const text = `${jobRole} ${departmentTeam}`.toLowerCase();
  const roles = new Set<StaffRole>();

  if (/\bdirector\b/.test(text)) {
    addRole(roles, "Directors");
  }
  if (text.includes("sales")) {
    addRole(roles, "Sales");
  }
  if (text.includes("contracting")) {
    addRole(roles, "Contracting");
    if (text.includes("head") || text.includes("hod")) {
      addRole(roles, "Contracting Head");
    }
  }
  if (text.includes("operation") || text.includes("designing") || text.includes("visa")) {
    addRole(roles, "Operations");
    if (text.includes("head") || text.includes("hod")) {
      addRole(roles, "Operations Head");
    }
  }
  if (text.includes("ticketing")) {
    if (text.includes("head")) {
      addRole(roles, "Head of Ticketing");
    } else {
      addRole(roles, "Ticketing");
    }
  }
  if (text.includes("tour manager")) {
    addRole(roles, "Tour Manager");
  }
  if (text.includes("accounts") || text.includes("expense") || text.includes("job card")) {
    addRole(roles, "Accounts");
  }
  if (text.includes("finance")) {
    addRole(roles, "Finance");
  }
  if (text.includes("hr")) {
    addRole(roles, "HR");
  }

  if (text.includes("cement")) {
    if (roles.has("Sales")) {
      addRole(roles, "Sales Cement");
    }
    if (roles.has("Operations")) {
      addRole(roles, "Operations Cement");
    }
    if (roles.has("Directors")) {
      addRole(roles, "Director Cement");
    }
  }

  if (roles.size === 0) {
    addRole(roles, "Operations");
  }

  return ALL_ROLES.filter((role) => roles.has(role));
}

function nameKey(value: unknown) {
  return cleanText(value).toLowerCase();
}

function staffNameIndex(staffRows: StaffUser[]) {
  const index = new Map<string, StaffUser>();
  for (const staff of staffRows) {
    const key = nameKey(staff.name);
    if (key && !index.has(key)) {
      index.set(key, staff);
    }
  }
  return index;
}

function resolveApproverId(
  name: string,
  employee: { name: string; staffId?: Id<"staffUsers"> },
  staffByName: Map<string, StaffUser>
) {
  const key = nameKey(name);
  if (!key) {
    return;
  }
  if (key === "self") {
    return employee.staffId;
  }
  return staffByName.get(key)?._id;
}

function normalizeWorkbookPatch(
  row: StaffWorkbookRow,
  options: {
    staffByName: Map<string, StaffUser>;
    employee?: { name: string; staffId?: Id<"staffUsers"> };
  }
) {
  const email = cleanText(row.email);
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized?.includes("@")) {
    throw new ConvexError("Invalid staff email");
  }
  const name = cleanText(row.name);
  if (!name) {
    throw new ConvexError("Staff name is required");
  }

  const functionName = canonicalStaffJobRole(row.jobRole);
  const department = cleanText(row.departmentTeam);
  const employee = options.employee ?? { name };
  const level1Name = cleanText(row.level1ApproverName);
  const escalationName = cleanText(row.escalationApproverName);
  const finalAuthorityName = cleanText(row.finalAuthorityName);
  const hrCopyName = cleanText(row.hrCopyName);

  return {
    active: true as const,
    department,
    email,
    emailNormalized,
    function: functionName,
    leaveEscalationApproverName: escalationName,
    leaveEscalationApproverStaffId: resolveApproverId(
      escalationName,
      employee,
      options.staffByName
    ),
    leaveFinalAuthorityName: finalAuthorityName,
    leaveFinalAuthorityStaffId: resolveApproverId(
      finalAuthorityName,
      employee,
      options.staffByName
    ),
    leaveHrCopyName: hrCopyName,
    leaveHrCopyStaffId: resolveApproverId(hrCopyName, employee, options.staffByName),
    leaveLevel1ApproverName: level1Name,
    leaveLevel1ApproverStaffId: resolveApproverId(level1Name, employee, options.staffByName),
    location: cleanText(row.location),
    mobile: cleanText(row.mobile),
    name,
    roles: inferRolesFromWorkbook(functionName, department),
  };
}

const previewFields = [
  "email",
  "name",
  "roles",
  "department",
  "function",
  "mobile",
  "location",
  "leaveLevel1ApproverName",
  "leaveLevel1ApproverStaffId",
  "leaveEscalationApproverName",
  "leaveEscalationApproverStaffId",
  "leaveFinalAuthorityName",
  "leaveFinalAuthorityStaffId",
  "leaveHrCopyName",
  "leaveHrCopyStaffId",
] as const;

function comparableValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join("|");
  }
  return cleanText(value);
}

function buildChanges(existing: StaffUser | null, after: StaffWorkbookPatch) {
  const changes: StaffWorkbookPreviewRow["changes"] = [];
  for (const field of previewFields) {
    const before = existing ? (existing[field] ?? (Array.isArray(after[field]) ? [] : "")) : "";
    const afterValue = after[field] ?? "";
    if (comparableValue(before) === comparableValue(afterValue)) {
      continue;
    }
    changes.push({
      after: afterValue as WorkbookValue,
      before: before as WorkbookValue,
      field,
    });
  }
  return changes;
}

function previewAfter(patch: StaffWorkbookPatch) {
  return Object.fromEntries(previewFields.map((field) => [field, patch[field] ?? ""])) as Record<
    string,
    WorkbookValue
  >;
}

function summarize(rows: StaffWorkbookPreviewRow[]) {
  return {
    created: rows.filter((row) => row.action === "created").length,
    skipped: rows.filter((row) => row.action === "skipped").length,
    unchanged: rows.filter((row) => row.action === "unchanged").length,
    updated: rows.filter((row) => row.action === "updated").length,
  };
}

export async function buildStaffWorkbookPreviewForTest(
  ctx: QueryCtx | MutationCtx,
  rows: StaffWorkbookRow[]
) {
  const staffRows = (await ctx.db.query("staffUsers").collect()) as StaffUser[];
  const staffByEmail = new Map(staffRows.map((staff) => [staff.emailNormalized, staff]));
  const staffByName = staffNameIndex(staffRows);
  const workbookEmailCounts = rows.reduce((counts, row) => {
    const emailNormalized = normalizeEmail(row.email);
    if (emailNormalized) {
      counts.set(emailNormalized, (counts.get(emailNormalized) ?? 0) + 1);
    }
    return counts;
  }, new Map<string, number>());

  const previewRows: StaffWorkbookPreviewRow[] = rows.map((row) => {
    try {
      const emailNormalized = normalizeEmail(row.email);
      if (emailNormalized && (workbookEmailCounts.get(emailNormalized) ?? 0) > 1) {
        return {
          action: "skipped",
          after: {},
          before: {},
          changes: [],
          email: cleanText(row.email),
          emailNormalized,
          message: "Duplicate staff email in workbook; review before applying",
          name: cleanText(row.name),
          sourceRowNumber: row.sourceRowNumber,
          sourceSheet: row.sourceSheet,
        };
      }
      const existing = staffByEmail.get(emailNormalized) ?? null;
      const after = normalizeWorkbookPatch(row, {
        employee: { name: cleanText(row.name), staffId: existing?._id },
        staffByName,
      });
      const changes = buildChanges(existing, after);
      return {
        action: existing ? (changes.length > 0 ? "updated" : "unchanged") : "created",
        after: previewAfter(after),
        before: (existing ?? {}) as Record<string, WorkbookValue>,
        changes,
        email: after.email,
        emailNormalized: after.emailNormalized,
        name: after.name,
        sourceRowNumber: row.sourceRowNumber,
        sourceSheet: row.sourceSheet,
        staffId: existing?._id,
      };
    } catch (error) {
      return {
        action: "skipped",
        after: {},
        before: {},
        changes: [],
        email: row.email,
        emailNormalized: normalizeEmail(row.email),
        message: error instanceof Error ? error.message : "Invalid staff row",
        name: row.name,
        sourceRowNumber: row.sourceRowNumber,
        sourceSheet: row.sourceSheet,
      };
    }
  });

  return { rows: previewRows, summary: summarize(previewRows) };
}

function acceptedSet(values?: string[]) {
  if (!values || values.length === 0) {
    return null;
  }
  return new Set(
    values.flatMap((value) => {
      const normalized = normalizeEmail(value);
      return normalized ? [normalized] : [];
    })
  );
}

export async function applyStaffWorkbookRowsForTest(
  ctx: MutationCtx,
  args: { rows: StaffWorkbookRow[]; acceptedEmailNormalized?: string[]; now?: number }
) {
  const now = args.now ?? Date.now();
  const accepted = acceptedSet(args.acceptedEmailNormalized);
  const initialStaffRows = (await ctx.db.query("staffUsers").collect()) as StaffUser[];
  const initialByEmail = new Map(initialStaffRows.map((staff) => [staff.emailNormalized, staff]));
  const initialByName = staffNameIndex(initialStaffRows);
  const preview = await buildStaffWorkbookPreviewForTest(ctx, args.rows);
  const rowsToApply = args.rows.filter((row) => {
    const emailNormalized = normalizeEmail(row.email);
    if (!emailNormalized) {
      return false;
    }
    if (accepted && !accepted.has(emailNormalized)) {
      return false;
    }
    return !preview.rows.some(
      (previewRow) =>
        previewRow.emailNormalized === emailNormalized && previewRow.action === "skipped"
    );
  });

  const applied = await Promise.all(
    rowsToApply.map(async (row) => {
      const emailNormalized = normalizeEmail(row.email);
      const existing = initialByEmail.get(emailNormalized) ?? null;
      const patch = normalizeWorkbookPatch(row, {
        employee: { name: cleanText(row.name), staffId: existing?._id },
        staffByName: initialByName,
      });
      const changes = buildChanges(existing, patch);

      if (existing) {
        if (changes.length > 0) {
          await ctx.db.patch(existing._id, {
            ...patch,
            updatedAt: now,
          });
        }
        return {
          action: changes.length > 0 ? "updated" : "unchanged",
          after: previewAfter(patch),
          before: existing as Record<string, WorkbookValue>,
          changes,
          email: patch.email,
          emailNormalized: patch.emailNormalized,
          name: patch.name,
          sourceRowNumber: row.sourceRowNumber,
          sourceSheet: row.sourceSheet,
          staffId: existing._id,
        } satisfies StaffWorkbookPreviewRow;
      }

      const id = await ctx.db.insert("staffUsers", {
        ...patch,
        createdAt: now,
        invitedBy: "staff-workbook",
        pendingPasswordSetup: true,
        updatedAt: now,
      });
      return {
        action: "created",
        after: previewAfter(patch),
        before: {},
        changes,
        email: patch.email,
        emailNormalized: patch.emailNormalized,
        name: patch.name,
        sourceRowNumber: row.sourceRowNumber,
        sourceSheet: row.sourceSheet,
        staffId: id,
      } satisfies StaffWorkbookPreviewRow;
    })
  );

  const resolvedStaffRows = (await ctx.db.query("staffUsers").collect()) as StaffUser[];
  const resolvedByEmail = new Map(resolvedStaffRows.map((staff) => [staff.emailNormalized, staff]));
  const resolvedByName = staffNameIndex(resolvedStaffRows);

  await Promise.all(
    rowsToApply.map(async (row) => {
      const staff = resolvedByEmail.get(normalizeEmail(row.email));
      if (!staff) {
        return;
      }
      const resolved = normalizeWorkbookPatch(row, {
        employee: { name: staff.name, staffId: staff._id },
        staffByName: resolvedByName,
      });
      await ctx.db.patch(staff._id, {
        leaveEscalationApproverStaffId: resolved.leaveEscalationApproverStaffId ?? undefined,
        leaveFinalAuthorityStaffId: resolved.leaveFinalAuthorityStaffId ?? undefined,
        leaveHrCopyStaffId: resolved.leaveHrCopyStaffId ?? undefined,
        leaveLevel1ApproverStaffId: resolved.leaveLevel1ApproverStaffId ?? undefined,
        updatedAt: now,
      });
    })
  );

  return { rows: applied, summary: summarize(applied) };
}

export function resolveFinanceHeadStaff<T extends { active?: boolean; function?: string }>(
  staffRows: T[]
): T | null {
  return (
    staffRows.find(
      (staff) =>
        staff.active !== false &&
        comparableText(canonicalStaffJobRole(staff.function)) === "finance head"
    ) ?? null
  );
}

export const previewStaffWorkbookUpdates = query({
  args: { rows: v.array(staffWorkbookRowValidator) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    return buildStaffWorkbookPreviewForTest(ctx, args.rows);
  },
  returns: staffWorkbookResultValidator,
});

export const applyStaffWorkbookUpdates = mutation({
  args: {
    acceptedEmailNormalized: v.optional(v.array(v.string())),
    rows: v.array(staffWorkbookRowValidator),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    return applyStaffWorkbookRowsForTest(ctx, args);
  },
  returns: staffWorkbookResultValidator,
});
