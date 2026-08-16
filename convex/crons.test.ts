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
    args: [{}],
    name: "crm/leaveLapse:checkAndRunClSlLapse",
    schedule: { cron: "30 18 * * *", type: "cron" },
  },
  "clean expired ai runtime data": {
    args: [{}],
    name: "aiRuntime:cleanupExpired",
    schedule: { cron: "15 2 * * *", type: "cron" },
  },
  "clean expired passenger exports": {
    args: [{}],
    name: "crm/imports:purgeExpiredPassengerExports",
    schedule: { minutes: 15, type: "interval" },
  },
  "clean expired portal rate limits": {
    args: [{}],
    name: "crm/rateLimitMaintenance:cleanupExpired",
    schedule: { hours: 1, type: "interval" },
  },
  "purge expired commercial files": {
    args: [{}],
    name: "crm/commercialFiles:purgeExpired",
    schedule: { cron: "15 4 * * *", type: "cron" },
  },
  "reconcile bounded crm metrics": {
    args: [{}],
    name: "crm/metricAggregates:reconcileAll",
    schedule: { minutes: 15, type: "interval" },
  },
  "reconcile crm list search text": {
    args: [{}],
    name: "crm/listSearch:reconcileAll",
    schedule: { hours: 1, type: "interval" },
  },
  "reconcile proposal link projections": {
    args: [{}],
    name: "crm/proposalLinkProjection:reconcileProposalLinkProjections",
    schedule: { hours: 1, type: "interval" },
  },
  "reconcile proposal relation summaries": {
    args: [{}],
    name: "crm/proposalRelationSummary:reconcileAll",
    schedule: { hours: 1, type: "interval" },
  },
  "reconcile query commercial projections": {
    args: [{}],
    name: "crm/queryCommercialProjection:reconcileAll",
    schedule: { hours: 1, type: "interval" },
  },
  "run portal workflow nudges": {
    args: [{}],
    name: "crm/workflowNudges:runScheduledNudges",
    schedule: { cron: "30 3 * * *", type: "cron" },
  },
} satisfies Record<string, SerializedCron>;

describe("Convex cron registry", () => {
  test("registers the exact eleven internal jobs, arguments, and schedules", () => {
    // SAFETY: Convex Crons stores its serializable registry on this runtime-owned field.
    const registry = (crons as typeof crons & { crons: Record<string, SerializedCron> }).crons;

    expect(Object.keys(registry).sort()).toEqual(Object.keys(EXPECTED_CRONS).sort());
    expect(registry).toEqual(EXPECTED_CRONS);
    expect(new Set(Object.keys(registry)).size).toBe(11);
    expect(Object.values(registry).every((job) => !job.name.startsWith("api."))).toBe(true);
  });

  test("the daily lapse boundary is exactly 31 March in IST", () => {
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
