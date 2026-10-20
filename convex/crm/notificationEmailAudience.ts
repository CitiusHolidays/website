import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hasOwnKey } from "../lib/runtimeValues";
import { canViewUnlinkedExpense } from "./expensePolicy";
import { canSeeJobCardRecord, canSeeProposalRecord, canSeeQueryRecord } from "./lib/recordScope";
import { getRolePermissions, PERMISSIONS } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";
import { legacyNotificationWorkKey, notificationWorkAudience } from "./notificationWorkAudience";

// Revalidate the original delivery purpose and record access, including retries.
// A queued notification is a delivery instruction, never an authorization grant.
export async function notificationRecipientCanAccess(
  ctx: QueryCtx,
  staff: Doc<"staffUsers">,
  job: Pick<
    Doc<"notificationEmailOutbox">,
    "entityId" | "entityType" | "recipientPurposes" | "title"
  >
): Promise<boolean> {
  const purposes = job.recipientPurposes ?? [{ kind: "event" as const }];
  const legacyWork = purposes.some((purpose) => purpose.kind === "work")
    ? undefined
    : legacyNotificationWorkKey(job);
  if (legacyWork && job.entityId && job.entityType) {
    const current = await notificationWorkAudience(ctx, legacyWork, job.entityType, job.entityId);
    if (!current.some((member) => member._id === staff._id)) {
      return false;
    }
  }
  const eligible = await Promise.all(
    purposes.map((purpose) => recipientPurposeStillApplies(ctx, staff, job, purpose))
  );
  if (!eligible.some(Boolean)) {
    return false;
  }
  if (!(job.entityId && job.entityType)) {
    return true;
  }
  const access: PortalAccess = {
    allowed: true,
    authUserId: staff.authUserId,
    email: staff.email,
    name: staff.name,
    permissions: getRolePermissions(staff.roles),
    roles: staff.roles,
    staffId: staff._id,
  };
  const id = job.entityId;
  const check = accessChecks.get(job.entityType);
  if (check) {
    return await check(ctx, access, id, staff);
  }
  if (job.entityType === "inboundQueryIntent") {
    return access.permissions.includes(PERMISSIONS.VIEW_QUERIES);
  }
  return await jobLinkedAccess(ctx, access, id, staff, job.entityType);
}

async function jobLinkedAccess(
  ctx: QueryCtx,
  access: PortalAccess,
  id: string,
  staff: Doc<"staffUsers">,
  entityType: string
): Promise<boolean> {
  const tables = {
    flightGroup: "flightGroups",
    hotel: "hotels",
    invoice: "invoices",
    jobCard: "jobCards",
    pnr: "pnrs",
    seatAllocation: "seatAllocations",
    ticket: "tickets",
    tourManager: "tourManagerAssignments",
    traveller: "travellers",
    visaRecord: "visaRecords",
  } as const;
  let jobCardId: Id<"jobCards"> | null | undefined;
  if (entityType === "passport") {
    const recordId = ctx.db.normalizeId("passportDetails", id);
    const record = recordId && (await ctx.db.get("passportDetails", recordId));
    const traveller = record && (await ctx.db.get("travellers", record.travellerId));
    jobCardId = traveller ? traveller.jobCardId : undefined;
  } else if (hasOwnKey(tables, entityType)) {
    const table = tables[entityType];
    const recordId = ctx.db.normalizeId(table, id);
    const record = recordId && (await ctx.db.get(table, recordId));
    if (!record) {
      return false;
    }
    if ("staffId" in record && record.staffId === staff._id) {
      return true;
    }
    jobCardId = "jobCardId" in record ? record.jobCardId : ctx.db.normalizeId("jobCards", id);
  } else {
    // Other existing staff-only notices keep their publisher's explicit audience.
    // They have no entity-detail loader; adding one requires an access rule here.
    return true;
  }
  if (!jobCardId) {
    return false;
  }
  const linkedJob = await ctx.db.get("jobCards", jobCardId);
  const query = linkedJob?.queryId ? await ctx.db.get("queries", linkedJob.queryId) : null;
  return Boolean(linkedJob && canSeeJobCardRecord(access, linkedJob, query));
}

async function queryAccess(ctx: QueryCtx, access: PortalAccess, id: string): Promise<boolean> {
  const recordId = ctx.db.normalizeId("queries", id);
  const record = recordId && (await ctx.db.get("queries", recordId));
  return Boolean(record && canSeeQueryRecord(access, record));
}

async function proposalAccess(ctx: QueryCtx, access: PortalAccess, id: string): Promise<boolean> {
  const recordId = ctx.db.normalizeId("proposals", id);
  const record = recordId && (await ctx.db.get("proposals", recordId));
  if (!record) {
    return false;
  }
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (q) => q.eq("proposalId", record._id))
    .collect();
  const queryIds = new Set([
    ...links.map((link) => link.queryId),
    ...(record.queryId ? [record.queryId] : []),
  ]);
  const queries = await Promise.all([...queryIds].map((queryId) => ctx.db.get("queries", queryId)));
  return canSeeProposalRecord(
    access,
    record,
    queries.filter((linkedQuery): linkedQuery is Doc<"queries"> => Boolean(linkedQuery))
  );
}

async function leaveAccess(
  ctx: QueryCtx,
  _access: PortalAccess,
  id: string,
  staff: Doc<"staffUsers">
): Promise<boolean> {
  const recordId = ctx.db.normalizeId("staffLeaveRecords", id);
  const record = recordId && (await ctx.db.get("staffLeaveRecords", recordId));
  return Boolean(
    record &&
      [
        record.staffId,
        record.headApproverStaffId,
        record.finalAuthorityStaffId,
        record.hrCopyStaffId,
      ].includes(staff._id)
  );
}

async function expenseAccess(ctx: QueryCtx, access: PortalAccess, id: string): Promise<boolean> {
  const recordId = ctx.db.normalizeId("expenseEntries", id);
  const record = recordId && (await ctx.db.get("expenseEntries", recordId));
  if (!record) {
    return false;
  }
  if (canViewUnlinkedExpense(access, record)) {
    return true;
  }
  if (!record.jobCardId) {
    return false;
  }
  const linkedJob = await ctx.db.get("jobCards", record.jobCardId);
  const query = linkedJob?.queryId ? await ctx.db.get("queries", linkedJob.queryId) : null;
  return Boolean(linkedJob && canSeeJobCardRecord(access, linkedJob, query));
}

async function approvalAccess(
  ctx: QueryCtx,
  access: PortalAccess,
  id: string,
  staff: Doc<"staffUsers">
): Promise<boolean> {
  const recordId = ctx.db.normalizeId("approvalRequests", id);
  const record = recordId && (await ctx.db.get("approvalRequests", recordId));
  return Boolean(
    record &&
      (record.requestedBy === staff.authUserId ||
        access.permissions.includes(PERMISSIONS.VIEW_APPROVALS) ||
        access.permissions.includes(PERMISSIONS.APPROVE_EXPENSES))
  );
}

const accessChecks = new Map<
  string,
  (ctx: QueryCtx, access: PortalAccess, id: string, staff: Doc<"staffUsers">) => Promise<boolean>
>([
  ["query", queryAccess],
  ["proposal", proposalAccess],
  ["leave", leaveAccess],
  ["expense", expenseAccess],
  ["approval", approvalAccess],
]);

async function recipientPurposeStillApplies(
  ctx: QueryCtx,
  staff: Doc<"staffUsers">,
  job: Pick<Doc<"notificationEmailOutbox">, "entityId" | "entityType">,
  purpose: NonNullable<Doc<"notificationEmailOutbox">["recipientPurposes"]>[number]
): Promise<boolean> {
  if (purpose.kind === "event") {
    return true;
  }
  if (purpose.kind === "work") {
    if (!(job.entityId && job.entityType)) {
      return false;
    }
    const recipients = await notificationWorkAudience(
      ctx,
      purpose.key,
      job.entityType,
      job.entityId
    );
    return recipients.some((member) => member._id === staff._id);
  }
  if (purpose.kind === "roles") {
    const enabledRoles = new Set<string>([...staff.roles, ...(staff.emailAlertRoles ?? [])]);
    return purpose.roles.some((role) => enabledRoles.has(role));
  }
  const tables = {
    jobCard: "jobCards",
    query: "queries",
    tourManager: "tourManagerAssignments",
  } as const;
  if (!(job.entityId && job.entityType && hasOwnKey(tables, job.entityType))) {
    return false;
  }
  const table = tables[job.entityType];
  const id = ctx.db.normalizeId(table, job.entityId);
  const record = id && (await ctx.db.get(table, id));
  if (!(record && hasOwnKey(record, purpose.field))) {
    return false;
  }
  const ownerId = record[purpose.field];
  return (
    ownerId === staff._id ||
    (purpose.field === "salesOwnerId" && Boolean(staff.authUserId && ownerId === staff.authUserId))
  );
}
