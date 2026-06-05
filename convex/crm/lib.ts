import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export function isDefined<T>(value: T | null | undefined | false): value is T {
  return value != null && value !== false;
}

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
  "Contracting Cement",
  "Operations Cement",
  "Sales Cement",
  "Director Cement",
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
    P.VIEW_QUERIES,
    P.VIEW_PROPOSALS,
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
    P.VIEW_QUERIES,
    P.VIEW_PROPOSALS,
    P.MANAGE_PROPOSALS,
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
    P.VIEW_TEAM,
    P.VIEW_LEAVE,
    P.MANAGE_LEAVE,
    P.APPROVE_LEAVE,
    P.VIEW_APPROVALS,
  ],
  "Contracting Cement": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.MANAGE_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.MANAGE_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_LEAVE,
  ],
  "Operations Cement": [
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
  "Sales Cement": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.SEND_PROPOSALS,
    P.VIEW_LEAVE,
  ],
  "Director Cement": [
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
  return String(email ?? "")
    .trim()
    .toLowerCase();
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
    permissions.add(P.VIEW_EXPENSES);
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
  return (process.env.PORTAL_BOOTSTRAP_ADMINS ?? "").split(",").flatMap((email) => {
    const normalized = normalizeEmail(email);
    return normalized ? [normalized] : [];
  });
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

export async function requireStaff(ctx: QueryCtx | MutationCtx, permission?: string) {
  const access = await getPortalAccess(ctx);
  if (!access.allowed) {
    throw new ConvexError("FORBIDDEN");
  }
  if (permission && !access.permissions.includes(permission)) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

export async function requireAnyPermission(ctx: QueryCtx | MutationCtx, permissions: string[]) {
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

export const CEMENT_ROLES = [
  "Contracting Cement",
  "Operations Cement",
  "Sales Cement",
  "Director Cement",
] as const;

export const CEMENT_QUERY_TYPES = ["Cement", "Cement Bidding"] as const;

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

export function hasCementRole(access: PortalAccess) {
  return CEMENT_ROLES.some((role) => hasRole(access, role));
}

export function isCementQueryType(queryType?: string | null) {
  return CEMENT_QUERY_TYPES.includes(
    String(queryType ?? "") as (typeof CEMENT_QUERY_TYPES)[number],
  );
}

export function shouldApplyCementScope(access: PortalAccess) {
  return hasCementRole(access) && !isDirectorOrAdmin(access);
}

export function canSeeAllCementRecords(access: PortalAccess) {
  return shouldApplyCementScope(access) && hasRole(access, "Director Cement");
}

export function assertCementQueryTypeAllowed(access: PortalAccess, queryType: string) {
  if (shouldApplyCementScope(access) && !isCementQueryType(queryType)) {
    throw new ConvexError("Cement roles can only work with Cement query types");
  }
}

export function contractingNotifyRolesForQueryType(queryType: string) {
  return isCementQueryType(queryType)
    ? ["Contracting", "Contracting Head", "Contracting Cement"]
    : ["Contracting", "Contracting Head"];
}

export function canSeeQueryRecord(access: PortalAccess, query: any) {
  if (shouldApplyCementScope(access)) {
    if (!isCementQueryType(query.queryType)) {
      return false;
    }
    if (canSeeAllCementRecords(access)) {
      return true;
    }
  } else {
    if (
      canSeeDepartmentRecords(access, [
        "Sales Head",
        "Contracting Head",
        "Operations Head",
        "Head of Ticketing",
      ])
    ) {
      return true;
    }
    if (
      (hasRole(access, "Accounts") || hasRole(access, "Finance")) &&
      (query.salesStatus === "Order Confirmed" || query.contractingStatus === "Order Confirmed")
    ) {
      return true;
    }
  }
  return (
    ownsAuthRecord(access, query.createdBy) ||
    ownsAuthRecord(access, query.salesOwnerId) ||
    ownsStaffRecord(access, query.contractingOwnerId) ||
    ownsStaffRecord(access, query.ticketingOwnerId) ||
    ownsNamedRecord(access, query.salesOwnerName) ||
    ownsNamedRecord(access, query.contractingOwnerName) ||
    ownsNamedRecord(access, query.ticketingOwnerName)
  );
}

export function canSeeProposalRecord(access: PortalAccess, proposal: any, linkedQuery?: any) {
  const linkedQueries = Array.isArray(linkedQuery)
    ? linkedQuery.filter(Boolean)
    : linkedQuery
      ? [linkedQuery]
      : [];
  if (shouldApplyCementScope(access)) {
    const cementQueries = linkedQueries.filter((query) => isCementQueryType(query.queryType));
    if (cementQueries.length === 0) {
      return false;
    }
    if (canSeeAllCementRecords(access)) {
      return true;
    }
  } else {
    if (
      canSeeDepartmentRecords(access, [
        "Sales Head",
        "Contracting Head",
        "Operations Head",
        "Head of Ticketing",
      ])
    ) {
      return true;
    }
    if (
      hasRole(access, "Accounts") &&
      linkedQueries.some(
        (query) =>
          query.salesStatus === "Order Confirmed" || query.contractingStatus === "Order Confirmed",
      )
    ) {
      return true;
    }
  }
  return (
    ownsAuthRecord(access, proposal.createdBy) ||
    ownsNamedRecord(access, proposal.preparedBy) ||
    linkedQueries.some((query) => canSeeQueryRecord(access, query))
  );
}

export function canSeeJobCardRecord(access: PortalAccess, job: any, linkedQuery?: any) {
  const queryType = linkedQuery?.queryType ?? job.queryType ?? "";
  if (shouldApplyCementScope(access)) {
    if (!isCementQueryType(queryType)) {
      return false;
    }
    if (canSeeAllCementRecords(access)) {
      return true;
    }
  } else if (
    canSeeDepartmentRecords(access, ["Contracting Head", "Operations Head", "Head of Ticketing"]) ||
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

export function applyCementPortalScope(
  access: PortalAccess,
  records: {
    queries: any[];
    proposals: any[];
    jobCards: any[];
    travellers: any[];
    tickets: any[];
    visas: any[];
    invoices: any[];
    proposalQueryLinks?: any[];
  },
) {
  if (!shouldApplyCementScope(access)) {
    return records;
  }

  const queryById = new Map(records.queries.map((query) => [query._id, query]));
  const proposalLinksByProposalId = new Map<string, any[]>();
  for (const link of records.proposalQueryLinks ?? []) {
    const linkedQuery = queryById.get(link.queryId);
    if (!linkedQuery) continue;
    const bucket = proposalLinksByProposalId.get(link.proposalId) ?? [];
    bucket.push(linkedQuery);
    proposalLinksByProposalId.set(link.proposalId, bucket);
  }
  const visibleQueries = records.queries.filter((query) => canSeeQueryRecord(access, query));
  const visibleJobCards = records.jobCards.filter((job) => {
    const linkedQuery = job.queryId ? queryById.get(job.queryId) : undefined;
    return canSeeJobCardRecord(access, job, linkedQuery);
  });
  const visibleJobIds = new Set(visibleJobCards.map((job) => job._id));
  const visibleProposals = records.proposals.filter((proposal) => {
    const linkedQueries = [...(proposalLinksByProposalId.get(proposal._id) ?? [])];
    const legacyLinkedQuery = proposal.queryId ? queryById.get(proposal.queryId) : undefined;
    if (legacyLinkedQuery && !linkedQueries.some((query) => query._id === legacyLinkedQuery._id)) {
      linkedQueries.push(legacyLinkedQuery);
    }
    return canSeeProposalRecord(access, proposal, linkedQueries);
  });

  return {
    queries: visibleQueries,
    proposals: visibleProposals,
    jobCards: visibleJobCards,
    travellers: records.travellers.filter((traveller) => visibleJobIds.has(traveller.jobCardId)),
    tickets: records.tickets.filter((ticket) => visibleJobIds.has(ticket.jobCardId)),
    visas: records.visas.filter((visa) => visibleJobIds.has(visa.jobCardId)),
    invoices: records.invoices.filter(
      (invoice) => !invoice.jobCardId || visibleJobIds.has(invoice.jobCardId),
    ),
  };
}

export function getHeadReviewerRolesForStaff(staff: { roles?: string[]; department?: string }) {
  const roles = new Set(staff.roles ?? []);
  const department = (staff.department ?? "").toLowerCase();
  const reviewerRoles: string[] = [];
  if (roles.has("Sales") || department.includes("sales")) reviewerRoles.push("Sales Head");
  if (roles.has("Contracting") || department.includes("contracting"))
    reviewerRoles.push("Contracting Head");
  if (
    roles.has("Operations") ||
    roles.has("Tour Manager") ||
    department.includes("operation") ||
    department.includes("tour")
  ) {
    reviewerRoles.push("Operations Head");
  }
  if (roles.has("Ticketing") || department.includes("ticket"))
    reviewerRoles.push("Head of Ticketing");
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

export function canActAsLeaveHeadReviewer(access: PortalAccess, reviewerRole: string) {
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
  const reviewerRole = leave.headReviewerRole ?? getHeadReviewerRolesForStaff(staff)[0] ?? "HR";

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

export async function requireHeadOrAdmin(ctx: QueryCtx | MutationCtx, headRoles: string[]) {
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

function notificationEntityId(entityId?: string | Id<any>) {
  return entityId != null ? String(entityId) : undefined;
}

function addNotificationEmailRecipient(recipients: Set<string>, email?: string | null) {
  const normalized = normalizeEmail(email);
  if (normalized) {
    recipients.add(normalized);
  }
}

async function queueNotificationEmail(
  ctx: MutationCtx,
  recipients: Set<string>,
  input: {
    title: string;
    body: string;
    entityType?: string;
    entityId?: string | Id<any>;
  },
) {
  if (recipients.size === 0) {
    return;
  }
  await ctx.scheduler.runAfter(0, internal.crm.notificationEmails.sendNotificationEmail, {
    recipients: Array.from(recipients),
    title: input.title,
    body: input.body,
    entityType: input.entityType,
    entityId: notificationEntityId(input.entityId),
  });
}

export async function notifyRoles(
  ctx: MutationCtx,
  roles: string[],
  input: {
    title: string;
    body: string;
    entityType?: string;
    entityId?: string | Id<any>;
  },
) {
  const createdAt = Date.now();
  const entityId = notificationEntityId(input.entityId);
  const staffRows = await ctx.db.query("staffUsers").collect();
  const staffRoleSets = staffRows.map((member) => ({
    member,
    roles: new Set(member.roles),
  }));
  const emailRecipients = new Set<string>();

  for (const role of roles) {
    for (const { member, roles: memberRoles } of staffRoleSets) {
      if (member.active && memberRoles.has(role as any)) {
        addNotificationEmailRecipient(emailRecipients, member.email);
      }
    }
  }
  await Promise.all(
    roles.map((role) =>
      ctx.db.insert("notifications", {
        recipientRole: role as any,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId,
        createdAt,
      }),
    ),
  );

  await queueNotificationEmail(ctx, emailRecipients, input);
}

export async function notifyStaffMatching(
  ctx: MutationCtx,
  shouldNotify: (staff: { roles: string[]; active: boolean; authUserId?: string }) => boolean,
  input: {
    title: string;
    body: string;
    entityType?: string;
    entityId?: string | Id<any>;
  },
  options?: {
    fallbackRoles?: string[];
  },
) {
  const createdAt = Date.now();
  const entityId = notificationEntityId(input.entityId);
  const staffRows = await ctx.db.query("staffUsers").collect();
  const staffRoleSets = staffRows.map((member) => ({
    member,
    roles: new Set(member.roles),
  }));
  const notifiedUserIds = new Set<string>();
  const emailRecipients = new Set<string>();
  const notificationInserts: Array<() => Promise<unknown>> = [];

  for (const { member } of staffRoleSets) {
    if (!member.active || !shouldNotify(member)) {
      continue;
    }
    addNotificationEmailRecipient(emailRecipients, member.email);
    if (member.authUserId) {
      if (notifiedUserIds.has(member.authUserId)) {
        continue;
      }
      notifiedUserIds.add(member.authUserId);
      notificationInserts.push(() =>
        ctx.db.insert("notifications", {
          recipientUserId: member.authUserId,
          title: input.title,
          body: input.body,
          entityType: input.entityType,
          entityId,
          createdAt,
        }),
      );
      continue;
    }
    for (const role of member.roles) {
      notificationInserts.push(() =>
        ctx.db.insert("notifications", {
          recipientRole: role as any,
          title: input.title,
          body: input.body,
          entityType: input.entityType,
          entityId,
          createdAt,
        }),
      );
    }
  }

  for (const role of options?.fallbackRoles ?? []) {
    const hasLinkedStaff = staffRoleSets.some(
      ({ member, roles: memberRoles }) =>
        member.active && member.authUserId && memberRoles.has(role as any) && shouldNotify(member),
    );
    if (!hasLinkedStaff) {
      for (const { member, roles: memberRoles } of staffRoleSets) {
        if (member.active && memberRoles.has(role as any) && shouldNotify(member)) {
          addNotificationEmailRecipient(emailRecipients, member.email);
        }
      }
      notificationInserts.push(() =>
        ctx.db.insert("notifications", {
          recipientRole: role as any,
          title: input.title,
          body: input.body,
          entityType: input.entityType,
          entityId,
          createdAt,
        }),
      );
    }
  }

  await Promise.all(notificationInserts.map((insert) => insert()));

  await queueNotificationEmail(ctx, emailRecipients, input);
}

const CODE_FIELD_BY_TABLE: Record<string, string> = {
  jobCards: "jobCode",
  queries: "queryCode",
  proposals: "proposalCode",
  approvalRequests: "requestCode",
};

export const MAX_QUERY_NOTES_WORDS = 30;

export function countWords(value: string | undefined | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function assertMaxWordCount(
  value: string | undefined,
  maxWords: number,
  fieldLabel: string,
) {
  if (value === undefined) {
    return;
  }
  const wordCount = countWords(value);
  if (wordCount > maxWords) {
    throw new ConvexError(`${fieldLabel} must be ${maxWords} words or fewer`);
  }
}

export function assertDateRangeOrder(
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  startLabel: string,
  endLabel: string,
) {
  const start = startDate?.trim();
  const end = endDate?.trim();
  if (!start || !end) {
    return;
  }
  if (start > end) {
    throw new ConvexError(`${startLabel} must be on or before ${endLabel}.`);
  }
}

export function creatorInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .flatMap((part) => {
      const cleaned = part.replace(/[^A-Za-z]/g, "");
      return cleaned ? [cleaned] : [];
    });

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
  const suffix = options?.suffix
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
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
      terms.min === terms.max ? `${terms.min}% advance` : `${terms.min}%-${terms.max}% advance`,
  };
}

export async function deleteEntityNotifications(
  ctx: MutationCtx,
  entityType: string,
  entityId: string,
) {
  const notifications = await ctx.db.query("notifications").collect();
  await Promise.all(
    notifications.flatMap((notification) =>
      notification.entityType === entityType && notification.entityId === entityId
        ? [ctx.db.delete(notification._id)]
        : [],
    ),
  );
}

export function canReceiveNotification(
  notification: {
    recipientUserId?: string;
    recipientRole?: string;
  },
  access: { authUserId?: string | null; roles: string[] },
) {
  const roleSet = new Set(access.roles);
  if (notification.recipientUserId && notification.recipientUserId !== access.authUserId) {
    return false;
  }
  if (notification.recipientRole && !roleSet.has(notification.recipientRole)) {
    return false;
  }
  return true;
}

export async function notifyStaffMember(
  ctx: MutationCtx,
  staffId: Id<"staffUsers">,
  input: {
    title: string;
    body: string;
    entityType?: string;
    entityId?: string | Id<any>;
  },
) {
  const staff = await ctx.db.get(staffId);
  if (!staff?.active) {
    return;
  }
  const createdAt = Date.now();
  const entityId = notificationEntityId(input.entityId);
  const emailRecipients = new Set<string>();
  addNotificationEmailRecipient(emailRecipients, staff.email);

  if (staff.authUserId) {
    await ctx.db.insert("notifications", {
      recipientUserId: staff.authUserId,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId,
      createdAt,
    });
  } else {
    await Promise.all(
      staff.roles.map((role) =>
        ctx.db.insert("notifications", {
          recipientRole: role as any,
          title: input.title,
          body: input.body,
          entityType: input.entityType,
          entityId,
          createdAt,
        }),
      ),
    );
  }

  await queueNotificationEmail(ctx, emailRecipients, input);
}

export async function deleteStorageFile(ctx: MutationCtx, storageId: unknown, label: string) {
  if (!storageId) return;
  try {
    await ctx.storage.delete(storageId as any);
  } catch (err) {
    console.error(`Failed to delete ${label} from storage:`, err);
  }
}

async function deleteApprovalsForEntity(ctx: MutationCtx, entityType: string, entityId: string) {
  const approvals = await ctx.db
    .query("approvalRequests")
    .withIndex("by_entity", (q) => q.eq("entityType", entityType).eq("entityId", entityId))
    .collect();
  await Promise.all(
    approvals.map(async (approval) => {
      await deleteEntityNotifications(ctx, "approval", approval._id);
      await ctx.db.delete(approval._id);
    }),
  );
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
  await Promise.all(
    rows.map(async (row: any) => {
      if (entityType === "expense" && row.proofAttachmentId) {
        const attachment = (await ctx.db.get(row.proofAttachmentId)) as any;
        if (attachment) {
          await deleteStorageFile(ctx, attachment.storageId, "expense proof");
          await ctx.db.delete(attachment._id);
        }
        await deleteApprovalsForEntity(ctx, "expense", row._id);
      }
      await deleteEntityNotifications(ctx, entityType, row._id);
      await ctx.db.delete(row._id);
    }),
  );
}

export async function deleteJobCardCascade(ctx: MutationCtx, jobCardId: Id<"jobCards">) {
  const travellers = await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .collect();
  await Promise.all(
    travellers.map(async (traveller) => {
      const [passportDetails, mealPreferences] = await Promise.all([
        ctx.db
          .query("passportDetails")
          .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
          .collect(),
        ctx.db
          .query("mealPreferences")
          .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
          .collect(),
      ]);
      await Promise.all([
        ...passportDetails.map((row) =>
          Promise.all([
            deleteStorageFile(ctx, row.storageId, "passport scan"),
            ctx.db.delete(row._id),
          ]),
        ),
        ...mealPreferences.map((row) => ctx.db.delete(row._id)),
        deleteEntityNotifications(ctx, "traveller", traveller._id),
        ctx.db.delete(traveller._id),
      ]);
    }),
  );

  await Promise.all([
    deleteRowsByJobCard(ctx, "visaRecords", "visaRecord", jobCardId),
    deleteRowsByJobCard(ctx, "flightSegments", "flightSegment", jobCardId),
    deleteRowsByJobCard(ctx, "flightGroups", "flightGroup", jobCardId),
    deleteRowsByJobCard(ctx, "pnrs", "pnr", jobCardId),
    deleteRowsByJobCard(ctx, "tickets", "ticket", jobCardId),
    deleteRowsByJobCard(ctx, "seatAllocations", "seatAllocation", jobCardId),
    deleteRowsByJobCard(ctx, "hotels", "hotel", jobCardId),
    deleteRowsByJobCard(ctx, "roomingListEntries", "roomingListEntry", jobCardId),
    deleteRowsByJobCard(ctx, "tourManagerAssignments", "tourManager", jobCardId),
    deleteRowsByJobCard(ctx, "vendors", "vendor", jobCardId),
    deleteRowsByJobCard(ctx, "itineraries", "itinerary", jobCardId),
    deleteRowsByJobCard(ctx, "eventFlows", "eventFlow", jobCardId),
    deleteRowsByJobCard(ctx, "checklistTasks", "checklistTask", jobCardId),
    deleteRowsByJobCard(ctx, "invoices", "invoice", jobCardId),
    deleteRowsByJobCard(ctx, "additionalServices", "additionalService", jobCardId),
    deleteRowsByJobCard(ctx, "expenseEntries", "expense", jobCardId),
  ]);

  await Promise.all([
    deleteEntityNotifications(ctx, "jobCard", jobCardId),
    ctx.db.delete(jobCardId),
  ]);
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
    ticketingOwnerName: query.ticketingOwnerName ?? "",
    contactMobile: query.contactMobile ?? "",
    budgetAmount: query.budgetAmount ?? 0,
    leadStage: query.leadStage === "Closed" ? "Lost" : (query.leadStage ?? ""),
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

export function requestedProposalQueryIds(args: { queryId?: string; queryIds?: string[] }) {
  if (args.queryIds !== undefined) {
    return args.queryIds;
  }
  if (args.queryId !== undefined) {
    return args.queryId ? [args.queryId] : [];
  }
  return null;
}

export function assertBulkDeleteLimit(count: number) {
  if (count === 0) {
    throw new ConvexError("No records selected");
  }
}

export const portalDateRangeValidator = v.optional(
  v.object({
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  }),
);

export type PortalDateRange = {
  from?: string;
  to?: string;
};

const PORTAL_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePortalDateOnly(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const text = value.trim();
  if (!PORTAL_DATE_ONLY_RE.test(text)) return null;
  return new Date(`${text}T00:00:00`).getTime();
}

export function endOfPortalDateOnly(value: string | undefined): number | null {
  const start = parsePortalDateOnly(value);
  if (start == null) return null;
  return start + 24 * 60 * 60 * 1000 - 1;
}

export function resolvePortalDateRange(range?: PortalDateRange | null) {
  if (!range) return null;
  const sinceMs = parsePortalDateOnly(range.from);
  const untilMs = endOfPortalDateOnly(range.to);
  if (sinceMs == null && untilMs == null) return null;
  return {
    sinceMs: sinceMs ?? 0,
    untilMs: untilMs ?? Date.now(),
  };
}

export function filterRecordsByDateRange<T extends { createdAt: number }>(
  records: T[],
  range?: PortalDateRange | null,
) {
  const resolved = resolvePortalDateRange(range);
  if (!resolved) return records;
  return records.filter(
    (record) => record.createdAt >= resolved.sinceMs && record.createdAt <= resolved.untilMs,
  );
}
