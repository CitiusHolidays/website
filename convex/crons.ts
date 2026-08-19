import { cronJobs, makeFunctionReference } from "convex/server";
import type { ScheduledJob } from "./operationalScheduledJobs";

const crons = cronJobs();
const runScheduledJob = makeFunctionReference<
  "action",
  { job: ScheduledJob },
  { executed: boolean }
>("operationalScheduledJobs:run");

crons.cron(
  "check cl-sl leave lapse",
  "30 18 * * *",
  runScheduledJob,
  { job: "check_cl_sl_leave_lapse" }
);

crons.cron(
  "run portal workflow nudges",
  "30 3 * * *",
  runScheduledJob,
  { job: "run_workflow_nudges" }
);

crons.cron("clean expired ai runtime data", "15 2 * * *", runScheduledJob, {
  job: "cleanup_ai_runtime",
});

crons.interval(
  "clean expired portal rate limits",
  { hours: 1 },
  runScheduledJob,
  { job: "cleanup_portal_rate_limits" }
);

crons.interval(
  "clean expired passenger exports",
  { minutes: 15 },
  runScheduledJob,
  { job: "cleanup_passenger_exports" }
);

crons.interval(
  "reconcile bounded crm metrics",
  { minutes: 15 },
  runScheduledJob,
  { job: "reconcile_crm_metrics" }
);

crons.interval(
  "reconcile crm list search text",
  { hours: 1 },
  runScheduledJob,
  { job: "reconcile_list_search" }
);

crons.interval(
  "reconcile proposal link projections",
  { hours: 1 },
  runScheduledJob,
  { job: "reconcile_proposal_links" }
);

crons.interval(
  "reconcile proposal relation summaries",
  { hours: 1 },
  runScheduledJob,
  { job: "reconcile_proposal_relations" }
);

crons.interval(
  "reconcile query commercial projections",
  { hours: 1 },
  runScheduledJob,
  { job: "reconcile_query_commercial" }
);

crons.cron(
  "purge expired commercial files",
  "15 4 * * *",
  runScheduledJob,
  { job: "purge_commercial_files" }
);

export default crons;
