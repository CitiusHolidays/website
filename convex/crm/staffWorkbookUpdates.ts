import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { ALL_ROLES, normalizeEmail, PERMISSIONS, requireStaff } from "./lib";

type StaffRole = (typeof ALL_ROLES)[number];
type StaffUser = Doc<"staffUsers">;

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
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changes: Array<{ field: string; before: unknown; after: unknown }>;
  message?: string;
  sourceSheet?: string;
  sourceRowNumber?: number;
};

const validRoleSet = new Set<string>(ALL_ROLES);

const staffWorkbookRowValidator = v.object({
  name: v.string(),
  email: v.string(),
  mobile: v.optional(v.string()),
  jobRole: v.optional(v.string()),
  departmentTeam: v.optional(v.string()),
  location: v.optional(v.string()),
  level1ApproverName: v.optional(v.string()),
  escalationApproverName: v.optional(v.string()),
  finalAuthorityName: v.optional(v.string()),
  hrCopyName: v.optional(v.string()),
  notes: v.optional(v.string()),
  sourceSheet: v.optional(v.string()),
  sourceRowNumber: v.optional(v.number()),
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

  if (/\bdirector\b/.test(text)) addRole(roles, "Directors");
  if (text.includes("sales")) addRole(roles, "Sales");
  if (text.includes("contracting")) {
    addRole(roles, "Contracting");
    if (text.includes("head") || text.includes("hod")) addRole(roles, "Contracting Head");
  }
  if (text.includes("operation") || text.includes("designing") || text.includes("visa")) {
    addRole(roles, "Operations");
    if (text.includes("head") || text.includes("hod")) addRole(roles, "Operations Head");
  }
  if (text.includes("ticketing")) {
    if (text.includes("head")) addRole(roles, "Head of Ticketing");
    else addRole(roles, "Ticketing");
  }
  if (text.includes("tour manager")) addRole(roles, "Tour Manager");
  if (text.includes("accounts") || text.includes("expense") || text.includes("job card")) {
    addRole(roles, "Accounts");
  }
  if (text.includes("finance")) addRole(roles, "Finance");
  if (text.includes("hr")) addRole(roles, "HR");

  if (text.includes("cement")) {
    if (roles.has("Sales")) addRole(roles, "Sales Cement");
    if (roles.has("Operations")) addRole(roles, "Operations Cement");
    if (roles.has("Directors")) addRole(roles, "Director Cement");
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
    if (key && !index.has(key)) index.set(key, staff);
  }
  return index;
}

function resolveApproverId(
  name: string,
  employee: { name: string; staffId?: Id<"staffUsers"> },
  staffByName: Map<string, StaffUser>,
) {
  const key = nameKey(name);
  if (!key) return undefined;
  if (key === "self") return employee.staffId;
  return staffByName.get(key)?._id;
}

function normalizeWorkbookPatch(
  row: StaffWorkbookRow,
  options: {
    staffByName: Map<string, StaffUser>;
    employee?: { name: string; staffId?: Id<"staffUsers"> };
  },
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
    email,
    emailNormalized,
    name,
    roles: inferRolesFromWorkbook(functionName, department),
    department,
    function: functionName,
    mobile: cleanText(row.mobile),
    location: cleanText(row.location),
    leaveLevel1ApproverName: level1Name,
    leaveLevel1ApproverStaffId: resolveApproverId(level1Name, employee, options.staffByName),
    leaveEscalationApproverName: escalationName,
    leaveEscalationApproverStaffId: resolveApproverId(
      escalationName,
      employee,
      options.staffByName,
    ),
    leaveFinalAuthorityName: finalAuthorityName,
    leaveFinalAuthorityStaffId: resolveApproverId(
      finalAuthorityName,
      employee,
      options.staffByName,
    ),
    leaveHrCopyName: hrCopyName,
    leaveHrCopyStaffId: resolveApproverId(hrCopyName, employee, options.staffByName),
    active: true as const,
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
  if (Array.isArray(value)) return value.join("|");
  return cleanText(value);
}

function buildChanges(existing: StaffUser | null, after: StaffWorkbookPatch) {
  return previewFields
    .map((field) => ({
      field,
      before: existing ? (existing[field] ?? (Array.isArray(after[field]) ? [] : "")) : "",
      after: after[field] ?? "",
    }))
    .filter((change) => comparableValue(change.before) !== comparableValue(change.after));
}

function previewAfter(patch: StaffWorkbookPatch) {
  return Object.fromEntries(previewFields.map((field) => [field, patch[field] ?? ""]));
}

function summarize(rows: StaffWorkbookPreviewRow[]) {
  return {
    created: rows.filter((row) => row.action === "created").length,
    updated: rows.filter((row) => row.action === "updated").length,
    unchanged: rows.filter((row) => row.action === "unchanged").length,
    skipped: rows.filter((row) => row.action === "skipped").length,
  };
}

export async function buildStaffWorkbookPreviewForTest(
  ctx: QueryCtx | MutationCtx,
  rows: StaffWorkbookRow[],
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
          email: cleanText(row.email),
          emailNormalized,
          name: cleanText(row.name),
          before: {},
          after: {},
          changes: [],
          message: "Duplicate staff email in workbook; review before applying",
          sourceSheet: row.sourceSheet,
          sourceRowNumber: row.sourceRowNumber,
        };
      }
      const existing = staffByEmail.get(emailNormalized) ?? null;
      const after = normalizeWorkbookPatch(row, {
        staffByName,
        employee: { name: cleanText(row.name), staffId: existing?._id },
      });
      const changes = buildChanges(existing, after);
      return {
        action: existing ? (changes.length > 0 ? "updated" : "unchanged") : "created",
        staffId: existing?._id,
        email: after.email,
        emailNormalized: after.emailNormalized,
        name: after.name,
        before: existing ?? {},
        after: previewAfter(after),
        changes,
        sourceSheet: row.sourceSheet,
        sourceRowNumber: row.sourceRowNumber,
      };
    } catch (error) {
      return {
        action: "skipped",
        email: row.email,
        emailNormalized: normalizeEmail(row.email),
        name: row.name,
        before: {},
        after: {},
        changes: [],
        message: error instanceof Error ? error.message : "Invalid staff row",
        sourceSheet: row.sourceSheet,
        sourceRowNumber: row.sourceRowNumber,
      };
    }
  });

  return { summary: summarize(previewRows), rows: previewRows };
}

function acceptedSet(values?: string[]) {
  if (!values || values.length === 0) return null;
  return new Set(values.map((value) => normalizeEmail(value)).filter(Boolean));
}

export async function applyStaffWorkbookRowsForTest(
  ctx: MutationCtx,
  args: { rows: StaffWorkbookRow[]; acceptedEmailNormalized?: string[]; now?: number },
) {
  const now = args.now ?? Date.now();
  const accepted = acceptedSet(args.acceptedEmailNormalized);
  const initialStaffRows = (await ctx.db.query("staffUsers").collect()) as StaffUser[];
  const initialByEmail = new Map(initialStaffRows.map((staff) => [staff.emailNormalized, staff]));
  const initialByName = staffNameIndex(initialStaffRows);
  const preview = await buildStaffWorkbookPreviewForTest(ctx, args.rows);
  const rowsToApply = args.rows.filter((row) => {
    const emailNormalized = normalizeEmail(row.email);
    if (!emailNormalized) return false;
    if (accepted && !accepted.has(emailNormalized)) return false;
    return !preview.rows.some(
      (previewRow) =>
        previewRow.emailNormalized === emailNormalized && previewRow.action === "skipped",
    );
  });

  const applied: StaffWorkbookPreviewRow[] = [];
  for (const row of rowsToApply) {
    const emailNormalized = normalizeEmail(row.email);
    const existing = initialByEmail.get(emailNormalized) ?? null;
    const patch = normalizeWorkbookPatch(row, {
      staffByName: initialByName,
      employee: { name: cleanText(row.name), staffId: existing?._id },
    });
    const changes = buildChanges(existing, patch);

    if (existing) {
      if (changes.length > 0) {
        await ctx.db.patch(existing._id, {
          ...patch,
          updatedAt: now,
        });
      }
      applied.push({
        action: changes.length > 0 ? "updated" : "unchanged",
        staffId: existing._id,
        email: patch.email,
        emailNormalized: patch.emailNormalized,
        name: patch.name,
        before: existing,
        after: previewAfter(patch),
        changes,
        sourceSheet: row.sourceSheet,
        sourceRowNumber: row.sourceRowNumber,
      });
      continue;
    }

    const id = await ctx.db.insert("staffUsers", {
      ...patch,
      invitedBy: "staff-workbook",
      pendingPasswordSetup: true,
      createdAt: now,
      updatedAt: now,
    });
    applied.push({
      action: "created",
      staffId: id,
      email: patch.email,
      emailNormalized: patch.emailNormalized,
      name: patch.name,
      before: {},
      after: previewAfter(patch),
      changes,
      sourceSheet: row.sourceSheet,
      sourceRowNumber: row.sourceRowNumber,
    });
  }

  const resolvedStaffRows = (await ctx.db.query("staffUsers").collect()) as StaffUser[];
  const resolvedByEmail = new Map(resolvedStaffRows.map((staff) => [staff.emailNormalized, staff]));
  const resolvedByName = staffNameIndex(resolvedStaffRows);

  for (const row of rowsToApply) {
    const staff = resolvedByEmail.get(normalizeEmail(row.email));
    if (!staff) continue;
    const resolved = normalizeWorkbookPatch(row, {
      staffByName: resolvedByName,
      employee: { name: staff.name, staffId: staff._id },
    });
    await ctx.db.patch(staff._id, {
      leaveLevel1ApproverStaffId: resolved.leaveLevel1ApproverStaffId ?? undefined,
      leaveEscalationApproverStaffId: resolved.leaveEscalationApproverStaffId ?? undefined,
      leaveFinalAuthorityStaffId: resolved.leaveFinalAuthorityStaffId ?? undefined,
      leaveHrCopyStaffId: resolved.leaveHrCopyStaffId ?? undefined,
      updatedAt: now,
    });
  }

  return { summary: summarize(applied), rows: applied };
}

export function resolveFinanceHeadStaff<T extends { active?: boolean; function?: string }>(
  staffRows: T[],
): T | null {
  return (
    staffRows.find(
      (staff) =>
        staff.active !== false &&
        comparableText(canonicalStaffJobRole(staff.function)) === "finance head",
    ) ?? null
  );
}

export const previewStaffWorkbookUpdates = query({
  args: { rows: v.array(staffWorkbookRowValidator) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    return buildStaffWorkbookPreviewForTest(ctx, args.rows);
  },
});

export const applyStaffWorkbookUpdates = mutation({
  args: {
    rows: v.array(staffWorkbookRowValidator),
    acceptedEmailNormalized: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    return applyStaffWorkbookRowsForTest(ctx, args);
  },
});
