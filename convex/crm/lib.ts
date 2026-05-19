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
  VIEW_APPROVALS: "view:approvals",
  VIEW_REPORTS: "view:reports",
  VIEW_ACTIVITY: "view:activity",
  VIEW_SENSITIVE_TRAVELLER_DATA: "view:sensitiveTravellerData",
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
    P.VIEW_APPROVALS,
    P.VIEW_REPORTS,
    P.VIEW_ACTIVITY,
    P.VIEW_SENSITIVE_TRAVELLER_DATA,
  ],
  "Sales Head": [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.VIEW_TEAM,
    P.VIEW_ACTIVITY,
  ],
  Sales: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.MANAGE_QUERIES,
    P.VIEW_PROPOSALS,
    P.VIEW_TEAM,
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
    P.VIEW_ACTIVITY,
  ],
  Contracting: [
    P.VIEW_DASHBOARD,
    P.VIEW_QUERIES,
    P.VIEW_CONTRACTING,
    P.MANAGE_CONTRACTING,
    P.VIEW_PROPOSALS,
    P.MANAGE_PROPOSALS,
    P.VIEW_JOB_CARDS,
    P.VIEW_TEAM,
  ],
  Accounts: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.MANAGE_JOB_CARDS,
    P.VIEW_FINANCE,
    P.MANAGE_FINANCE,
    P.VIEW_EXPENSES,
    P.VIEW_TEAM,
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
    P.VIEW_ACTIVITY,
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
    P.VIEW_TEAM,
  ],
  "Head of Ticketing": [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_TICKETING,
    P.MANAGE_TICKETING,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_TEAM,
    P.VIEW_ACTIVITY,
  ],
  Ticketing: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_TRAVELLERS,
    P.VIEW_TICKETING,
    P.MANAGE_TICKETING,
    P.VIEW_TOUR_MANAGERS,
    P.VIEW_TEAM,
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
    P.VIEW_TEAM,
  ],
  Finance: [
    P.VIEW_DASHBOARD,
    P.VIEW_JOB_CARDS,
    P.VIEW_FINANCE,
    P.MANAGE_FINANCE,
    P.VIEW_EXPENSES,
    P.APPROVE_EXPENSES,
    P.VIEW_TEAM,
    P.VIEW_APPROVALS,
    P.VIEW_REPORTS,
    P.VIEW_ACTIVITY,
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
  const staff = await ctx.db
    .query("staffUsers")
    .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", email))
    .unique();

  if (staff?.active) {
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

export async function nextCode(
  ctx: QueryCtx | MutationCtx,
  tableName: any,
  prefix: string,
) {
  const count = (await ctx.db.query(tableName).collect()).length + 1;
  return `${prefix}-${String(count).padStart(4, "0")}`;
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
    clientName: job.clientName,
    destination: job.destination ?? "",
    confirmedPax: job.confirmedPax,
    roomCount: job.roomCount ?? 0,
    travelStartDate: job.travelStartDate ?? "",
    travelEndDate: job.travelEndDate ?? "",
    queryType: job.queryType ?? "",
    paymentTerms: job.paymentTerms ?? null,
    operationsOwnerName: job.operationsOwnerName ?? "",
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
    confirmedAt: query.confirmedAt ? new Date(query.confirmedAt).toISOString() : null,
    createdAt: new Date(query.createdAt).toISOString(),
    updatedAt: new Date(query.updatedAt).toISOString(),
  };
}
