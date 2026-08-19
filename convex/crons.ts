import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();
const scheduledJob = (name: string) =>
  makeFunctionReference<"action", Record<string, never>, { executed: boolean }>(name);

crons.cron(
  "check cl-sl leave lapse",
  "30 18 * * *",
  scheduledJob("operationalScheduledJobs:checkClSlLeaveLapse"),
  {}
);

crons.cron(
  "run portal workflow nudges",
  "30 3 * * *",
  scheduledJob("operationalScheduledJobs:runWorkflowNudges"),
  {}
);

crons.cron(
  "clean expired ai runtime data",
  "15 2 * * *",
  scheduledJob("operationalScheduledJobs:cleanupAiRuntime"),
  {}
);

crons.interval(
  "clean expired portal rate limits",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:cleanupPortalRateLimits"),
  {}
);

crons.interval(
  "clean expired sacred bharat rate limits",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:cleanupSacredBharatRateLimits"),
  {}
);

crons.interval(
  "clean expired passenger exports",
  { minutes: 15 },
  scheduledJob("operationalScheduledJobs:cleanupPassengerExports"),
  {}
);

crons.interval(
  "reconcile bounded crm metrics",
  { minutes: 15 },
  scheduledJob("operationalScheduledJobs:reconcileCrmMetrics"),
  {}
);

crons.interval(
  "reconcile crm list search text",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:reconcileListSearch"),
  {}
);

crons.interval(
  "reconcile proposal link projections",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:reconcileProposalLinks"),
  {}
);

crons.interval(
  "reconcile proposal relation summaries",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:reconcileProposalRelations"),
  {}
);

crons.interval(
  "reconcile query commercial projections",
  { hours: 1 },
  scheduledJob("operationalScheduledJobs:reconcileQueryCommercial"),
  {}
);

crons.cron(
  "purge expired commercial files",
  "15 4 * * *",
  scheduledJob("operationalScheduledJobs:purgeCommercialFiles"),
  {}
);

export default crons;
