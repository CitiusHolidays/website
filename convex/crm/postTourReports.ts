import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import {
  emptyPostTourReport,
  postTourReportContentValidator,
  postTourReportError,
} from "../lib/postTourReportContent";
import { createActivity } from "./lib/activity";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { publishWorkNotification } from "./lib/notifications";
import { canPreparePostTourReport } from "./lib/postTourReportAccess";
import { canSeeJobCardRecord } from "./lib/recordScope";
import { type PortalAccess, requireStaff } from "./lib/staffAccess";

type Ctx = QueryCtx | MutationCtx;
async function activeReport(ctx: Ctx, jobCardId: Id<"jobCards">) {
  const draft = await ctx.db
    .query("postTourReports")
    .withIndex("by_jobCardId_status", (q) => q.eq("jobCardId", jobCardId).eq("status", "draft"))
    .first();
  return (
    draft ??
    (await ctx.db
      .query("postTourReports")
      .withIndex("by_jobCardId_status", (q) =>
        q.eq("jobCardId", jobCardId).eq("status", "submitted")
      )
      .first())
  );
}
async function projection(
  ctx: Ctx,
  access: PortalAccess,
  report: Doc<"postTourReports">,
  job: Doc<"jobCards">
) {
  const admin = access.roles.includes("Admin");
  const canPrepare = await canPreparePostTourReport(ctx, access, job);
  if (
    (report.status === "draft" && !canPrepare && !admin) ||
    (report.status === "archived" && !admin)
  ) {
    return null;
  }
  return {
    canArchive: admin,
    canEdit: report.status === "draft" && canPrepare,
    canRestore: admin && report.status === "archived",
    content: report.content,
    id: report._id,
    preparedBy: report.submittedByName ?? report.createdByName,
    revision: report.revision,
    status: report.status,
    submittedAt: report.submittedAt ?? null,
    updatedAt: report.updatedAt,
  };
}
async function reportJob(ctx: Ctx, args: { jobCardId?: string; reportId?: string }) {
  const linkedReportId = args.reportId
    ? ctx.db.normalizeId("postTourReports", args.reportId)
    : null;
  const linkedReport = linkedReportId ? await ctx.db.get("postTourReports", linkedReportId) : null;
  const id = args.jobCardId
    ? ctx.db.normalizeId("jobCards", args.jobCardId)
    : (linkedReport?.jobCardId ?? null);
  if (args.reportId && !linkedReport) {
    return null;
  }
  if (linkedReport && id !== linkedReport.jobCardId) {
    return null;
  }
  return id ? await ctx.db.get("jobCards", id) : null;
}
export const workspace = query({
  args: { jobCardId: v.optional(v.string()), reportId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const job = await reportJob(ctx, args);
    if (!job) {
      return null;
    }
    const requestedId = args.reportId ? ctx.db.normalizeId("postTourReports", args.reportId) : null;
    const report = requestedId
      ? await ctx.db.get("postTourReports", requestedId)
      : await activeReport(ctx, job._id);
    const canPrepare = await canPreparePostTourReport(ctx, access, job);
    const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
    const admin = access.roles.includes("Admin");
    if (report?.status === "archived" && !admin) {
      return null;
    }
    if (
      !(canPrepare || admin) &&
      report?.status !== "submitted" &&
      !canSeeJobCardRecord(access, job, linkedQuery)
    ) {
      return null;
    }
    const archived = admin
      ? await ctx.db
          .query("postTourReports")
          .withIndex("by_jobCardId_status", (q) =>
            q.eq("jobCardId", job._id).eq("status", "archived")
          )
          .order("desc")
          .take(20)
      : [];
    const managers = await ctx.db
      .query("tourManagerAssignments")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
      .take(30);
    const managerNames = managers
      .filter((row) => row.status === "Assigned")
      .map((row) => row.name)
      .join(", ");
    return {
      archived: (
        await Promise.all(archived.map((row) => projection(ctx, access, row, job)))
      ).filter((row) => row !== null),
      canPrepare,
      initial: emptyPostTourReport({
        client: job.clientName,
        destination: job.destination ?? "",
        endDate: job.travelEndDate ?? "",
        guests: job.confirmedPax || null,
        programme: job.queryType === "MICE" ? "MICE / Corporate" : "",
        startDate: job.travelStartDate ?? "",
        tourManager: managerNames || job.tourManagerName || "",
      }),
      jobCardId: job._id,
      jobCode: job.jobCode,
      report:
        report && report.status !== "archived" ? await projection(ctx, access, report, job) : null,
      viewerKey: access.staffId ?? access.authUserId ?? "",
      viewerName: access.name,
    };
  },
});
async function editable(ctx: MutationCtx, id: Id<"postTourReports">) {
  const access = await requireStaff(ctx);
  const report = await ctx.db.get("postTourReports", id);
  const job = report ? await ctx.db.get("jobCards", report.jobCardId) : null;
  if (!(report && job)) {
    throw new ConvexError("Report or Job Card is no longer available.");
  }
  return { access, job, report };
}
function revisionMatches(actual: number, expected: number) {
  if (actual !== expected) {
    throw new ConvexError(
      "This report changed in another session. Reload it before saving; your local draft is retained."
    );
  }
}
export const saveDraft = mutation({
  args: {
    content: postTourReportContentValidator,
    expectedRevision: v.number(),
    jobCardId: v.id("jobCards"),
    reportId: v.optional(v.id("postTourReports")),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const job = await ctx.db.get("jobCards", args.jobCardId);
    if (!(job && access.staffId && (await canPreparePostTourReport(ctx, access, job)))) {
      throw new ConvexError("FORBIDDEN");
    }
    const error = postTourReportError(args.content, false);
    if (error) {
      throw new ConvexError(error);
    }
    const current = await activeReport(ctx, job._id);
    if (current?.status === "submitted") {
      throw new ConvexError("This report is already submitted and cannot be edited.");
    }
    if (current?._id !== args.reportId) {
      throw new ConvexError(
        "This report changed in another session. Your local draft is retained; reload the saved report before retrying."
      );
    }
    revisionMatches(current?.revision ?? 0, args.expectedRevision);
    const now = Date.now();
    const revision = (current?.revision ?? 0) + 1;
    let id: Id<"postTourReports">;
    if (current) {
      await patchWithE2eOwnership(
        ctx,
        "postTourReports",
        current._id,
        { content: args.content, revision, updatedAt: now },
        { authUserId: access.authUserId }
      );
      id = current._id;
    } else {
      id = await insertWithE2eOwnership(
        ctx,
        "postTourReports",
        {
          content: args.content,
          createdAt: now,
          createdByName: access.name,
          createdByStaffId: access.staffId,
          jobCardId: job._id,
          revision,
          status: "draft",
          updatedAt: now,
        },
        { authUserId: access.authUserId }
      );
    }
    await createActivity(ctx, access, {
      action: "draft_saved",
      entityId: id,
      entityType: "postTourReport",
      message: `${job.jobCode} internal tour report draft saved`,
    });
    return { id, revision };
  },
});
export const submit = mutation({
  args: { expectedRevision: v.number(), reportId: v.id("postTourReports") },
  handler: async (ctx, args) => {
    const { access, report, job } = await editable(ctx, args.reportId);
    if (!(access.staffId && (await canPreparePostTourReport(ctx, access, job)))) {
      throw new ConvexError("FORBIDDEN");
    }
    if (report.status === "submitted") {
      return { id: report._id };
    }
    if (report.status !== "draft") {
      throw new ConvexError("This report is archived.");
    }
    revisionMatches(report.revision, args.expectedRevision);
    const error = postTourReportError(report.content, true);
    if (error) {
      throw new ConvexError(error);
    }
    const now = Date.now();
    await patchWithE2eOwnership(
      ctx,
      "postTourReports",
      report._id,
      {
        revision: report.revision + 1,
        status: "submitted",
        submittedAt: now,
        submittedByName: access.name,
        submittedByStaffId: access.staffId,
        updatedAt: now,
      },
      { authUserId: access.authUserId }
    );
    await createActivity(ctx, access, {
      action: "submitted",
      entityId: report._id,
      entityType: "postTourReport",
      message: `${job.jobCode} internal tour report submitted`,
    });
    await publishWorkNotification(ctx, "post_tour_submission", {
      body: `The internal report for ${job.jobCode} is ready to read in Citius Connect.`,
      entityId: report._id,
      entityType: "postTourReport",
      title: "Post-tour report submitted",
    });
    return { id: report._id };
  },
});
export const archive = mutation({
  args: {
    expectedRevision: v.number(),
    reportId: v.id("postTourReports"),
    restore: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { access, report, job } = await editable(ctx, args.reportId);
    if (!access.roles.includes("Admin")) {
      throw new ConvexError("FORBIDDEN");
    }
    revisionMatches(report.revision, args.expectedRevision);
    if (args.restore) {
      if (report.status !== "archived" || !report.previousStatus) {
        throw new ConvexError("This report is not archived.");
      }
      if (await activeReport(ctx, job._id)) {
        throw new ConvexError(
          "A current report already exists for this Job Card. Archive it before restoring this report."
        );
      }
    } else if (report.status === "archived") {
      throw new ConvexError("This report is already archived.");
    }
    const status = args.restore ? (report.previousStatus ?? "draft") : "archived";
    const archiveStatus = report.status === "draft" ? "draft" : "submitted";
    await patchWithE2eOwnership(
      ctx,
      "postTourReports",
      report._id,
      {
        archivedAt: args.restore ? undefined : Date.now(),
        archivedByStaffId: args.restore ? undefined : access.staffId,
        previousStatus: args.restore ? undefined : archiveStatus,
        revision: report.revision + 1,
        status,
        submissionAlertsCancelled: true,
        updatedAt: Date.now(),
      },
      { authUserId: access.authUserId }
    );
    await createActivity(ctx, access, {
      action: args.restore ? "restored" : "archived",
      entityId: report._id,
      entityType: "postTourReport",
      message: `${job.jobCode} internal tour report ${args.restore ? "restored" : "archived"}`,
    });
    return { id: report._id };
  },
});
