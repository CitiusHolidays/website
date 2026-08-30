import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import {
  SCHEDULED_JOBS,
  type ScheduledJob,
  scheduledJobControlKey,
} from "../../operationalScheduledJobs";
import type { OperationalControlKey } from "./operationalControls";

export const RUNTIME_HEALTH_LIST_TABLES = [
  "queries",
  "jobCards",
  "proposals",
  "travellers",
] as const;

export const runtimeHealthStatusValidator = v.union(
  v.literal("ready"),
  v.literal("reconciling"),
  v.literal("stale"),
  v.literal("degraded"),
  v.literal("paused"),
  v.literal("suppressed"),
  v.literal("not_observed")
);

const runtimeHealthItemValidator = v.object({
  key: v.string(),
  label: v.string(),
  observedAt: v.union(v.number(), v.null()),
  status: runtimeHealthStatusValidator,
  summary: v.string(),
});

export const runtimeHealthResultValidator = v.object({
  at: v.number(),
  projections: v.array(runtimeHealthItemValidator),
  scheduledJobs: v.array(runtimeHealthItemValidator),
  workflowNudges: runtimeHealthItemValidator,
});

export type RuntimeHealthStatus =
  | "ready"
  | "reconciling"
  | "stale"
  | "degraded"
  | "paused"
  | "suppressed"
  | "not_observed";

export interface RuntimeHealthItem {
  key: string;
  label: string;
  observedAt: number | null;
  status: RuntimeHealthStatus;
  summary: string;
}

interface ControlResolution {
  enabled: boolean;
  key: OperationalControlKey;
  reason: string;
}

type ScheduledReceipt = Pick<Doc<"operationalEffectReceipts">, "createdAt" | "disposition">;

type MetricReadiness = Pick<
  Doc<"crmMetricReadiness">,
  | "generation"
  | "lastCompletedAt"
  | "lastCompletedGeneration"
  | "lastCompletedMetricVersion"
  | "startedAt"
  | "updatedAt"
>;

type ListSearchReadiness = Pick<
  Doc<"crmListSearchReadiness">,
  "ready" | "reconciling" | "startedAt" | "updatedAt" | "version"
>;

interface ReconciliationReadiness {
  ready: boolean;
  startedAt: number;
  status: "complete" | "failed" | "running";
  updatedAt: number;
  version: number;
}

type ProposalReadiness = Pick<
  Doc<"proposalAttachmentSummaryReadiness">,
  "ready" | "reconciling" | "startedAt" | "updatedAt" | "version"
>;

type WorkflowNudgeRun = Pick<
  Doc<"portalWorkflowNudgeRuns">,
  "consecutiveFailedRuns" | "status" | "updatedAt"
>;

const PROJECTION_STALE_MS = 60 * 60 * 1000;
const WORKFLOW_NUDGE_STALE_MS = 15 * 60 * 1000;
const METRIC_VERSION = 4;
const LIST_SEARCH_VERSION = 2;
const NOTIFICATION_UNREAD_VERSION = 1;
const NOTIFICATION_EMAIL_VERSION = 1;
const PROPOSAL_ATTACHMENT_VERSION = 1;

const JOB_HEALTH = {
  check_cl_sl_leave_lapse: {
    label: "CL/SL leave lapse",
    staleAfterMs: 36 * 60 * 60 * 1000,
  },
  cleanup_ai_runtime: {
    label: "AI runtime cleanup",
    staleAfterMs: 36 * 60 * 60 * 1000,
  },
  cleanup_passenger_exports: {
    label: "Passenger export cleanup",
    staleAfterMs: 60 * 60 * 1000,
  },
  cleanup_portal_rate_limits: {
    label: "Portal rate-limit cleanup",
    staleAfterMs: 3 * 60 * 60 * 1000,
  },
  cleanup_sacred_bharat_rate_limits: {
    label: "Sacred Bharat rate-limit cleanup",
    staleAfterMs: 3 * 60 * 60 * 1000,
  },
  purge_commercial_files: {
    label: "Commercial file retention purge",
    staleAfterMs: 36 * 60 * 60 * 1000,
  },
  reconcile_crm_metrics: {
    label: "CRM metric reconciliation",
    staleAfterMs: 60 * 60 * 1000,
  },
  reconcile_list_search: {
    label: "CRM list-search reconciliation",
    staleAfterMs: 3 * 60 * 60 * 1000,
  },
  reconcile_proposal_links: {
    label: "Proposal link reconciliation",
    staleAfterMs: 3 * 60 * 60 * 1000,
  },
  reconcile_proposal_relations: {
    label: "Proposal relation reconciliation",
    staleAfterMs: 3 * 60 * 60 * 1000,
  },
  reconcile_query_commercial: {
    label: "Query commercial reconciliation",
    staleAfterMs: 3 * 60 * 60 * 1000,
  },
  run_workflow_nudges: {
    label: "Workflow nudges",
    staleAfterMs: 36 * 60 * 60 * 1000,
  },
} as const satisfies Record<ScheduledJob, { label: string; staleAfterMs: number }>;

const STATUS_SUMMARIES = {
  degraded: "Existing evidence reports a failure that needs review.",
  not_observed: "No application-owned evidence has been observed yet.",
  paused: "The owning feature control is paused.",
  ready: "Existing application-owned evidence is current.",
  reconciling: "The owning workflow is still reconciling.",
  stale: "Existing evidence is older than its deterministic readiness window.",
  suppressed: "The owning workflow is intentionally suppressed.",
} as const satisfies Record<RuntimeHealthStatus, string>;

function item(
  key: string,
  label: string,
  status: RuntimeHealthStatus,
  observedAt: number | null
): RuntimeHealthItem {
  return { key, label, observedAt, status, summary: STATUS_SUMMARIES[status] };
}

function controlStatus(control: ControlResolution | undefined): RuntimeHealthStatus | null {
  if (!control) {
    return "not_observed";
  }
  if (control.reason === "explicit_disabled") {
    return "paused";
  }
  if (control.reason === "prerequisite_disabled") {
    return "suppressed";
  }
  if (
    control.reason === "corrupt_safe_default" ||
    control.reason === "expired_safe_default" ||
    control.reason === "missing_safe_default"
  ) {
    return "degraded";
  }
  return control.enabled ? null : "suppressed";
}

function scheduledJobStatus(
  control: ControlResolution | undefined,
  receipt: ScheduledReceipt | null | undefined,
  at: number,
  staleAfterMs: number
): RuntimeHealthStatus {
  const blockedStatus = controlStatus(control);
  if (blockedStatus) {
    return blockedStatus;
  }
  if (!receipt) {
    return "not_observed";
  }
  if (receipt.disposition === "failed" || receipt.disposition === "throttled") {
    return "degraded";
  }
  if (receipt.disposition === "queued") {
    return at - receipt.createdAt >= staleAfterMs ? "stale" : "reconciling";
  }
  if (receipt.disposition !== "created") {
    return "suppressed";
  }
  return at - receipt.createdAt >= staleAfterMs ? "stale" : "ready";
}

function projectionStatus({
  at,
  current,
  evidencePresent,
  failed = false,
  pendingSince,
  reconciling,
}: {
  at: number;
  current: boolean;
  evidencePresent: boolean;
  failed?: boolean;
  pendingSince: number | null;
  reconciling: boolean;
}): RuntimeHealthStatus {
  if (!evidencePresent) {
    return "not_observed";
  }
  if (failed) {
    return "degraded";
  }
  if (current && !reconciling) {
    return "ready";
  }
  if (pendingSince !== null && at - pendingSince >= PROJECTION_STALE_MS) {
    return "stale";
  }
  return reconciling ? "reconciling" : "stale";
}

function latestTimestamp(values: Array<number | null | undefined>) {
  const observed = values.flatMap((value) =>
    value === null || value === undefined ? [] : [value]
  );
  return observed.length > 0 ? Math.max(...observed) : null;
}

function earliestTimestamp(values: Array<number | null | undefined>) {
  const observed = values.flatMap((value) =>
    value === null || value === undefined ? [] : [value]
  );
  return observed.length > 0 ? Math.min(...observed) : null;
}

function reconciliationStatus(
  readiness: ReconciliationReadiness | null,
  version: number,
  at: number
) {
  return projectionStatus({
    at,
    current: Boolean(
      readiness?.ready && readiness.status === "complete" && readiness.version === version
    ),
    evidencePresent: Boolean(readiness),
    failed: readiness?.status === "failed",
    pendingSince: readiness?.startedAt ?? null,
    reconciling: readiness?.status === "running",
  });
}

function workflowNudgeStatus(
  control: ControlResolution | undefined,
  run: WorkflowNudgeRun | null,
  at: number
): RuntimeHealthStatus {
  const blockedStatus = controlStatus(control);
  if (blockedStatus) {
    return blockedStatus;
  }
  if (!run) {
    return "not_observed";
  }
  if (run.status === "failed" || (run.consecutiveFailedRuns ?? 0) >= 2) {
    return "degraded";
  }
  if (
    run.status === "stale" ||
    (run.status === "running" && at - run.updatedAt >= WORKFLOW_NUDGE_STALE_MS)
  ) {
    return "stale";
  }
  return run.status === "running" ? "reconciling" : "ready";
}

export function composeRuntimeHealth({
  at,
  controls,
  listDirty,
  listReadiness,
  metricDirty,
  metricReadiness,
  notificationEmailReadiness,
  notificationUnreadReadiness,
  proposalAttachmentReadiness,
  scheduledReceipts,
  workflowNudgeRun,
}: {
  at: number;
  controls: ReadonlyMap<OperationalControlKey, ControlResolution>;
  listDirty: { updatedAt: number } | null;
  listReadiness: Array<ListSearchReadiness | null>;
  metricDirty: { updatedAt: number } | null;
  metricReadiness: MetricReadiness | null;
  notificationEmailReadiness: ReconciliationReadiness | null;
  notificationUnreadReadiness: ReconciliationReadiness | null;
  proposalAttachmentReadiness: ProposalReadiness | null;
  scheduledReceipts: ReadonlyMap<ScheduledJob, ScheduledReceipt | null>;
  workflowNudgeRun: WorkflowNudgeRun | null;
}) {
  const metricCurrent = Boolean(
    metricReadiness?.lastCompletedGeneration &&
      metricReadiness.lastCompletedMetricVersion === METRIC_VERSION
  );
  const metricReconciling = Boolean(
    metricReadiness &&
      (metricReadiness.generation !== metricReadiness.lastCompletedGeneration || metricDirty)
  );
  const metricObservedAt = latestTimestamp([
    metricReadiness?.updatedAt,
    metricReadiness?.lastCompletedAt,
    metricDirty?.updatedAt,
  ]);
  const metricPendingSince = metricDirty?.updatedAt ?? metricReadiness?.startedAt ?? null;

  const listEvidencePresent =
    listReadiness.length === RUNTIME_HEALTH_LIST_TABLES.length && listReadiness.every(Boolean);
  const listCurrent =
    listEvidencePresent &&
    listReadiness.every((row) => row?.ready === true && row.version === LIST_SEARCH_VERSION);
  const listReconciling = Boolean(
    listDirty || listReadiness.some((row) => row?.reconciling === true)
  );
  const listObservedAt = latestTimestamp([
    ...listReadiness.map((row) => row?.updatedAt),
    listDirty?.updatedAt,
  ]);
  const listPendingSince = earliestTimestamp([
    ...listReadiness.flatMap((row) =>
      row && (!(row.ready && row.version === LIST_SEARCH_VERSION) || row.reconciling)
        ? [row.startedAt ?? row.updatedAt]
        : []
    ),
    listDirty?.updatedAt,
  ]);

  const proposalStatus = projectionStatus({
    at,
    current: Boolean(
      proposalAttachmentReadiness?.ready &&
        proposalAttachmentReadiness.version === PROPOSAL_ATTACHMENT_VERSION
    ),
    evidencePresent: Boolean(proposalAttachmentReadiness),
    pendingSince: proposalAttachmentReadiness?.startedAt ?? null,
    reconciling: proposalAttachmentReadiness?.reconciling === true,
  });

  const projections = [
    item(
      "crm_metrics",
      "CRM metrics",
      projectionStatus({
        at,
        current: metricCurrent,
        evidencePresent: Boolean(metricReadiness),
        pendingSince: metricPendingSince,
        reconciling: metricReconciling,
      }),
      metricObservedAt
    ),
    item(
      "crm_list_search",
      "CRM list search",
      projectionStatus({
        at,
        current: listCurrent,
        evidencePresent: listEvidencePresent,
        pendingSince: listPendingSince,
        reconciling: listReconciling,
      }),
      listObservedAt
    ),
    item(
      "notification_unread",
      "Notification unread counts",
      reconciliationStatus(notificationUnreadReadiness, NOTIFICATION_UNREAD_VERSION, at),
      notificationUnreadReadiness?.updatedAt ?? null
    ),
    item(
      "notification_email_summaries",
      "Notification email summaries",
      reconciliationStatus(notificationEmailReadiness, NOTIFICATION_EMAIL_VERSION, at),
      notificationEmailReadiness?.updatedAt ?? null
    ),
    item(
      "proposal_attachment_summaries",
      "Proposal attachment summaries",
      proposalStatus,
      proposalAttachmentReadiness?.updatedAt ?? null
    ),
  ];

  const scheduledJobs = SCHEDULED_JOBS.map((job) => {
    const definition = JOB_HEALTH[job];
    const receipt = scheduledReceipts.get(job);
    return item(
      job,
      definition.label,
      scheduledJobStatus(
        controls.get(scheduledJobControlKey(job)),
        receipt,
        at,
        definition.staleAfterMs
      ),
      receipt?.createdAt ?? null
    );
  });

  return {
    at,
    projections,
    scheduledJobs,
    workflowNudges: item(
      "workflow_nudges",
      "CRM workflow nudges",
      workflowNudgeStatus(controls.get("jobs.run_workflow_nudges"), workflowNudgeRun, at),
      workflowNudgeRun?.updatedAt ?? null
    ),
  };
}
