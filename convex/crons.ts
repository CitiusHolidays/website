import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "check cl-sl leave lapse",
  { hourUTC: 18, minuteUTC: 30 },
  internal.crm.leaveLapse.checkAndRunClSlLapse,
  {},
);

crons.daily(
  "run portal workflow nudges",
  { hourUTC: 3, minuteUTC: 30 },
  internal.crm.workflowNudges.runScheduledNudges,
  {},
);

export default crons;
