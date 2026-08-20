import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";
import type { OperationalControlKey } from "./crm/lib/operationalControls";

export const scheduledJobValidator = v.union(
  v.literal("check_cl_sl_leave_lapse"),
  v.literal("cleanup_ai_runtime"),
  v.literal("cleanup_passenger_exports"),
  v.literal("cleanup_portal_rate_limits"),
  v.literal("cleanup_sacred_bharat_rate_limits"),
  v.literal("purge_commercial_files"),
  v.literal("reconcile_crm_metrics"),
  v.literal("reconcile_list_search"),
  v.literal("reconcile_proposal_links"),
  v.literal("reconcile_proposal_relations"),
  v.literal("reconcile_query_commercial"),
  v.literal("run_workflow_nudges")
);

export const SCHEDULED_JOBS = [
  "check_cl_sl_leave_lapse",
  "cleanup_ai_runtime",
  "cleanup_passenger_exports",
  "cleanup_portal_rate_limits",
  "cleanup_sacred_bharat_rate_limits",
  "purge_commercial_files",
  "reconcile_crm_metrics",
  "reconcile_list_search",
  "reconcile_proposal_links",
  "reconcile_proposal_relations",
  "reconcile_query_commercial",
  "run_workflow_nudges",
] as const;

export type ScheduledJob = (typeof SCHEDULED_JOBS)[number];

const CONTROL_KEY_BY_JOB = {
  check_cl_sl_leave_lapse: "jobs.check_cl_sl_leave_lapse",
  cleanup_ai_runtime: "jobs.cleanup_ai_runtime",
  cleanup_passenger_exports: "jobs.cleanup_passenger_exports",
  cleanup_portal_rate_limits: "jobs.cleanup_portal_rate_limits",
  cleanup_sacred_bharat_rate_limits: "jobs.cleanup_sacred_bharat_rate_limits",
  purge_commercial_files: "jobs.purge_commercial_files",
  reconcile_crm_metrics: "jobs.reconcile_crm_metrics",
  reconcile_list_search: "jobs.reconcile_list_search",
  reconcile_proposal_links: "jobs.reconcile_proposal_links",
  reconcile_proposal_relations: "jobs.reconcile_proposal_relations",
  reconcile_query_commercial: "jobs.reconcile_query_commercial",
  run_workflow_nudges: "jobs.run_workflow_nudges",
} as const satisfies Record<ScheduledJob, OperationalControlKey>;

export function scheduledJobControlKey(job: ScheduledJob) {
  return CONTROL_KEY_BY_JOB[job];
}

async function executeScheduledJob(ctx: ActionCtx, job: ScheduledJob) {
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
    case "cleanup_sacred_bharat_rate_limits":
      await ctx.runMutation(internal.sacredBharatEditionEvents.cleanupExpiredRateLimitKeys, {});
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
      return;
    default:
      throw new Error("Unknown scheduled job.");
  }
}

async function runControlledScheduledJob(ctx: ActionCtx, job: ScheduledJob) {
  const effectId = `scheduled-job:${job}:${Date.now()}:${crypto.randomUUID()}`;
  const control = await ctx.runMutation(internal.crm.settings.beginOperationalEffectInternal, {
    effectId,
    key: scheduledJobControlKey(job),
  });
  if (!control.enabled) {
    return { executed: false };
  }
  await executeScheduledJob(ctx, job);
  await ctx.runMutation(internal.crm.settings.recordOperationalEffectInternal, {
    ...control,
    disposition: "created",
    effectId: `${effectId}:completed`,
  });
  return { executed: true };
}

function controlledScheduledHandler(job: ScheduledJob) {
  return async (ctx: ActionCtx) => await runControlledScheduledJob(ctx, job);
}

const scheduledJobResult = v.object({ executed: v.boolean() });

export const checkClSlLeaveLapse = internalAction({
  args: {},
  handler: controlledScheduledHandler("check_cl_sl_leave_lapse"),
  returns: scheduledJobResult,
});

export const cleanupAiRuntime = internalAction({
  args: {},
  handler: controlledScheduledHandler("cleanup_ai_runtime"),
  returns: scheduledJobResult,
});

export const cleanupPassengerExports = internalAction({
  args: {},
  handler: controlledScheduledHandler("cleanup_passenger_exports"),
  returns: scheduledJobResult,
});

export const cleanupPortalRateLimits = internalAction({
  args: {},
  handler: controlledScheduledHandler("cleanup_portal_rate_limits"),
  returns: scheduledJobResult,
});

export const cleanupSacredBharatRateLimits = internalAction({
  args: {},
  handler: controlledScheduledHandler("cleanup_sacred_bharat_rate_limits"),
  returns: scheduledJobResult,
});

export const purgeCommercialFiles = internalAction({
  args: {},
  handler: controlledScheduledHandler("purge_commercial_files"),
  returns: scheduledJobResult,
});

export const reconcileCrmMetrics = internalAction({
  args: {},
  handler: controlledScheduledHandler("reconcile_crm_metrics"),
  returns: scheduledJobResult,
});

export const reconcileListSearch = internalAction({
  args: {},
  handler: controlledScheduledHandler("reconcile_list_search"),
  returns: scheduledJobResult,
});

export const reconcileProposalLinks = internalAction({
  args: {},
  handler: controlledScheduledHandler("reconcile_proposal_links"),
  returns: scheduledJobResult,
});

export const reconcileProposalRelations = internalAction({
  args: {},
  handler: controlledScheduledHandler("reconcile_proposal_relations"),
  returns: scheduledJobResult,
});

export const reconcileQueryCommercial = internalAction({
  args: {},
  handler: controlledScheduledHandler("reconcile_query_commercial"),
  returns: scheduledJobResult,
});

export const runWorkflowNudges = internalAction({
  args: {},
  handler: controlledScheduledHandler("run_workflow_nudges"),
  returns: scheduledJobResult,
});

export const run = internalAction({
  args: { job: scheduledJobValidator },
  handler: async (ctx, args) => await runControlledScheduledJob(ctx, args.job),
  returns: v.object({ executed: v.boolean() }),
});
