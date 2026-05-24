import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const PERMISSIONS = {
  VIEW_DASHBOARD: "view:dashboard",
  MANAGE_STAFF: "manage:staff",
  MANAGE_DROPDOWNS: "manage:dropdowns",
  VIEW_QUERIES: "view:queries",
  MANAGE_QUERIES: "manage:queries",
  VIEW_CONTRACTING: "view:contracting",
  MANAGE_CONTRACTING: "manage:contracting",
  VIEW_PROPOSALS: "view:proposals",
  MANAGE_PROPOSALS: "manage:proposals",
  SEND_PROPOSALS: "send:proposals",
  VIEW_JOB_CARDS: "view:jobCards",
  MANAGE_JOB_CARDS: "manage:jobCards",
  VIEW_TRAVELLERS: "view:travellers",
  MANAGE_TRAVELLERS: "manage:travellers",
  VIEW_VISA: "view:visa",
  MANAGE_VISA: "manage:visa",
  VIEW_TICKETING: "view:ticketing",
  MANAGE_TICKETING: "manage:ticketing",
  VIEW_OPERATIONS: "view:operations",
  MANAGE_OPERATIONS: "manage:operations",
  VIEW_TOUR_MANAGERS: "view:tourManagers",
  MANAGE_TOUR_MANAGERS: "manage:tourManagers",
  VIEW_FINANCE: "view:finance",
  MANAGE_FINANCE: "manage:finance",
  VIEW_EXPENSES: "view:expenses",
  MANAGE_EXPENSES: "manage:expenses",
  APPROVE_EXPENSES: "approve:expenses",
  VIEW_TEAM: "view:team",
  VIEW_LEAVE: "view:leave",
  MANAGE_LEAVE: "manage:leave",
  APPROVE_LEAVE: "approve:leave",
  VIEW_APPROVALS: "view:approvals",
  VIEW_REPORTS: "view:reports",
  VIEW_ACTIVITY: "view:activity",
  VIEW_SENSITIVE_TRAVELLER_DATA: "view:sensitiveTravellerData",
  REQUEST_LEAVE: "request:leave",
};

export const ALL_ROLES = [
  "Admin",
  "Directors",
  "Sales",
  "Sales Head",
  "Contracting",
  "Contracting Head",
  "Accounts",
  "Operations",
  "Operations Head",
  "Ticketing",
  "Head of Ticketing",
  "Tour Manager",
  "Finance",
  "HR",
] as const;

const P = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: Object.values(P),
  Directors: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_VISA,
    P.VIEW_TICKETING,
    P.VIEW_OPERATIONS,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_FINANCE,
    P.VIEW_EXPENSES,
    P.APPROVE_EXPENSES,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
    P.VIEW_APPROVALS,
    P.VIEW_REPORTS,
    P.VIEW_SENSITIVE_TRAVELLER_DATA,
  ],
  "Sales Head": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.SEND_PROPOSALS,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
  ],
  Sales: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.SEND_PROPOSALS,
    P.VIEW_LEAVE,
  ],
  "Contracting Head": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.MANAGE_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.MANAGE_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
  ],
  Contracting: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.MANAGE_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.MANAGE_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_LEAVE,
  ],
  Accounts: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.MANAGE_JOB_CARDS,
    P.VIEW_FINANCE,
    P.MANAGE_FINANCE,
    P.VIEW_EXPENSES,
    P.VIEW_LEAVE,
    P.VIEW_REPORTS,
  ],
  "Operations Head": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.MANAGE_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.MANAGE_TRAVELLERS,
    P.VIEW_VISA,
    P.MANAGE_VISA,
    P.VIEW_OPERATIONS,
    P.MANAGE_OPERATIONS,
    P.VIEW_TOUR_MANAGERS,
    P.MANAGE_TOUR_MANAGERS,
    P.VIEW_TICKETING,
    P.VIEW_EXPENSES,
    P.VIEW_FINANCE,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
    P.VIEW_SENSITIVE_TRAVELLER_DATA,
  ],
  Operations: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.MANAGE_TRAVELLERS,
    P.VIEW_VISA,
    P.MANAGE_VISA,
    P.VIEW_OPERATIONS,
    P.MANAGE_OPERATIONS,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_TICKETING,
    P.VIEW_EXPENSES,
    P.VIEW_LEAVE,
  ],
  "Head of Ticketing": [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_TICKETING,
    P.MANAGE_TICKETING,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.APPROVE_LEAVE,
  ],
  Ticketing: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_TICKETING,
    P.MANAGE_TICKETING,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_LEAVE,
  ],
  "Tour Manager": [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_VISA,
    P.VIEW_TICKETING,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_EXPENSES,
    P.MANAGE_EXPENSES,
    P.VIEW_LEAVE,
  ],
  Finance: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_FINANCE,
    P.MANAGE_FINANCE,
    P.VIEW_EXPENSES,
    P.APPROVE_EXPENSES,
    P.VIEW_LEAVE,
    P.VIEW_APPROVALS,
    P.VIEW_REPORTS,
  ],
  HR: [
    P.VIEW_DASHBOARD,
    P.MANAGE_STAFF,
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.MANAGE_LEAVE,
    P.APPROVE_LEAVE,
    P.VIEW_APPROVALS,
  ],
};

export const PAYMENT_TERMS: Record<string, { min: number; max: number }> = {
  MICE: { min: 70, max: 90 },
  "MICE Bidding": { min: 70, max: 90 },
  Cement: { min: 70, max: 90 },
  "Cement Bidding": { min: 70, max: 100 },
  FIT: { min: 90, max: 100 },
  "Family Group": { min: 90, max: 100 },
  B2B: { min: 80, max: 100 },
  Spiritual: { min: 100, max: 100 },
};

export function normalizeEmail(email?: string | null) {
  return String(email ?? "").trim().toLowerCase();
}

export function getRolePermissions(roles: string[]) {
  const permissions = new Set<string>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      permissions.add(permission);
    }
  }
  if (roles.length > 0) {
    permissions.add(P.REQUEST_LEAVE);
  }
  return Array.from(permissions).sort();
}

export type PortalAccess = {
  allowed: boolean;
  reason?: "UNAUTHENTICATED" | "NOT_STAFF";
  staffId?: Id<"staffUsers">;
  bootstrap?: boolean;
  authUserId?: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
};

function getBootstrapAdminEmails() {
  return (process.env.PORTAL_BOOTSTRAP_ADMINS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function isBootstrapAdmin(email: string) {
  return getBootstrapAdminEmails().includes(normalizeEmail(email));
}

async function resolveActiveStaff(
  ctx: QueryCtx | MutationCtx,
  identity: { subject: string; email?: string | null; name?: string | null },
) {
  if (identity.subject) {
    const byAuth = await ctx.db
      .query("staffUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
      .unique();
    if (byAuth?.active) {
      return byAuth;
    }
  }

  const email = normalizeEmail(identity.email);
  if (email) {
    const byEmail = await ctx.db
      .query("staffUsers")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", email))
      .unique();
    if (byEmail?.active) {
      return byEmail;
    }
  }

  return null;
}

export async function getPortalAccess(ctx: QueryCtx | MutationCtx): Promise<PortalAccess> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return {
      allowed: false,
      reason: "UNAUTHENTICATED",
      email: "",
      name: "",
      roles: [],
      permissions: [],
    };
  }

  const email = normalizeEmail(identity.email);
  const staff = await resolveActiveStaff(ctx, identity);

  if (staff) {
    const permissions = getRolePermissions(staff.roles);
    return {
      allowed: true,
      staffId: staff._id,
      bootstrap: false,
      authUserId: identity.subject,
      email: staff.email,
      name: staff.name || identity.name || staff.email,
      roles: staff.roles,
      permissions,
    };
  }

  if (email && isBootstrapAdmin(email)) {
    return {
      allowed: true,
      bootstrap: true,
      authUserId: identity.subject,
      email,
      name: identity.name || email,
      roles: ["Admin"],
      permissions: getRolePermissions(["Admin"]),
    };
  }

  return {
    allowed: false,
    reason: "NOT_STAFF",
    authUserId: identity.subject,
    email,
    name: identity.name || email,
    roles: [],
    permissions: [],
  };
}

export async function requireStaff(
  ctx: QueryCtx | MutationCtx,
  permission?: string,
) {
  const access = await getPortalAccess(ctx);
  if (!access.allowed) {
    throw new ConvexError("FORBIDDEN");
  }
  if (permission && !access.permissions.includes(permission)) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

export async function requireAnyPermission(
  ctx: QueryCtx | MutationCtx,
  permissions: string[],
) {
  const access = await requireStaff(ctx);
  if (!permissions.some((permission) => access.permissions.includes(permission))) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

export function hasRole(access: PortalAccess, role: string) {
  return access.roles.includes(role);
}

export function isAdmin(access: PortalAccess) {
  return hasRole(access, "Admin");
}

export function isDirectorOrAdmin(access: PortalAccess) {
  return isAdmin(access) || hasRole(access, "Directors");
}

export const HEAD_ROLES = [
  "Sales Head",
  "Contracting Head",
  "Operations Head",
  "Head of Ticketing",
  "HR",
] as const;

export function isHead(access: PortalAccess) {
  return HEAD_ROLES.some((role) => hasRole(access, role));
}

export function canSeeAllPortalRecords(access: PortalAccess) {
  return isDirectorOrAdmin(access);
}

export function canSeeDepartmentRecords(access: PortalAccess, headRoles: string[] = []) {
  return canSeeAllPortalRecords(access) || headRoles.some((role) => hasRole(access, role));
}

export function ownsAuthRecord(access: PortalAccess, ownerId?: string | null) {
  return Boolean(ownerId && access.authUserId && ownerId === access.authUserId);
}

export function ownsStaffRecord(access: PortalAccess, ownerId?: string | null) {
  return Boolean(ownerId && access.staffId && ownerId === access.staffId);
}

export function ownsNamedRecord(access: PortalAccess, ownerName?: string | null) {
  return Boolean(ownerName && ownerName.trim().toLowerCase() === access.name.trim().toLowerCase());
}

export function canSeeQueryRecord(access: PortalAccess, query: any) {
  if (canSeeDepartmentRecords(access, ["Sales Head", "Contracting Head", "Operations Head"])) {
    return true;
  }
  if (
    (hasRole(access, "Accounts") || hasRole(access, "Finance")) &&
    (query.salesStatus === "Order Confirmed" || query.contractingStatus === "Order Confirmed")
  ) {
    return true;
  }
  return (
    ownsAuthRecord(access, query.createdBy) ||
    ownsAuthRecord(access, query.salesOwnerId) ||
    ownsStaffRecord(access, query.contractingOwnerId) ||
    ownsNamedRecord(access, query.salesOwnerName) ||
    ownsNamedRecord(access, query.contractingOwnerName)
  );
}

export function canSeeProposalRecord(access: PortalAccess, proposal: any, linkedQuery?: any) {
  if (canSeeDepartmentRecords(access, ["Sales Head", "Contracting Head", "Operations Head"])) {
    return true;
  }
  return (
    ownsAuthRecord(access, proposal.createdBy) ||
    ownsNamedRecord(access, proposal.preparedBy) ||
    (linkedQuery ? canSeeQueryRecord(access, linkedQuery) : false)
  );
}

export function canSeeJobCardRecord(access: PortalAccess, job: any, linkedQuery?: any) {
  if (
    canSeeDepartmentRecords(access, [
      "Contracting Head",
      "Operations Head",
      "Head of Ticketing",
    ]) ||
    hasRole(access, "Accounts") ||
    hasRole(access, "Finance")
  ) {
    return true;
  }
  return (
    ownsAuthRecord(access, job.createdBy) ||
    ownsStaffRecord(access, job.contractingOwnerId) ||
    ownsStaffRecord(access, job.operationsOwnerId) ||
    ownsStaffRecord(access, job.ticketingOwnerId) ||
    ownsNamedRecord(access, job.contractingOwnerName) ||
    ownsNamedRecord(access, job.operationsOwnerName) ||
    ownsNamedRecord(access, job.ticketingOwnerName) ||
    ownsNamedRecord(access, job.tourManagerName) ||
    (linkedQuery ? canSeeQueryRecord(access, linkedQuery) : false)
  );
}

export function getHeadReviewerRolesForStaff(staff: { roles?: string[]; department?: string }) {
  const roles = new Set(staff.roles ?? []);
  const department = (staff.department ?? "").toLowerCase();
  const reviewerRoles: string[] = [];
  if (roles.has("Sales") || department.includes("sales")) reviewerRoles.push("Sales Head");
  if (roles.has("Contracting") || department.includes("contracting")) reviewerRoles.push("Contracting Head");
  if (
    roles.has("Operations") ||
    roles.has("Tour Manager") ||
    department.includes("operation") ||
    department.includes("tour")
  ) {
    reviewerRoles.push("Operations Head");
  }
  if (roles.has("Ticketing") || department.includes("ticket")) reviewerRoles.push("Head of Ticketing");
  return Array.from(new Set(reviewerRoles.length > 0 ? reviewerRoles : ["HR"]));
}

export function isHrReviewer(access: PortalAccess) {
  return (
    isDirectorOrAdmin(access) ||
    hasRole(access, "HR") ||
    access.permissions.includes(PERMISSIONS.MANAGE_LEAVE)
  );
}

export function canHeadReview(access: PortalAccess, reviewerRole: string) {
  return isDirectorOrAdmin(access) || hasRole(access, reviewerRole);
}

export function canActAsLeaveHeadReviewer(
  access: PortalAccess,
  reviewerRole: string,
) {
  if (reviewerRole === "HR") {
    return isHrReviewer(access);
  }
  return canHeadReview(access, reviewerRole);
}

export function getLeaveApprovalActions(
  access: PortalAccess,
  leave: {
    status?: string;
    headReviewStatus?: string;
    hrReviewStatus?: string;
    headReviewerRole?: string;
  },
  staff: { roles?: string[]; department?: string },
) {
  const status = leave.status ?? "Pending";
  const headStatus = leave.headReviewStatus ?? "Pending";
  const hrStatus = leave.hrReviewStatus ?? "Pending";
  const reviewerRole =
    leave.headReviewerRole ?? getHeadReviewerRolesForStaff(staff)[0] ?? "HR";

  if (status !== "Pending") {
    return { canApproveHead: false, canApproveHr: false, canReject: false };
  }

  const canHead = canActAsLeaveHeadReviewer(access, reviewerRole);
  const canHr = isHrReviewer(access);

  if (headStatus === "Pending") {
    return {
      canApproveHead: canHead,
      canApproveHr: false,
      canReject: canHead,
    };
  }

  if (headStatus === "Approved" && hrStatus === "Pending") {
    return {
      canApproveHead: false,
      canApproveHr: canHr,
      canReject: canHr,
    };
  }

  return { canApproveHead: false, canApproveHr: false, canReject: false };
}

export async function requireHeadOrAdmin(
  ctx: QueryCtx | MutationCtx,
  headRoles: string[],
) {
  const access = await requireStaff(ctx);
  if (isDirectorOrAdmin(access)) {
    return access;
  }
  if (!headRoles.some((role) => hasRole(access, role))) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

export async function createActivity(
  ctx: MutationCtx,
  access: Awaited<ReturnType<typeof getPortalAccess>>,
  input: {
    entityType: string;
    entityId?: string;
    action: string;
    message: string;
    metadata?: unknown;
  },
) {
  await ctx.db.insert("activityLogs", {
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    message: input.message,
    actorId: access.authUserId ?? "system",
    actorName: access.name || access.email || "System",
    metadata: input.metadata ?? null,
    createdAt: Date.now(),
  });
}

export async function notifyRoles(
  ctx: MutationCtx,
  roles: string[],
  input: {
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
  },
) {
  const createdAt = Date.now();
  for (const role of roles) {
    await ctx.db.insert("notifications", {
      recipientRole: role as any,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
      createdAt,
    });
  }
}

const CODE_FIELD_BY_TABLE: Record<string, string> = {
  jobCards: "jobCode",
  queries: "queryCode",
  proposals: "proposalCode",
  approvalRequests: "requestCode",
};

export function creatorInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase().padEnd(2, "X");
  }
  return "XX";
}

export async function nextCode(
  ctx: QueryCtx | MutationCtx,
  tableName: any,
  prefix: string,
  options?: { suffix?: string },
) {
  const codeField = CODE_FIELD_BY_TABLE[tableName];
  const rows = await ctx.db.query(tableName).collect();
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = options?.suffix?.trim().toUpperCase().replace(/[^A-Z]/g, "");
  const pattern = suffix
    ? new RegExp(`^${escapedPrefix}-(\\d+)(?:-[A-Z]{1,4})?$`)
    : new RegExp(`^${escapedPrefix}-(\\d+)$`);
  let max = 0;

  for (const row of rows) {
    const code =
      codeField && typeof (row as Record<string, unknown>)[codeField] === "string"
        ? ((row as Record<string, unknown>)[codeField] as string)
        : null;
    if (!code) {
      continue;
    }
    const match = code.match(pattern);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }

  const baseCode = `${prefix}-${String(max + 1).padStart(4, "0")}`;
  return suffix ? `${baseCode}-${suffix}` : baseCode;
}

export function paymentTermsFor(queryType: string) {
  const terms = PAYMENT_TERMS[queryType] ?? { min: 70, max: 100 };
  return {
    minAdvancePercent: terms.min,
    maxAdvancePercent: terms.max,
    label:
      terms.min === terms.max
        ? `${terms.min}% advance`
        : `${terms.min}%-${terms.max}% advance`,
  };
}

export async function deleteEntityNotifications(
  ctx: MutationCtx,
  entityType: string,
  entityId: string,
) {
  const notifications = await ctx.db.query("notifications").collect();
  for (const notification of notifications) {
    if (notification.entityType === entityType && notification.entityId === entityId) {
      await ctx.db.delete(notification._id);
    }
  }
}

async function deleteRowsByJobCard(
  ctx: MutationCtx,
  tableName: any,
  entityType: string,
  jobCardId: Id<"jobCards">,
) {
  const rows = await (ctx.db.query as any)(tableName)
    .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", jobCardId))
    .collect();
  for (const row of rows) {
    if (entityType === "expense" && row.proofAttachmentId) {
      const attachment = (await ctx.db.get(row.proofAttachmentId)) as any;
      if (attachment) {
        if (attachment.storageId) {
          try {
            await ctx.storage.delete(attachment.storageId);
          } catch (err) {
            console.error("Failed to delete expense proof from storage:", err);
          }
        }
        await ctx.db.delete(attachment._id);
      }
    }
    await deleteEntityNotifications(ctx, entityType, row._id);
    await ctx.db.delete(row._id);
  }
}

export async function deleteJobCardCascade(ctx: MutationCtx, jobCardId: Id<"jobCards">) {
  const travellers = await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .collect();
  for (const traveller of travellers) {
    const passportDetails = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .collect();
    for (const row of passportDetails) await ctx.db.delete(row._id);

    const mealPreferences = await ctx.db
      .query("mealPreferences")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .collect();
    for (const row of mealPreferences) await ctx.db.delete(row._id);

    await deleteEntityNotifications(ctx, "traveller", traveller._id);
    await ctx.db.delete(traveller._id);
  }

  await deleteRowsByJobCard(ctx, "visaRecords", "visaRecord", jobCardId);
  await deleteRowsByJobCard(ctx, "flightGroups", "flightGroup", jobCardId);
  await deleteRowsByJobCard(ctx, "pnrs", "pnr", jobCardId);
  await deleteRowsByJobCard(ctx, "tickets", "ticket", jobCardId);
  await deleteRowsByJobCard(ctx, "seatAllocations", "seatAllocation", jobCardId);
  await deleteRowsByJobCard(ctx, "hotels", "hotel", jobCardId);
  await deleteRowsByJobCard(ctx, "roomingListEntries", "roomingListEntry", jobCardId);
  await deleteRowsByJobCard(ctx, "tourManagerAssignments", "tourManager", jobCardId);
  await deleteRowsByJobCard(ctx, "vendors", "vendor", jobCardId);
  await deleteRowsByJobCard(ctx, "itineraries", "itinerary", jobCardId);
  await deleteRowsByJobCard(ctx, "eventFlows", "eventFlow", jobCardId);
  await deleteRowsByJobCard(ctx, "checklistTasks", "checklistTask", jobCardId);
  await deleteRowsByJobCard(ctx, "invoices", "invoice", jobCardId);
  await deleteRowsByJobCard(ctx, "additionalServices", "additionalService", jobCardId);
  await deleteRowsByJobCard(ctx, "expenseEntries", "expense", jobCardId);

  await deleteEntityNotifications(ctx, "jobCard", jobCardId);
  await ctx.db.delete(jobCardId);
}

export function publicJobCard(job: any) {
  return {
    id: job._id,
    jobCode: job.jobCode,
    queryId: job.queryId ?? null,
    proposalId: job.proposalId ?? null,
    clientName: job.clientName,
    destination: job.destination ?? "",
    confirmedPax: job.confirmedPax,
    roomCount: job.roomCount ?? 0,
    travelStartDate: job.travelStartDate ?? "",
    travelEndDate: job.travelEndDate ?? "",
    queryType: job.queryType ?? "",
    paymentTerms: job.paymentTerms ?? null,
    contractingOwnerName: job.contractingOwnerName ?? "",
    operationsOwnerName: job.operationsOwnerName ?? "",
    ticketingOwnerName: job.ticketingOwnerName ?? "",
    tourManagerName: job.tourManagerName ?? "",
    status: job.status,
    preDepartureChecklist: job.preDepartureChecklist ?? null,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  };
}

export function publicQuery(query: any) {
  return {
    id: query._id,
    queryCode: query.queryCode,
    clientName: query.clientName,
    contactPerson: query.contactPerson ?? "",
    destination: query.destination ?? "",
    paxCount: query.paxCount,
    travelStartDate: query.travelStartDate ?? "",
    travelEndDate: query.travelEndDate ?? "",
    queryType: query.queryType,
    travelType: query.travelType,
    salesStatus: query.salesStatus,
    contractingStatus: query.contractingStatus,
    lostReason: query.lostReason ?? "",
    salesOwnerName: query.salesOwnerName ?? "",
    contractingOwnerName: query.contractingOwnerName ?? "",
    contactMobile: query.contactMobile ?? "",
    budgetAmount: query.budgetAmount ?? 0,
    leadStage: query.leadStage ?? "",
    source: query.source ?? "",
    submittedToContractingAt: query.submittedToContractingAt
      ? new Date(query.submittedToContractingAt).toISOString()
      : null,
    notes: query.notes ?? "",
    contractingLandCost: query.contractingLandCost ?? 0,
    contractingAirlinesCost: query.contractingAirlinesCost ?? 0,
    contractingVisaCost: query.contractingVisaCost ?? 0,
    approxMargin: query.approxMargin ?? null,
    confirmedAt: query.confirmedAt ? new Date(query.confirmedAt).toISOString() : null,
    createdAt: new Date(query.createdAt).toISOString(),
    updatedAt: new Date(query.updatedAt).toISOString(),
  };
}
