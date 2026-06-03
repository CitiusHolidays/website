import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "check cl-sl leave lapse",
  { hourUTC: 18, minuteUTC: 30 },
  internal.crm.leaveLapse.checkAndRunClSlLapse,
  {},
);

export default crons;
