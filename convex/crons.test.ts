import { describe, expect, test } from "bun:test";
import { fiscalYearEndingOn31March, isClSlLapseDay } from "./crm/leaveLapse";
import crons from "./crons";

interface SerializedCron {
  args: unknown[];
  name: string;
  schedule: Record<string, number | string>;
}

const EXPECTED_CRONS = {
  "check cl-sl leave lapse": {
    args: [{ job: "check_cl_sl_leave_lapse" }],
    name: "operationalScheduledJobs:run",
    schedule: { cron: "30 18 * * *", type: "cron" },
  },
  "clean expired ai runtime data": {
    args: [{ job: "cleanup_ai_runtime" }],
    name: "operationalScheduledJobs:run",
    schedule: { cron: "15 2 * * *", type: "cron" },
  },
  "clean expired passenger exports": {
    args: [{ job: "cleanup_passenger_exports" }],
    name: "operationalScheduledJobs:run",
    schedule: { minutes: 15, type: "interval" },
  },
  "clean expired portal rate limits": {
    args: [{ job: "cleanup_portal_rate_limits" }],
    name: "operationalScheduledJobs:run",
    schedule: { hours: 1, type: "interval" },
  },
  "purge expired commercial files": {
    args: [{ job: "purge_commercial_files" }],
    name: "operationalScheduledJobs:run",
    schedule: { cron: "15 4 * * *", type: "cron" },
  },
  "reconcile bounded crm metrics": {
    args: [{ job: "reconcile_crm_metrics" }],
    name: "operationalScheduledJobs:run",
    schedule: { minutes: 15, type: "interval" },
  },
  "reconcile crm list search text": {
    args: [{ job: "reconcile_list_search" }],
    name: "operationalScheduledJobs:run",
    schedule: { hours: 1, type: "interval" },
  },
  "reconcile proposal link projections": {
    args: [{ job: "reconcile_proposal_links" }],
    name: "operationalScheduledJobs:run",
    schedule: { hours: 1, type: "interval" },
  },
  "reconcile proposal relation summaries": {
    args: [{ job: "reconcile_proposal_relations" }],
    name: "operationalScheduledJobs:run",
    schedule: { hours: 1, type: "interval" },
  },
  "reconcile query commercial projections": {
    args: [{ job: "reconcile_query_commercial" }],
    name: "operationalScheduledJobs:run",
    schedule: { hours: 1, type: "interval" },
  },
  "run portal workflow nudges": {
    args: [{ job: "run_workflow_nudges" }],
    name: "operationalScheduledJobs:run",
    schedule: { cron: "30 3 * * *", type: "cron" },
  },
} satisfies Record<string, SerializedCron>;

describe("Convex cron registry", () => {
  test("Registers the exact eleven internal jobs, arguments, and schedules", () => {
    // SAFETY: Convex Crons stores its serializable registry on this runtime-owned field.
    const registry = (crons as typeof crons & { crons: Record<string, SerializedCron> }).crons;

    expect(Object.keys(registry).sort()).toEqual(Object.keys(EXPECTED_CRONS).sort());
    expect(registry).toEqual(EXPECTED_CRONS);
    expect(new Set(Object.keys(registry)).size).toBe(11);
    expect(Object.values(registry).every((job) => !job.name.startsWith("api."))).toBe(true);
  });

  test("The daily lapse boundary is exactly 31 March in IST", () => {
    const march30EndIst = new Date("2025-03-30T18:29:59.999Z");
    const march31StartIst = new Date("2025-03-30T18:30:00.000Z");
    const march31EndIst = new Date("2025-03-31T18:29:59.999Z");
    const april1StartIst = new Date("2025-03-31T18:30:00.000Z");

    expect(isClSlLapseDay(march30EndIst)).toBe(false);
    expect(isClSlLapseDay(march31StartIst)).toBe(true);
    expect(fiscalYearEndingOn31March(march31StartIst)).toBe("2024-2025");
    expect(isClSlLapseDay(march31EndIst)).toBe(true);
    expect(isClSlLapseDay(april1StartIst)).toBe(false);
    expect(fiscalYearEndingOn31March(april1StartIst)).toBeNull();
  });
});
