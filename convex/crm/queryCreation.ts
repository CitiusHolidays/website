import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  assertCementQueryTypeAllowed,
  assertDateRangeOrder,
  assertMaxWordCount,
  createActivity,
  MAX_QUERY_NOTES_WORDS,
  nextCode,
  PERMISSIONS,
  requireStaff,
} from "./lib";
import { buildQueryListSearchText } from "./listSearch";
import { notifyQueryAssignmentHeads, notifyTicketingHeadOnQueryIntake } from "./queryNotifications";
import { applyQueryTeamAssignments } from "./queryTeamAssignment";
import type { QueryType, TravelType } from "./queryValidators";

const SALES_REP_ROLES = new Set(["Sales", "Sales Head", "Sales Cement"]);

export async function resolveSalesOwnerSelection(
  ctx: MutationCtx,
  access: { name: string; staffId?: Id<"staffUsers"> },
  salesOwnerStaffId?: string,
  salesOwnerName?: string
) {
  if (salesOwnerStaffId) {
    const staffId = ctx.db.normalizeId("staffUsers", salesOwnerStaffId);
    const staff = staffId ? await ctx.db.get(staffId) : null;
    if (!(staff?.active && staff.roles.some((role) => SALES_REP_ROLES.has(role)))) {
      throw new ConvexError("Select an active Sales Rep");
    }
    return staff;
  }
  const requestedName = salesOwnerName?.trim();
  if (!requestedName && access.staffId) {
    const currentStaff = await ctx.db.get(access.staffId);
    if (currentStaff?.active) {
      return currentStaff;
    }
  }
  const matchingStaff = (await ctx.db.query("staffUsers").collect()).filter(
    (staff) =>
      staff.active &&
      staff.name.trim().toLowerCase() === (requestedName || access.name).toLowerCase() &&
      staff.roles.some((role) => SALES_REP_ROLES.has(role))
  );
  if (matchingStaff.length !== 1) {
    throw new ConvexError("Select one Sales Rep from the staff list");
  }
  return matchingStaff[0];
}

export async function handleQueryCreate(
  ctx: MutationCtx,
  args: {
    batchingNotes?: string;
    budgetAmount?: number;
    clientName: string;
    contactMobile?: string;
    contactPerson?: string;
    contractingStaffId?: string;
    destination?: string;
    notes?: string;
    paxCount: number;
    queryType: QueryType;
    salesOwnerName?: string;
    salesOwnerStaffId?: string;
    source?: string;
    ticketingScope?: string;
    travelEndDate?: string;
    travelInBatches?: boolean;
    travelStartDate?: string;
    travelType: TravelType;
  }
) {
  if (!args.clientName.trim()) {
    throw new ConvexError("Client name is required");
  }
  if (args.paxCount < 1) {
    throw new ConvexError("Pax count must be greater than zero");
  }
  assertMaxWordCount(args.notes, MAX_QUERY_NOTES_WORDS, "Notes");
  assertDateRangeOrder(
    args.travelStartDate,
    args.travelEndDate,
    "Travel start date",
    "Travel end date"
  );

  const now = Date.now();
  const [access, [queryCode, clientId]] = await Promise.all([
    requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES),
    Promise.all([
      nextCode(ctx, "queries", "Q"),
      ctx.db.insert("clients", {
        contactPerson: args.contactPerson?.trim() || "",
        createdAt: now,
        name: args.clientName.trim(),
        phone: args.contactMobile?.trim() || "",
        updatedAt: now,
      }),
    ]),
  ]);
  assertCementQueryTypeAllowed(access, args.queryType);
  const salesOwnerStaff = await resolveSalesOwnerSelection(
    ctx,
    access,
    args.salesOwnerStaffId,
    args.salesOwnerName
  );
  const salesOwnerName = salesOwnerStaff.name.trim();
  const queryPayload = {
    attachmentCount: 0,
    attachmentPreview: [],
    batchingNotes: args.batchingNotes?.trim() || "",
    budgetAmount: Math.max(args.budgetAmount ?? 0, 0),
    clientId,
    clientName: args.clientName.trim(),
    contactMobile: args.contactMobile?.trim() || "",
    contactPerson: args.contactPerson?.trim() || "",
    contractingStatus: "Query Received" as const,
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    destination: args.destination?.trim() || "",
    leadStage: "Proposal" as const,
    listSearchText: buildQueryListSearchText({
      clientName: args.clientName,
      destination: args.destination,
      queryCode,
      queryType: args.queryType,
      salesOwnerName,
    }),
    notes: args.notes?.trim() || "",
    paxCount: args.paxCount,
    queryCode,
    queryType: args.queryType,
    salesOwnerId: salesOwnerStaff?.authUserId ?? access.authUserId,
    salesOwnerName,
    salesStatus: "Proposal in discussion" as const,
    source: (args.source ?? "Client") as "Website" | "WhatsApp" | "Email" | "Client" | "Referral",
    submittedToContractingAt: now,
    travelEndDate: args.travelEndDate || "",
    travelInBatches: Boolean(args.travelInBatches),
    travelStartDate: args.travelStartDate || "",
    travelType: args.travelType,
    updatedAt: now,
  };
  const id = await ctx.db.insert("queries", queryPayload);

  await createActivity(ctx, access, {
    action: "created",
    entityId: id,
    entityType: "query",
    message: `${queryCode} created for ${args.clientName.trim()}`,
  });

  if (args.contractingStaffId || args.ticketingScope) {
    await applyQueryTeamAssignments(ctx, access, {
      contractingStaffId: args.contractingStaffId,
      queryId: id,
      ticketingScope: args.ticketingScope,
    });
  } else {
    await notifyQueryAssignmentHeads(
      ctx,
      { ticketingScope: args.ticketingScope },
      {
        body: `${queryCode} was raised by Sales. Review and assign contracting and ticketing teams.`,
        entityId: id,
        entityType: "query",
        title: "Query ready for assignment",
      }
    );
    await notifyTicketingHeadOnQueryIntake(
      ctx,
      { queryCode, ticketingScope: args.ticketingScope },
      id
    );
  }

  return { id, queryCode };
}
