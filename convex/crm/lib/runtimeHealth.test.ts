import { describe, expect, test } from "bun:test";
import { SCHEDULED_JOBS, scheduledJobControlKey } from "../../operationalScheduledJobs";
import { composeRuntimeHealth } from "./runtimeHealth";

const NOW = Date.parse("2026-08-30T12:00:00.000Z");

function enabledControls() {
  return new Map(
    SCHEDULED_JOBS.map((job) => {
      const key = scheduledJobControlKey(job);
      return [key, { enabled: true, key, reason: "configured_default" }] as const;
    })
  );
}

function baseInput() {
  return {
    at: NOW,
    controls: enabledControls(),
    listDirty: null,
    listReadiness: [null, null, null, null],
    metricDirty: null,
    metricReadiness: null,
    notificationEmailReadiness: null,
    notificationUnreadReadiness: null,
    proposalAttachmentReadiness: null,
    scheduledReceipts: new Map(),
    workflowNudgeRun: null,
  } satisfies Parameters<typeof composeRuntimeHealth>[0];
}

describe("exact-Admin runtime health composition", () => {
  test("keeps missing, paused, suppressed, stale, reconciling, and failed evidence distinct", () => {
    const controls = enabledControls();
    controls.set("jobs.reconcile_crm_metrics", {
      enabled: false,
      key: "jobs.reconcile_crm_metrics",
      reason: "explicit_disabled",
    });
    controls.set("jobs.reconcile_list_search", {
      enabled: false,
      key: "jobs.reconcile_list_search",
      reason: "prerequisite_disabled",
    });
    const receipts = new Map([
      [
        "cleanup_ai_runtime",
        { createdAt: NOW - 1000, disposition: "created", effectId: "record-id-sentinel" },
      ],
      ["cleanup_passenger_exports", { createdAt: NOW - 1000, disposition: "queued" }],
      [
        "cleanup_portal_rate_limits",
        {
          createdAt: NOW - 1000,
          disposition: "failed",
          providerBody: "provider-body-sentinel",
        },
      ],
      [
        "cleanup_sacred_bharat_rate_limits",
        { createdAt: NOW - 4 * 60 * 60 * 1000, disposition: "created" },
      ],
    ]);

    const result = composeRuntimeHealth({
      ...baseInput(),
      controls,
      // SAFETY: each fixture has the required receipt fields; extra private fields prove projection.
      scheduledReceipts: receipts as Parameters<
        typeof composeRuntimeHealth
      >[0]["scheduledReceipts"],
    });
    const statuses = new Map(result.scheduledJobs.map((job) => [job.key, job.status]));

    expect(statuses.get("cleanup_ai_runtime")).toBe("ready");
    expect(statuses.get("cleanup_passenger_exports")).toBe("reconciling");
    expect(statuses.get("cleanup_portal_rate_limits")).toBe("degraded");
    expect(statuses.get("cleanup_sacred_bharat_rate_limits")).toBe("stale");
    expect(statuses.get("purge_commercial_files")).toBe("not_observed");
    expect(statuses.get("reconcile_crm_metrics")).toBe("paused");
    expect(statuses.get("reconcile_list_search")).toBe("suppressed");
    expect(result.projections.every((projection) => projection.status === "not_observed")).toBe(
      true
    );
    expect(result.workflowNudges.status).toBe("not_observed");
    expect(JSON.stringify(result)).not.toContain("record-id-sentinel");
    expect(JSON.stringify(result)).not.toContain("provider-body-sentinel");
  });

  test("reports only current projection evidence as ready and ages pending work to stale", () => {
    const current = composeRuntimeHealth({
      ...baseInput(),
      listReadiness: ["queries", "jobCards", "proposals", "travellers"].map(() => ({
        ready: true,
        reconciling: false,
        startedAt: NOW - 5000,
        updatedAt: NOW - 1000,
        version: 2,
      })),
      metricReadiness: {
        generation: 4,
        lastCompletedAt: NOW - 1000,
        lastCompletedGeneration: 4,
        lastCompletedMetricVersion: 4,
        startedAt: NOW - 5000,
        updatedAt: NOW - 1000,
      },
      notificationEmailReadiness: {
        ready: true,
        startedAt: NOW - 5000,
        status: "complete",
        updatedAt: NOW - 1000,
        version: 1,
      },
      notificationUnreadReadiness: {
        ready: true,
        startedAt: NOW - 5000,
        status: "complete",
        updatedAt: NOW - 1000,
        version: 1,
      },
      proposalAttachmentReadiness: {
        ready: true,
        reconciling: false,
        startedAt: NOW - 5000,
        updatedAt: NOW - 1000,
        version: 1,
      },
      workflowNudgeRun: {
        consecutiveFailedRuns: 0,
        status: "completed",
        updatedAt: NOW - 1000,
      },
    });

    expect(current.projections.every((projection) => projection.status === "ready")).toBe(true);
    expect(current.workflowNudges.status).toBe("ready");

    const stale = composeRuntimeHealth({
      ...baseInput(),
      listDirty: { updatedAt: NOW - 2 * 60 * 60 * 1000 },
      listReadiness: current.projections.slice(0, 4).map(() => ({
        ready: true,
        reconciling: false,
        updatedAt: NOW - 1000,
        version: 2,
      })),
      metricDirty: { updatedAt: NOW - 2 * 60 * 60 * 1000 },
      metricReadiness: {
        generation: 4,
        lastCompletedAt: NOW - 3 * 60 * 60 * 1000,
        lastCompletedGeneration: 4,
        lastCompletedMetricVersion: 4,
        startedAt: NOW - 3 * 60 * 60 * 1000,
        updatedAt: NOW - 3 * 60 * 60 * 1000,
      },
    });
    expect(stale.projections.find((item) => item.key === "crm_metrics")?.status).toBe("stale");
    expect(stale.projections.find((item) => item.key === "crm_list_search")?.status).toBe("stale");
  });
});
