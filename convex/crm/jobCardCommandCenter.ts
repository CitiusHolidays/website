import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { destinationCover } from "../lib/customerAppCovers";
import { type AppSurface, requireAppPilotForSurface } from "./appPilot";
import { loadCommercialChainFilesForEntryPoint } from "./commercialRecordChainReads";
import { getChecklistTasksWithFallback } from "./jobCardChecklist";
import { isExternalTourManagerAccess, PERMISSIONS, publicJobCard, requireStaff } from "./lib";
import { publicProposalAttachment } from "./proposalAttachments";
import { resolveTravellerGroupScope, travellerInGroupScope } from "./tourManagerGroupScope";

type ChecklistTaskFields = Pick<
  Doc<"checklistTasks">,
  "category" | "completed" | "dueDate" | "title"
>;
type CommandCenterChecklistTask =
  | (ChecklistTaskFields & Pick<Doc<"checklistTasks">, "_id">)
  | (ChecklistTaskFields & { legacyKey: string });

function publicOperationalProposalSummary(
  proposal: Doc<"proposals">,
  attachments: Doc<"proposalAttachments">[] = []
) {
  return {
    attachments: attachments
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(publicProposalAttachment),
    clientName: proposal.clientName ?? "",
    finalizedPdf: proposal.finalizedPdfStorageId
      ? {
          fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
          uploadedAt: proposal.finalizedPdfUploadedAt
            ? new Date(proposal.finalizedPdfUploadedAt).toISOString()
            : null,
        }
      : null,
    id: proposal._id,
    itinerarySummary: proposal.itinerarySummary ?? "",
    proposalCode: proposal.proposalCode,
    status: proposal.status,
  };
}

export async function handleGetCommandCenter(
  ctx: QueryCtx,
  args: {
    jobCardId: string;
    surface?: AppSurface;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  const travellerScope = await resolveTravellerGroupScope(ctx, access, job, linkedQuery);
  if (!travellerScope) {
    throw new ConvexError("FORBIDDEN");
  }
  requireAppPilotForSurface(job, args.surface);
  // Citius Connect shows the trip on the same destination photo as the customer app.
  const cover = destinationCover(job.destination);
  const linkedProposalId = job.proposalId;
  const [
    proposal,
    travellers,
    visaRecords,
    tickets,
    hotels,
    rooming,
    invoices,
    checklistTasks,
    proposalAttachments,
    commercialFiles,
  ] = await Promise.all([
    linkedProposalId ? ctx.db.get("proposals", linkedProposalId) : null,
    ctx.db
      .query("travellers")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .collect(),
    ctx.db
      .query("visaRecords")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .collect(),
    ctx.db
      .query("tickets")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .collect(),
    ctx.db
      .query("hotels")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .collect(),
    ctx.db
      .query("roomingListEntries")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .collect(),
    ctx.db
      .query("invoices")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .collect(),
    getChecklistTasksWithFallback(ctx, job),
    linkedProposalId
      ? ctx.db
          .query("proposalAttachments")
          .withIndex("by_proposalId", (q) => q.eq("proposalId", linkedProposalId))
          .collect()
      : Promise.resolve([]),
    loadCommercialChainFilesForEntryPoint(ctx, "jobCard", String(jobCardId)),
  ]);
  if (isExternalTourManagerAccess(access)) {
    // An external tour manager gets the trip, not the commercial chain: the itinerary and its
    // own group's visa and ticket statuses stay; invoices, the linked query, proposal files and
    // commercial files do not.
    const groupTravellers = travellers.filter((traveller) =>
      travellerInGroupScope(travellerScope, traveller)
    );
    const inGroup = new Set(groupTravellers.map((traveller) => String(traveller._id)));
    const wholeJobCard = travellerScope.kind === "jobCard";
    return {
      checklistTasks: [],
      commercialFiles: [],
      destinationCover: cover,
      hotels: [],
      invoices: [],
      jobCard: publicJobCard(job),
      proposal: proposal
        ? {
            ...publicOperationalProposalSummary(proposal),
            finalizedPdf: null,
          }
        : null,
      query: null,
      rooming: [],
      tickets: tickets
        .filter((ticket) =>
          ticket.travellerId ? inGroup.has(String(ticket.travellerId)) : wholeJobCard
        )
        .map((ticket) => ({ ticketStatus: ticket.ticketStatus })),
      travellers: groupTravellers.map((traveller) => ({
        passportStatus: traveller.passportStatus ?? "",
      })),
      visaRecords: visaRecords
        .filter((visa) => inGroup.has(String(visa.travellerId)))
        .map((visa) => ({ status: visa.status })),
    };
  }
  return {
    checklistTasks: checklistTasks.map((task: CommandCenterChecklistTask) => {
      const fields = {
        category: task.category,
        completed: task.completed,
        dueDate: task.dueDate,
        title: task.title,
      };
      if ("legacyKey" in task) {
        return { ...fields, legacyKey: task.legacyKey };
      }
      return { ...fields, _id: task._id };
    }),
    commercialFiles,
    destinationCover: cover,
    hotels: hotels.map((hotel) => ({ id: hotel._id })),
    invoices: invoices.map((invoice) => ({
      balanceAmount: invoice.balanceAmount,
      id: invoice._id,
    })),
    jobCard: publicJobCard(job),
    proposal: proposal ? publicOperationalProposalSummary(proposal, proposalAttachments) : null,
    query: linkedQuery
      ? {
          clientName: linkedQuery.clientName,
          contractingStatus: linkedQuery.contractingStatus,
          destination: linkedQuery.destination ?? "",
          id: linkedQuery._id,
          queryCode: linkedQuery.queryCode,
          salesStatus: linkedQuery.salesStatus,
        }
      : null,
    rooming: rooming.map((entry) => ({ id: entry._id })),
    tickets: tickets.map((ticket) => ({ ticketStatus: ticket.ticketStatus })),
    travellers: travellers
      .filter((traveller) => travellerInGroupScope(travellerScope, traveller))
      .map((traveller) => ({
        passportStatus: traveller.passportStatus ?? "",
      })),
    visaRecords: visaRecords.map((visa) => ({ status: visa.status })),
  };
}
