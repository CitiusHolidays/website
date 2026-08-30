export const OPERATIONAL_CONTROL_KEYS = [
  "ai.concierge",
  "ai.journey_planner",
  "email.auth.password_reset",
  "email.auth.staff_setup",
  "email.auth.verification",
  "email.crm_workflow",
  "files.document_preview_preparation",
  "inbound.crm_intake",
  "inbound.info_mailbox_email",
  "inbound.sales_bell",
  "inbound.sales_email",
  "jobs.check_cl_sl_leave_lapse",
  "jobs.cleanup_ai_runtime",
  "jobs.cleanup_passenger_exports",
  "jobs.cleanup_portal_rate_limits",
  "jobs.cleanup_sacred_bharat_rate_limits",
  "jobs.purge_commercial_files",
  "jobs.reconcile_crm_metrics",
  "jobs.reconcile_list_search",
  "jobs.reconcile_proposal_links",
  "jobs.reconcile_proposal_relations",
  "jobs.reconcile_query_commercial",
  "jobs.run_workflow_nudges",
  "notifications.crm_bell",
  "payments.razorpay_new_order",
  "public.sacred_bharat_001",
] as const;

export type OperationalControlKey = (typeof OPERATIONAL_CONTROL_KEYS)[number];
export type ConfiguredControlState = "available" | "normal" | "paused" | "unavailable";
export type PersistedControlState = "default" | "disabled" | "enabled";
export type StoredControlState = PersistedControlState | "safe_default";
export type RestorationChoice = "none" | "30m" | "2h" | "24h";
export type ControlStatusFilter = "all" | "blocked" | "changed" | "paused" | "temporary";

export interface OperationalControlRow {
  availability: "available" | "unavailable";
  blockedBy: OperationalControlKey[];
  category: "AI" | "Authentication" | "Contact" | "CRM" | "Infrastructure" | "Payments" | "Public";
  configuredState: ConfiguredControlState;
  dependencies: OperationalControlKey[];
  description: string;
  effectiveEnabled: boolean | null;
  enforcement: string;
  expiresAt?: number;
  key: OperationalControlKey;
  label: string;
  revision: number;
  source: string;
  standardEnabled: boolean;
  state: string;
  updatedAt?: number;
  updatedByName?: string;
}

export interface OperationalTargetIdentity {
  targetDeployment: string;
  targetEnvironment: string;
  targetRevision: string;
}

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

export interface RuntimeHealthSnapshot {
  at: number;
  projections: RuntimeHealthItem[];
  scheduledJobs: RuntimeHealthItem[];
  workflowNudges: RuntimeHealthItem;
}

export type AuthEmailDeliveryStatus =
  | "exhausted"
  | "queued"
  | "retrying"
  | "sending"
  | "sent"
  | "skipped";

export interface AuthEmailHealthSnapshot {
  counts: Record<"password_reset" | "verification", Record<AuthEmailDeliveryStatus, number>>;
  coverage: "complete" | "partial";
  effectsObserved: number;
  intentsObserved: number;
  recent: Array<{
    attempts: number;
    effect: "failed" | "in_progress" | "not_attempted" | "sent";
    expiresAt: number;
    failureCode?: string;
    intent: "recorded";
    providerStatusClass?: "client_error" | "rate_limited" | "server_error";
    purpose: "password_reset" | "verification";
    recoveryAction: string;
    sentAt?: number;
    status: AuthEmailDeliveryStatus;
    updatedAt: number;
    windowPosition: number;
  }>;
  target: OperationalTargetIdentity;
  window: { endedAt: number; startedAt: number };
}

export type ProductionTestRecipeId =
  | "auth_email"
  | "concierge"
  | "crm_notifications"
  | "document_preview"
  | "inbound_leads"
  | "journey_planner"
  | "razorpay_new_order"
  | "sacred_bharat_publication"
  | "scheduled_job:check_cl_sl_leave_lapse"
  | "scheduled_job:cleanup_ai_runtime"
  | "scheduled_job:cleanup_passenger_exports"
  | "scheduled_job:cleanup_portal_rate_limits"
  | "scheduled_job:cleanup_sacred_bharat_rate_limits"
  | "scheduled_job:purge_commercial_files"
  | "scheduled_job:reconcile_crm_metrics"
  | "scheduled_job:reconcile_list_search"
  | "scheduled_job:reconcile_proposal_links"
  | "scheduled_job:reconcile_proposal_relations"
  | "scheduled_job:reconcile_query_commercial"
  | "scheduled_job:run_workflow_nudges";

export interface ProductionTestRecipe {
  controls: string[];
  description: string;
  id: ProductionTestRecipeId;
  label: string;
}

export interface ProductionTestResult {
  cleanup: "failed" | "passed";
  detail: string;
  durationMs: number;
  label: string;
  recipeId: ProductionTestRecipeId;
  recordedEffects: string[];
  status: "failed" | "passed" | "skipped";
  steps: Array<{
    detail: string;
    id: string;
    label: string;
    status: "failed" | "passed" | "skipped";
  }>;
}

export interface ProductionTestRun {
  _id: Id<"productionTestRuns">;
  actorName: string;
  completedAt?: number;
  note?: string;
  recipeIds: ProductionTestRecipeId[];
  results?: ProductionTestResult[];
  startedAt: number;
  status: "failed" | "passed" | "running";
  targetDeployment: string;
  targetEnvironment: string;
  targetRevision: string;
}

export interface OperationalChangeSet {
  _id: Id<"operationalControlChangeSets">;
  appliedAt: number;
  appliedByName: string;
  auditEventId: Id<"operationalControlAuditEvents">;
  changeCount: number;
  changes: Array<{
    after: { state: PersistedControlState };
    before: { expiresAt?: number; state: StoredControlState };
    key: OperationalControlKey;
  }>;
  reason: string;
  resolutionAuditEventId?: Id<"operationalControlAuditEvents">;
  resolutionReason?: string;
  resolvedByName?: string;
  restorationAt?: number;
  restoredAt?: number;
  status: "applied" | "restoration_failed" | "restored" | "undone";
  targetDeployment: string;
  targetEnvironment: string;
  targetRevision: string;
  undoAvailable: boolean;
}

export interface OperationalAuditEvent {
  _id: Id<"operationalControlAuditEvents">;
  action:
    | "catalog_migrated"
    | "change_set_applied"
    | "change_set_restoration_failed"
    | "change_set_restored"
    | "change_set_undone"
    | "global_rollback"
    | "global_set"
    | "test_created"
    | "test_revoked"
    | "plane_activated";
  actorName: string;
  changeSetId?: Id<"operationalControlChangeSets">;
  changes: Array<{
    after: { state: PersistedControlState };
    before: { expiresAt?: number; state: StoredControlState };
    key: OperationalControlKey;
  }>;
  commandId: string;
  createdAt: number;
  initializedControlKeys?: OperationalControlKey[];
  reason: string;
  targetDeployment: string;
  targetEnvironment: string;
  targetRevision: string;
}

export function isControlStatusFilter(value: string): value is ControlStatusFilter {
  return ["all", "blocked", "changed", "paused", "temporary"].includes(value);
}

export function isRestorationChoice(value: string): value is RestorationChoice {
  return ["none", "30m", "2h", "24h"].includes(value);
}

export function isExactAdmin(access?: { roles?: string[]; staffId?: string }) {
  return Boolean(access?.staffId && access.roles?.includes("Admin"));
}

export function restorationDelayMsFor(choice: RestorationChoice) {
  const milliseconds = {
    "2h": 2 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    none: 0,
  }[choice];
  return milliseconds === 0 ? null : milliseconds;
}

export function persistedStateForConfiguredState(state: ConfiguredControlState) {
  switch (state) {
    case "available":
      return "enabled" as const;
    case "paused":
      return "disabled" as const;
    default:
      return "default" as const;
  }
}

export function filterOperationalControls(
  controls: readonly OperationalControlRow[],
  staged: ReadonlyMap<OperationalControlKey, PersistedControlState>,
  search: string,
  filter: ControlStatusFilter
) {
  const query = search.trim().toLowerCase();
  return controls.filter((control) => {
    const matchesSearch =
      query.length === 0 ||
      `${control.label} ${control.description} ${control.category}`.toLowerCase().includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "blocked" && control.blockedBy.length > 0) ||
      (filter === "changed" && staged.has(control.key)) ||
      (filter === "temporary" && control.expiresAt !== undefined) ||
      (filter === "paused" &&
        (staged.get(control.key) === "disabled" ||
          (!staged.has(control.key) && control.configuredState === "paused")));
    return matchesSearch && matchesFilter;
  });
}

import type { Id } from "@convex/_generated/dataModel";
