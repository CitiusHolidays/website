import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { loadCommercialChainFilesForEntryPoint } from "./commercialRecordChainReads";
import { getChecklistTasksWithFallback } from "./jobCardChecklist";
import { canSeeJobCardRecord, PERMISSIONS, publicJobCard, requireStaff } from "./lib";
import { publicProposalAttachment } from "./proposalAttachments";

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
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
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
    travellers: travellers.map((traveller) => ({
      passportStatus: traveller.passportStatus ?? "",
    })),
    visaRecords: visaRecords.map((visa) => ({ status: visa.status })),
  };
}
