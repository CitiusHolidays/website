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

export default crons;
