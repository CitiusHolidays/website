import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "check cl-sl leave lapse",
  "30 18 * * *",
  internal.crm.leaveLapse.checkAndRunClSlLapse,
  {}
);

crons.cron(
  "run portal workflow nudges",
  "30 3 * * *",
  internal.crm.workflowNudges.runScheduledNudges,
  {}
);

crons.cron("clean expired ai runtime data", "15 2 * * *", internal.aiRuntime.cleanupExpired, {});

crons.interval(
  "clean expired portal rate limits",
  { hours: 1 },
  internal.crm.rateLimitMaintenance.cleanupExpired,
  {}
);

crons.interval(
  "clean expired passenger exports",
  { minutes: 15 },
  internal.crm.imports.purgeExpiredPassengerExports,
  {}
);

crons.interval(
  "reconcile bounded crm metrics",
  { minutes: 15 },
  internal.crm.metricAggregates.reconcileAll,
  {}
);

crons.interval(
  "reconcile crm list search text",
  { hours: 1 },
  internal.crm.listSearch.reconcileAll,
  {}
);

crons.interval(
  "reconcile proposal link projections",
  { hours: 1 },
  internal.crm.proposalLinkProjection.reconcileProposalLinkProjections,
  {}
);

crons.cron(
  "purge expired commercial files",
  "15 4 * * *",
  internal.crm.commercialFiles.purgeExpired,
  {}
);

export default crons;
