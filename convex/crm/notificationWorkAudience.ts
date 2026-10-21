import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { notificationWorkKeyValidator } from "../lib/notificationEmailValidators";
import { canSeeJobCardRecord, canSeeQueryRecord } from "./lib/recordScope";
import { getRolePermissions } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";
import { classifyPassportExpiryUrgency } from "./passportExpiry";

export type NotificationWorkKey = Infer<typeof notificationWorkKeyValidator>;

// Old scheduled sends have titles and recipients but no explicit work-purpose metadata.
const LEGACY_WORK_NOTICES = new Map<string, NotificationWorkKey>([
  ["query:Query ready for assignment", "query_intake"],
  ["query:Query team assigned by Sales", "query_intake"],
  ["query:Query team assignment updated", "query_intake"],
  ["query:Query submitted to Contracting", "query_intake"],
  ["query:Assign Ticketing SPOC", "query_intake"],
  ["ticket:Ticketing action needed", "ticket_attention"],
  ["query:Confirmed query needs Job Card", "confirmed_query_without_job_card"],
  ["query:Query needs Contracting SPOC", "query_without_contracting_owner_after_24h"],
  ["jobCard:Job Card needs operations owner", "job_card_without_operations_owner_after_24h"],
  ["jobCard:Visa blockers before departure", "departure_14d_visa_not_ready"],
  ["jobCard:Ticket blockers before departure", "departure_14d_ticket_not_ready"],
  ["jobCard:Passport validity blocks departure", "passport_expiry_blocks_departure"],
  ["ticket:Ticket needs attention", "ticket_attention_status"],
  ["invoice:Invoice has overdue balance", "invoice_overdue_balance"],
]);

export function legacyNotificationWorkKey(job: { entityType?: string; title: string }) {
  return LEGACY_WORK_NOTICES.get(`${job.entityType}:${job.title}`);
}

interface WorkContext {
  invoice?: Doc<"invoices"> | null;
  job?: Doc<"jobCards"> | null;
  query?: Doc<"queries"> | null;
  report?: Doc<"postTourReports"> | null;
  ticket?: Doc<"tickets"> | null;
}

async function reportWorkContext(ctx: QueryCtx, entityId: string): Promise<WorkContext | null> {
  const id = ctx.db.normalizeId("postTourReports", entityId);
  const report = id ? await ctx.db.get("postTourReports", id) : null;
  const job = report ? await ctx.db.get("jobCards", report.jobCardId) : null;
  return job && report
    ? { job, query: job.queryId ? await ctx.db.get("queries", job.queryId) : null, report }
    : null;
}

async function loadWorkContext(
  ctx: QueryCtx,
  entityType: string,
  entityId: string
): Promise<WorkContext | null> {
  if (entityType === "query") {
    const id = ctx.db.normalizeId("queries", entityId);
    const query = id && (await ctx.db.get("queries", id));
    return query ? { query } : null;
  }
  let job: Doc<"jobCards"> | null = null;
  let ticket: Doc<"tickets"> | null = null;
  let invoice: Doc<"invoices"> | null = null;
  if (entityType === "ticket") {
    const id = ctx.db.normalizeId("tickets", entityId);
    ticket = id ? await ctx.db.get("tickets", id) : null;
    job = ticket ? await ctx.db.get("jobCards", ticket.jobCardId) : null;
  } else if (entityType === "invoice") {
    const id = ctx.db.normalizeId("invoices", entityId);
    invoice = id ? await ctx.db.get("invoices", id) : null;
    job = invoice ? await ctx.db.get("jobCards", invoice.jobCardId) : null;
  } else if (entityType === "jobCard") {
    const id = ctx.db.normalizeId("jobCards", entityId);
    job = id ? await ctx.db.get("jobCards", id) : null;
  }
  return job
    ? { invoice, job, query: job.queryId ? await ctx.db.get("queries", job.queryId) : null, ticket }
    : null;
}

function intendedWorkRecipients(key: NotificationWorkKey, work: WorkContext) {
  const heads = new Set<string>();
  const owners = new Set<string>();
  let financeHead = false;
  switch (key) {
    case "post_tour_submission": {
      heads.add("Directors");
      financeHead = true;
      const contractingOwner = work.job?.contractingOwnerId || work.query?.contractingOwnerId;
      if (contractingOwner) {
        owners.add(contractingOwner);
      }
      if (work.query?.salesOwnerId) {
        owners.add(work.query.salesOwnerId);
      }
      break;
    }
    case "query_intake":
      heads.add("Contracting Head").add("Operations Head").add("Directors").add("Admin");
      if (
        work.query?.ticketingScope !== "Not required" &&
        (work.query?.ticketingScope || work.query?.ticketingOwnerId)
      ) {
        heads.add("Head of Ticketing");
      }
      break;
    case "confirmed_query_without_job_card":
      heads.add("Accounts Head");
      financeHead = true;
      if (work.query?.jobCardCreatorStaffId) {
        owners.add(work.query.jobCardCreatorStaffId);
      }
      break;
    case "query_without_contracting_owner_after_24h":
      heads.add("Contracting Head").add("Operations Head");
      break;
    case "job_card_without_operations_owner_after_24h":
      heads.add("Operations Head");
      break;
    case "departure_14d_visa_not_ready":
    case "passport_expiry_blocks_departure":
      heads.add("Operations Head");
      if (work.job?.operationsOwnerId) {
        owners.add(work.job.operationsOwnerId);
      }
      break;
    case "departure_14d_ticket_not_ready":
      heads.add("Head of Ticketing");
      if (work.job?.ticketingOwnerId) {
        owners.add(work.job.ticketingOwnerId);
      }
      break;
    case "ticket_attention":
    case "ticket_attention_status":
      heads.add("Operations Head").add("Head of Ticketing");
      if (work.job?.operationsOwnerId) {
        owners.add(work.job.operationsOwnerId);
      }
      if (work.job?.ticketingOwnerId) {
        owners.add(work.job.ticketingOwnerId);
      }
      break;
    case "invoice_overdue_balance":
      heads.add("Accounts Head");
      financeHead = true;
      break;
    default:
      throw new Error(`Unknown notification work: ${key satisfies never}`);
  }
  return { financeHead, heads, owners };
}

async function workStillPending(ctx: QueryCtx, key: NotificationWorkKey, work: WorkContext) {
  if (key === "post_tour_submission") {
    return work.report?.status === "submitted" && !work.report.submissionAlertsCancelled;
  }
  if (key === "query_intake") {
    return true;
  }
  if (key !== "ticket_attention") {
    const rule = await ctx.db
      .query("portalWorkflowRules")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (rule?.enabled === false) {
      return false;
    }
  }
  if (key === "confirmed_query_without_job_card") {
    return (
      work.query?.salesStatus === "Order Confirmed" &&
      !(await ctx.db
        .query("jobCards")
        .withIndex("by_queryId", (q) => q.eq("queryId", work.query?._id))
        .first())
    );
  }
  if (key === "query_without_contracting_owner_after_24h") {
    return Boolean(
      work.query &&
        !work.query.contractingOwnerId &&
        !["Order Confirmed", "Order Lost"].includes(work.query.salesStatus)
    );
  }
  if (key === "job_card_without_operations_owner_after_24h") {
    return Boolean(work.job && !work.job.operationsOwnerId);
  }
  if (key === "ticket_attention" || key === "ticket_attention_status") {
    return Boolean(
      work.ticket &&
        ["Name Change Required", "Reissue Required", "Refund Pending"].includes(
          work.ticket.ticketStatus
        )
    );
  }
  if (key === "invoice_overdue_balance") {
    return Boolean(
      work.invoice &&
        work.invoice.balanceAmount > 0 &&
        work.invoice.dueDate &&
        work.invoice.dueDate < new Date().toISOString().slice(0, 10)
    );
  }
  return await departureWorkPending(ctx, key, work.job);
}

async function departureWorkPending(
  ctx: QueryCtx,
  key: NotificationWorkKey,
  job?: Doc<"jobCards"> | null
) {
  const today = new Date().toISOString().slice(0, 10);
  if (!(job?.travelStartDate && job.travelStartDate >= today)) {
    return false;
  }
  if (
    key !== "passport_expiry_blocks_departure" &&
    job.travelStartDate > new Date(Date.now() + 14 * 24 * 3_600_000).toISOString().slice(0, 10)
  ) {
    return false;
  }
  // The Job Card index stops at the first remaining blocker; no traveller details enter email here.
  for await (const traveller of ctx.db
    .query("travellers")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))) {
    if (
      key === "departure_14d_visa_not_ready" &&
      !["Approved", "Not Required"].includes(traveller.visaStatus)
    ) {
      return true;
    }
    if (key === "departure_14d_ticket_not_ready" && traveller.ticketStatus !== "Issued") {
      return true;
    }
    if (
      key === "passport_expiry_blocks_departure" &&
      ["critical", "expired"].includes(
        classifyPassportExpiryUrgency({
          expiryDate: traveller.passportExpiryDate,
          referenceDate: today,
          travelDate: job.travelStartDate,
        })
      )
    ) {
      return true;
    }
  }
  return false;
}

// The same exact staff audience is used at publication and before recovered sends.
// Additional email roles never grant responsibility for this work.
export async function notificationWorkAudience(
  ctx: QueryCtx,
  key: NotificationWorkKey,
  entityType: string,
  entityId: string
): Promise<Doc<"staffUsers">[]> {
  const work =
    entityType === "postTourReport"
      ? await reportWorkContext(ctx, entityId)
      : await loadWorkContext(ctx, entityType, entityId);
  if (!(work && (await workStillPending(ctx, key, work)))) {
    return [];
  }
  const { financeHead, heads, owners } = intendedWorkRecipients(key, work);
  const staff = await ctx.db.query("staffUsers").collect();
  return staff.filter((member) => {
    if (!member.active || member.roles.length === 0) {
      return false;
    }
    const intended =
      owners.has(member._id) ||
      Boolean(member.authUserId && owners.has(member.authUserId)) ||
      member.roles.some((role) => heads.has(role)) ||
      (financeHead && member.function?.trim().toLowerCase() === "finance head");
    if (!intended) {
      return false;
    }
    if (key === "post_tour_submission") {
      return true;
    }
    const access: PortalAccess = {
      allowed: true,
      authUserId: member.authUserId,
      email: member.email,
      name: member.name,
      permissions: getRolePermissions(member.roles),
      roles: member.roles,
      staffId: member._id,
    };
    return work.job
      ? canSeeJobCardRecord(access, work.job, work.query)
      : Boolean(work.query && canSeeQueryRecord(access, work.query));
  });
}
