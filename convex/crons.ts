import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "check cl-sl leave lapse",
  { hourUTC: 18, minuteUTC: 30 },
  internal.crm.leaveLapse.checkAndRunClSlLapse,
  {}
);

crons.daily(
  "run portal workflow nudges",
  { hourUTC: 3, minuteUTC: 30 },
  internal.crm.workflowNudges.runScheduledNudges,
  {}
);

crons.daily(
  "clean expired ai runtime data",
  { hourUTC: 2, minuteUTC: 15 },
  internal.aiRuntime.cleanupExpired,
  {}
);

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

crons.daily(
  "purge expired commercial files",
  { hourUTC: 4, minuteUTC: 15 },
  internal.crm.commercialFiles.purgeExpired,
  {}
);

export default crons;
