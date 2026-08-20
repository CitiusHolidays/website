import type { FunctionReference } from "convex/server";
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

const MUTATION_BY_JOB = {
  check_cl_sl_leave_lapse: {
    mutation: internal.crm.leaveLapse.checkAndRunClSlLapse,
    mutationName: "crm/leaveLapse:checkAndRunClSlLapse",
  },
  cleanup_ai_runtime: {
    mutation: internal.aiRuntime.cleanupExpired,
    mutationName: "aiRuntime:cleanupExpired",
  },
  cleanup_passenger_exports: {
    mutation: internal.crm.imports.purgeExpiredPassengerExports,
    mutationName: "crm/imports:purgeExpiredPassengerExports",
  },
  cleanup_portal_rate_limits: {
    mutation: internal.crm.rateLimitMaintenance.cleanupExpired,
    mutationName: "crm/rateLimitMaintenance:cleanupExpired",
  },
  cleanup_sacred_bharat_rate_limits: {
    mutation: internal.sacredBharatEditionEvents.cleanupExpiredRateLimitKeys,
    mutationName: "sacredBharatEditionEvents:cleanupExpiredRateLimitKeys",
  },
  purge_commercial_files: {
    mutation: internal.crm.commercialFiles.purgeExpired,
    mutationName: "crm/commercialFiles:purgeExpired",
  },
  reconcile_crm_metrics: {
    mutation: internal.crm.metricAggregates.reconcileAll,
    mutationName: "crm/metricAggregates:reconcileAll",
  },
  reconcile_list_search: {
    mutation: internal.crm.listSearch.reconcileAll,
    mutationName: "crm/listSearch:reconcileAll",
  },
  reconcile_proposal_links: {
    mutation: internal.crm.proposalLinkProjection.reconcileProposalLinkProjections,
    mutationName: "crm/proposalLinkProjection:reconcileProposalLinkProjections",
  },
  reconcile_proposal_relations: {
    mutation: internal.crm.proposalRelationSummary.reconcileAll,
    mutationName: "crm/proposalRelationSummary:reconcileAll",
  },
  reconcile_query_commercial: {
    mutation: internal.crm.queryCommercialProjection.reconcileAll,
    mutationName: "crm/queryCommercialProjection:reconcileAll",
  },
  run_workflow_nudges: {
    mutation: internal.crm.workflowNudges.runScheduledNudges,
    mutationName: "crm/workflowNudges:runScheduledNudges",
  },
} as const satisfies Record<
  ScheduledJob,
  {
    mutation: FunctionReference<"mutation", "internal">;
    mutationName: string;
  }
>;

export interface ScheduledJobDispatch {
  job: ScheduledJob;
  mutationName: (typeof MUTATION_BY_JOB)[ScheduledJob]["mutationName"];
}

export function scheduledJobControlKey(job: ScheduledJob) {
  return CONTROL_KEY_BY_JOB[job];
}

export async function executeScheduledJobBoundary(
  job: ScheduledJob,
  dispatch: (target: ScheduledJobDispatch) => Promise<void>
) {
  await dispatch({ job, mutationName: MUTATION_BY_JOB[job].mutationName });
}

async function executeScheduledJob(ctx: ActionCtx, job: ScheduledJob) {
  await ctx.runMutation(MUTATION_BY_JOB[job].mutation, {});
}

export async function runControlledScheduledJob(ctx: ActionCtx, job: ScheduledJob) {
  const effectId = `scheduled-job:${job}:${Date.now()}:${crypto.randomUUID()}`;
  const control = await ctx.runMutation(internal.crm.settings.beginOperationalEffectInternal, {
    effectId,
    key: scheduledJobControlKey(job),
  });
  if (!control.enabled) {
    return { executed: false };
  }
  try {
    await executeScheduledJob(ctx, job);
  } catch (error) {
    await ctx.runMutation(internal.crm.settings.recordOperationalEffectInternal, {
      ...control,
      disposition: "failed",
      effectId: `${effectId}:failed`,
    });
    throw error;
  }
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
