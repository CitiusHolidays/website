import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";

export const scheduledJobValidator = v.union(
  v.literal("check_cl_sl_leave_lapse"),
  v.literal("cleanup_ai_runtime"),
  v.literal("cleanup_passenger_exports"),
  v.literal("cleanup_portal_rate_limits"),
  v.literal("purge_commercial_files"),
  v.literal("reconcile_crm_metrics"),
  v.literal("reconcile_list_search"),
  v.literal("reconcile_proposal_links"),
  v.literal("reconcile_proposal_relations"),
  v.literal("reconcile_query_commercial"),
  v.literal("run_workflow_nudges")
);

export type ScheduledJob =
  | "check_cl_sl_leave_lapse"
  | "cleanup_ai_runtime"
  | "cleanup_passenger_exports"
  | "cleanup_portal_rate_limits"
  | "purge_commercial_files"
  | "reconcile_crm_metrics"
  | "reconcile_list_search"
  | "reconcile_proposal_links"
  | "reconcile_proposal_relations"
  | "reconcile_query_commercial"
  | "run_workflow_nudges";

async function executeScheduledJob(
  ctx: ActionCtx,
  job: ScheduledJob
) {
  switch (job) {
    case "check_cl_sl_leave_lapse":
      await ctx.runMutation(internal.crm.leaveLapse.checkAndRunClSlLapse, {});
      return;
    case "cleanup_ai_runtime":
      await ctx.runMutation(internal.aiRuntime.cleanupExpired, {});
      return;
    case "cleanup_passenger_exports":
      await ctx.runMutation(internal.crm.imports.purgeExpiredPassengerExports, {});
      return;
    case "cleanup_portal_rate_limits":
      await ctx.runMutation(internal.crm.rateLimitMaintenance.cleanupExpired, {});
      return;
    case "purge_commercial_files":
      await ctx.runMutation(internal.crm.commercialFiles.purgeExpired, {});
      return;
    case "reconcile_crm_metrics":
      await ctx.runMutation(internal.crm.metricAggregates.reconcileAll, {});
      return;
    case "reconcile_list_search":
      await ctx.runMutation(internal.crm.listSearch.reconcileAll, {});
      return;
    case "reconcile_proposal_links":
      await ctx.runMutation(
        internal.crm.proposalLinkProjection.reconcileProposalLinkProjections,
        {}
      );
      return;
    case "reconcile_proposal_relations":
      await ctx.runMutation(internal.crm.proposalRelationSummary.reconcileAll, {});
      return;
    case "reconcile_query_commercial":
      await ctx.runMutation(internal.crm.queryCommercialProjection.reconcileAll, {});
      return;
    case "run_workflow_nudges":
      await ctx.runMutation(internal.crm.workflowNudges.runScheduledNudges, {});
  }
}

export const run = internalAction({
  args: { job: scheduledJobValidator },
  handler: async (ctx, args) => {
    const { controls } = await ctx.runQuery(
      internal.crm.settings.resolveOperationalControlsInternal,
      { at: Date.now(), keys: ["jobs.scheduled"] }
    );
    if (!controls[0]?.enabled) {
      return { executed: false };
    }
    await executeScheduledJob(ctx, args.job);
    return { executed: true };
  },
  returns: v.object({ executed: v.boolean() }),
});
