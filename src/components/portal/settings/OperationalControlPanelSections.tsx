"use client";

import {
  Activity,
  Check,
  ChevronDown,
  CircleAlert,
  FlaskConical,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { PortalSearchField } from "@/components/portal/PortalSearchField";
import { cn } from "@/lib/utils";
import type {
  ControlStatusFilter,
  OperationalAuditEvent,
  OperationalChangeSet,
  OperationalControlKey,
  OperationalControlRow,
  OperationalTargetIdentity,
  PersistedControlState,
  ProductionTestRecipe,
  ProductionTestResult,
  ProductionTestRun,
  RestorationChoice,
  RuntimeHealthItem,
  RuntimeHealthSnapshot,
  RuntimeHealthStatus,
  StoredControlState,
} from "./operationalControlViewModel";
import {
  isControlStatusFilter,
  isRestorationChoice,
  persistedStateForConfiguredState,
} from "./operationalControlViewModel";

const INDIA_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function formatTimestamp(value?: number) {
  return value ? INDIA_DATE_TIME_FORMAT.format(value) : "—";
}

function stateLabel(state: StoredControlState) {
  if (state === "default" || state === "safe_default") {
    return "Normal behavior";
  }
  return state === "disabled" ? "Paused" : "Available";
}

function controlSourceLabel(source: string) {
  switch (source) {
    case "configured_default":
    case "pre_activation_standard":
      return "normal catalog behavior";
    case "explicit_disabled":
      return "paused by an Admin";
    case "explicit_enabled":
      return "made available by an Admin";
    case "prerequisite_disabled":
      return "blocked by another feature";
    case "no_recipients":
      return "no matching recipients";
    case "corrupt_safe_default":
    case "expired_safe_default":
    case "missing_safe_default":
      return "unavailable because the saved state needs attention";
    default:
      return "unavailable";
  }
}

function effectDispositionLabel(disposition: string) {
  switch (disposition) {
    case "created":
      return "Created";
    case "duplicate":
      return "Duplicate prevented";
    case "failed":
      return "Failed";
    case "not_applicable":
      return "Not needed";
    case "queued":
      return "Started";
    case "suppressed":
      return "Prevented by a feature control";
    case "throttled":
      return "Rate limited";
    default:
      return "Recorded";
  }
}

function changeSetActivityLabel(status: OperationalChangeSet["status"]) {
  if (status === "restored") {
    return "Automatic restoration completed";
  }
  if (status === "restoration_failed") {
    return "Automatic restoration needs attention";
  }
  if (status === "undone") {
    return "Undo completed";
  }
  return "Production Change Set applied";
}

function auditActivityLabel(action: OperationalAuditEvent["action"]) {
  switch (action) {
    case "change_set_applied":
      return "Production Change Set applied";
    case "change_set_restoration_failed":
      return "Automatic restoration needs attention";
    case "change_set_restored":
      return "Automatic restoration completed";
    case "change_set_undone":
      return "Latest change undone";
    case "catalog_migrated":
      return "Feature catalog prepared for this release";
    case "plane_activated":
      return "Live feature controls enabled for this target";
    default:
      return "Operational activity recorded";
  }
}

export function OperationalTargetBanner({
  identity,
}: {
  identity: OperationalTargetIdentity | undefined;
}) {
  if (!identity) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-light p-4 text-brand-muted text-sm">
        Confirming the deployment target…
      </div>
    );
  }
  return (
    <div className="grid gap-3 rounded-xl border border-citius-blue/20 bg-citius-blue/[0.035] p-4 sm:grid-cols-3">
      {[
        ["Environment", identity.targetEnvironment],
        ["Deployment", identity.targetDeployment],
        ["Source revision", identity.targetRevision],
      ].map(([label, value]) => (
        <div key={label}>
          <p className="font-medium text-brand-muted text-xs">{label}</p>
          <p className="mt-1 break-all font-mono text-brand-dark text-sm">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ControlSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={(checked ? "Pause " : "Make available ") + label}
      className={cn(
        "relative h-11 w-14 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2",
        disabled && "cursor-not-allowed opacity-45"
      )}
      disabled={disabled}
      onClick={onChange}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2 left-1 h-7 w-12 rounded-full border transition-colors",
          checked ? "border-citius-blue bg-citius-blue" : "border-brand-border bg-slate-200"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2.5 left-1.5 size-6 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}

function statusChip(control: OperationalControlRow, staged?: PersistedControlState) {
  if (staged) {
    return { label: `Staged: ${stateLabel(staged)}`, tone: "bg-citius-blue/10 text-citius-blue" };
  }
  if (control.blockedBy.length > 0) {
    return { label: "Blocked by another control", tone: "bg-amber-100 text-amber-900" };
  }
  if (control.expiresAt !== undefined) {
    return { label: "Temporary", tone: "bg-violet-100 text-violet-900" };
  }
  if (control.configuredState === "paused") {
    return { label: "Paused", tone: "bg-slate-200 text-slate-800" };
  }
  return { label: "Available", tone: "bg-emerald-100 text-emerald-900" };
}

function OperationalControlRowItem({
  control,
  labelsByKey,
  onStage,
  staged,
}: {
  control: OperationalControlRow;
  labelsByKey: ReadonlyMap<OperationalControlKey, string>;
  onStage: (control: OperationalControlRow, state: PersistedControlState) => void;
  staged?: PersistedControlState;
}) {
  const configured = staged ?? persistedStateForConfiguredState(control.configuredState);
  const checked = configured !== "disabled";
  const chip = statusChip(control, staged);
  const toggle = () => onStage(control, checked ? "disabled" : "enabled");
  const normal = () => onStage(control, "default");
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-brand-dark text-sm">{control.label}</h4>
          <span className={cn("rounded-full px-2.5 py-1 font-medium text-xs", chip.tone)}>
            {chip.label}
          </span>
        </div>
        <p className="mt-1 text-brand-muted text-sm">{control.description}</p>
        {control.blockedBy.length > 0 ? (
          <p className="mt-1 text-amber-900 text-xs">
            Configured as {stateLabel(configured)}, but unavailable until{" "}
            {control.blockedBy.map((key) => labelsByKey.get(key) ?? key).join(", ")} is available.
          </p>
        ) : null}
        <details className="mt-2 text-xs">
          <summary className="flex min-h-11 cursor-pointer items-center text-brand-muted">
            Technical details
          </summary>
          <p className="mt-1 text-brand-muted">
            Runtime boundary: {control.enforcement}. Saved revision {control.revision}. Current
            result: {controlSourceLabel(control.source)}.
            {control.updatedByName
              ? " Last changed by " +
                control.updatedByName +
                " on " +
                formatTimestamp(control.updatedAt) +
                "."
              : ""}
          </p>
        </details>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          className="portal-small-btn inline-flex min-h-11 items-center gap-1.5"
          disabled={configured === "default"}
          onClick={normal}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Use normal behavior
        </button>
        <ControlSwitch
          checked={checked}
          disabled={control.availability !== "available"}
          label={control.label}
          onChange={toggle}
        />
      </div>
    </div>
  );
}

export function OperationalControlCatalog({
  controlLabels,
  controls,
  filter,
  onFilterChange,
  onSearchChange,
  onStage,
  search,
  staged,
}: {
  controlLabels: ReadonlyMap<OperationalControlKey, string>;
  controls: OperationalControlRow[];
  filter: ControlStatusFilter;
  onFilterChange: (value: ControlStatusFilter) => void;
  onSearchChange: (value: string) => void;
  onStage: (control: OperationalControlRow, state: PersistedControlState) => void;
  search: string;
  staged: ReadonlyMap<OperationalControlKey, PersistedControlState>;
}) {
  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value);
  const handleFilter = (event: ChangeEvent<HTMLSelectElement>) => {
    if (isControlStatusFilter(event.target.value)) {
      onFilterChange(event.target.value);
    }
  };
  const grouped = new Map<string, OperationalControlRow[]>();
  for (const control of controls) {
    const rows = grouped.get(control.category) ?? [];
    rows.push(control);
    grouped.set(control.category, rows);
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <PortalSearchField
          label="Search feature controls"
          onChange={handleSearch}
          placeholder="Search features"
          value={search}
        />
        <label>
          <span className="sr-only">Filter feature controls</span>
          <select className="portal-input min-h-11 w-full" onChange={handleFilter} value={filter}>
            <option value="all">All controls</option>
            <option value="paused">Paused</option>
            <option value="blocked">Blocked</option>
            <option value="temporary">Temporary</option>
            <option value="changed">Staged changes</option>
          </select>
        </label>
      </div>
      {grouped.size > 0 ? (
        Array.from(grouped.entries()).map(([category, rows]) => (
          <section key={category}>
            <h3 className="mb-2 font-heading font-semibold text-base text-brand-dark">
              {category}{" "}
              <span className="font-normal text-brand-muted text-xs">({rows.length})</span>
            </h3>
            <div className="divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border">
              {rows.map((control) => (
                <OperationalControlRowItem
                  control={control}
                  key={control.key}
                  labelsByKey={controlLabels}
                  onStage={onStage}
                  staged={staged.get(control.key)}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="rounded-xl border border-brand-border p-6 text-center text-brand-muted text-sm">
          No controls match this view.
        </p>
      )}
    </div>
  );
}

export function ChangeSetReviewPanel({
  allControls,
  changes,
  controlLabels,
  identity,
  onApply,
  onCancel,
  onReasonChange,
  onRestorationChange,
  pending,
  reason,
  restoration,
}: {
  allControls: OperationalControlRow[];
  changes: Array<{ control: OperationalControlRow; state: PersistedControlState }>;
  controlLabels: ReadonlyMap<OperationalControlKey, string>;
  identity: OperationalTargetIdentity;
  onApply: () => void;
  onCancel: () => void;
  onReasonChange: (value: string) => void;
  onRestorationChange: (value: RestorationChoice) => void;
  pending: boolean;
  reason: string;
  restoration: RestorationChoice;
}) {
  return (
    <section
      aria-busy={pending}
      className="sticky bottom-4 z-20 rounded-xl border-2 border-citius-blue/25 bg-citius-blue/[0.035] p-4 shadow-xl backdrop-blur md:p-5"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-citius-blue" />
        <div>
          <h3 className="font-heading font-semibold text-brand-dark text-lg">Review and apply</h3>
          <p className="mt-1 text-brand-muted text-sm">
            These {changes.length} changes are applied together. If any revision is stale, nothing
            changes.
          </p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border bg-white">
        {changes.map(({ control, state }) => {
          const affectedControls =
            state === "disabled"
              ? allControls.filter((candidate) => candidate.dependencies.includes(control.key))
              : [];
          return (
            <div className="px-3 py-2 text-sm" key={control.key}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-brand-dark">{control.label}</span>
                <span className="text-brand-muted">
                  {stateLabel(persistedStateForConfiguredState(control.configuredState))} →{" "}
                  {stateLabel(state)}
                </span>
              </div>
              {control.dependencies.length > 0 ? (
                <p className="mt-1 text-brand-muted text-xs">
                  Requires {control.dependencies.map((key) => controlLabels.get(key)).join(", ")}.
                </p>
              ) : null}
              {affectedControls.length > 0 ? (
                <p className="mt-1 text-amber-900 text-xs">
                  This also makes {affectedControls.map((entry) => entry.label).join(", ")}{" "}
                  unavailable.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-brand-border bg-white p-3 text-sm">
        <p className="font-semibold text-brand-dark">Apply to this exact target</p>
        <p className="mt-1 break-all text-brand-muted text-xs">
          {identity.targetEnvironment} · {identity.targetDeployment} · {identity.targetRevision}
        </p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="text-brand-dark text-sm">
          <span className="font-semibold">Why are you making this change?</span>
          <textarea
            className="portal-input mt-2 min-h-28 w-full resize-y"
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Required. Add the operational context someone will need later."
            value={reason}
          />
        </label>
        <label className="text-brand-dark text-sm">
          <span className="font-semibold">Restore the previous state</span>
          <select
            className="portal-input mt-2 min-h-11 w-full"
            onChange={(event) => {
              if (isRestorationChoice(event.target.value)) {
                onRestorationChange(event.target.value);
              }
            }}
            value={restoration}
          >
            <option value="none">Only when I undo it</option>
            <option value="30m">After 30 minutes</option>
            <option value="2h">After 2 hours</option>
            <option value="24h">After 24 hours</option>
          </select>
          <p className="mt-2 text-brand-muted text-xs">
            Automatic restoration returns every changed control to the exact state shown on the
            left.
          </p>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          className="portal-small-btn min-h-11"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          Keep editing
        </button>
        <button
          className="portal-primary-btn min-h-11"
          disabled={pending || reason.trim().length === 0}
          onClick={onApply}
          type="button"
        >
          {pending ? "Applying…" : "Apply changes now"}
        </button>
      </div>
    </section>
  );
}

function resultTone(status: ProductionTestResult["status"]) {
  if (status === "passed") {
    return "bg-emerald-100 text-emerald-900";
  }
  if (status === "skipped") {
    return "bg-amber-100 text-amber-900";
  }
  return "bg-red-100 text-red-900";
}

export function LatestChangeReceipt({
  changeSet,
  controlLabels,
}: {
  changeSet?: OperationalChangeSet;
  controlLabels: ReadonlyMap<OperationalControlKey, string>;
}) {
  if (!changeSet) {
    return null;
  }
  return (
    <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-4" role="status">
      <div className="flex items-start gap-3">
        <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-800" />
        <div className="min-w-0">
          <h3 className="font-heading font-semibold text-brand-dark text-lg">
            Most recent operational result
          </h3>
          <p className="mt-1 text-brand-muted text-sm">
            {changeSetActivityLabel(changeSet.status)} by{" "}
            {changeSet.resolvedByName ?? changeSet.appliedByName} on{" "}
            {formatTimestamp(changeSet.restoredAt ?? changeSet.appliedAt)}.
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 rounded-lg border border-emerald-200 bg-white p-3 text-sm">
        {changeSet.changes.map((change) => (
          <li key={change.key}>
            {controlLabels.get(change.key) ?? change.key}:{" "}
            {stateLabel(
              changeSet.status === "restored" || changeSet.status === "undone"
                ? change.after.state
                : change.before.state
            )}{" "}
            →{" "}
            {stateLabel(
              changeSet.status === "restored" || changeSet.status === "undone"
                ? change.before.state
                : change.after.state
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 whitespace-pre-wrap text-brand-muted text-sm">{changeSet.reason}</p>
      {changeSet.resolutionReason ? (
        <p className="mt-2 whitespace-pre-wrap text-brand-muted text-sm">
          {changeSet.resolutionReason}
        </p>
      ) : null}
      <p className="mt-2 break-all text-brand-muted text-xs">
        {changeSet.targetEnvironment} · {changeSet.targetDeployment} · {changeSet.targetRevision}
      </p>
      <p className="mt-1 break-all text-brand-muted text-xs">
        Change set {changeSet._id} · Audit {changeSet.auditEventId}
        {changeSet.resolutionAuditEventId
          ? ` · Resolution audit ${changeSet.resolutionAuditEventId}`
          : ""}
        {changeSet.restorationAt ? ` · Restores ${formatTimestamp(changeSet.restorationAt)}` : ""}
      </p>
    </section>
  );
}

function TestRecipeChoice({
  checked,
  disabled,
  onToggle,
  recipe,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: (id: ProductionTestRecipe["id"]) => void;
  recipe: ProductionTestRecipe;
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 cursor-pointer gap-3 rounded-lg border p-3 transition-colors focus-within:border-citius-blue focus-within:ring-2 focus-within:ring-citius-blue/20 hover:border-citius-blue/45 hover:bg-white motion-reduce:transition-none",
        checked ? "border-citius-blue/40 bg-white" : "border-brand-border bg-white/70"
      )}
    >
      <input
        checked={checked}
        className="mt-1 size-4 accent-citius-blue"
        disabled={disabled}
        onChange={() => onToggle(recipe.id)}
        type="checkbox"
      />
      <span>
        <span className="font-semibold text-brand-dark text-sm">{recipe.label}</span>
        <span className="mt-1 block text-brand-muted text-xs">{recipe.description}</span>
      </span>
    </label>
  );
}

export function ProductionTestLab({
  activeRuns,
  canLoadMore,
  history,
  latestResults,
  note,
  onLoadMore,
  onNoteChange,
  onRun,
  onResume,
  onToggle,
  pending,
  recipes,
  selected,
}: {
  activeRuns: ProductionTestRun[];
  canLoadMore: boolean;
  history: ProductionTestRun[];
  latestResults: ProductionTestResult[] | null;
  note: string;
  onLoadMore: () => void;
  onNoteChange: (value: string) => void;
  onRun: () => void;
  onResume: (runId: ProductionTestRun["_id"]) => void;
  onToggle: (id: ProductionTestRecipe["id"]) => void;
  pending: boolean;
  recipes: ProductionTestRecipe[] | undefined;
  selected: ReadonlySet<ProductionTestRecipe["id"]>;
}) {
  const [testSearch, setTestSearch] = useState("");
  const recipesLoading = recipes === undefined;
  const controlsLocked = pending || activeRuns.length > 0 || recipesLoading;
  let runButtonLabel = `Run ${selected.size} selected ${selected.size === 1 ? "check" : "checks"}`;
  if (pending) {
    runButtonLabel = "Running checks…";
  }
  if (recipesLoading) {
    runButtonLabel = "Loading checks…";
  }
  const normalizedTestSearch = testSearch.trim().toLocaleLowerCase();
  const majorRecipes = recipes?.filter((recipe) => !recipe.id.startsWith("scheduled_job:")) ?? [];
  const scheduledRecipes =
    recipes?.filter((recipe) => recipe.id.startsWith("scheduled_job:")) ?? [];
  const completedHistory = history.filter(
    (run) =>
      run.status !== "running" &&
      (!normalizedTestSearch ||
        [
          run.actorName,
          run.note,
          run.status,
          run.targetDeployment,
          run.targetEnvironment,
          run.targetRevision,
          ...run.recipeIds,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedTestSearch))
  );
  return (
    <div aria-busy={pending || recipesLoading} className="space-y-6">
      {activeRuns.length > 0 ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4" role="status">
          <h3 className="font-heading font-semibold text-brand-dark text-lg">
            Recover an active test run
          </h3>
          <p className="mt-1 text-brand-muted text-sm">
            Recipe choices are locked because an immutable server-side run is still active. Resume
            it to finish cleanup and evidence recording.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeRuns.map((run) => (
              <button
                className="portal-primary-btn min-h-11"
                disabled={pending}
                key={run._id}
                onClick={() => onResume(run._id)}
                type="button"
              >
                Resume {run.recipeIds.length} {run.recipeIds.length === 1 ? "check" : "checks"}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className="rounded-xl border border-citius-blue/25 bg-citius-blue/[0.035] p-4 md:p-5">
        <div className="flex items-start gap-3">
          <FlaskConical aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-citius-blue" />
          <div>
            <h3 className="font-heading font-semibold text-brand-dark text-lg">
              Production Test Lab
            </h3>
            <p className="mt-1 max-w-3xl text-brand-muted text-sm">
              Check major feature contracts without sending email, creating leads or bookings,
              calling providers, uploading files, or running scheduled jobs.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {recipesLoading ? (
            <p
              className="rounded-lg border border-brand-border bg-white/70 p-4 text-brand-muted text-sm"
              role="status"
            >
              Loading available checks…
            </p>
          ) : null}
          {recipes?.length === 0 ? (
            <p className="rounded-lg border border-brand-border bg-white/70 p-4 text-brand-muted text-sm">
              No Production Test Lab checks are available for this source revision.
            </p>
          ) : null}
          {majorRecipes.length > 0 ? (
            <section aria-labelledby="major-feature-checks-heading">
              <h4
                className="font-semibold text-brand-dark text-sm"
                id="major-feature-checks-heading"
              >
                Major feature checks
              </h4>
              <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {majorRecipes.map((recipe) => (
                  <TestRecipeChoice
                    checked={selected.has(recipe.id)}
                    disabled={controlsLocked}
                    key={recipe.id}
                    onToggle={onToggle}
                    recipe={recipe}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {scheduledRecipes.length > 0 ? (
            <details className="rounded-lg border border-brand-border bg-white/55 p-3">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-brand-dark text-sm">
                Scheduled job checks ({scheduledRecipes.length})
              </summary>
              <p className="mb-3 text-brand-muted text-xs">
                Open this list when you need to validate a specific background job boundary.
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {scheduledRecipes.map((recipe) => (
                  <TestRecipeChoice
                    checked={selected.has(recipe.id)}
                    disabled={controlsLocked}
                    key={recipe.id}
                    onToggle={onToggle}
                    recipe={recipe}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
        <label className="mt-4 block text-brand-dark text-sm">
          <span className="font-semibold">Test note (optional)</span>
          <textarea
            className="portal-input mt-2 min-h-20 w-full resize-y"
            disabled={controlsLocked}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add context for this run if someone reviewing the history will need it."
            value={note}
          />
        </label>
        <div className="mt-4 flex justify-end">
          <button
            className="portal-primary-btn min-h-11"
            disabled={controlsLocked || selected.size === 0}
            onClick={onRun}
            type="button"
          >
            {runButtonLabel}
          </button>
        </div>
      </div>

      {latestResults ? (
        <section aria-live="polite">
          <h3 className="font-heading font-semibold text-brand-dark text-lg">Latest result</h3>
          <div className="mt-2 divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border">
            {latestResults.map((result) => (
              <div className="p-3" key={result.recipeId}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-brand-dark text-sm">{result.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 font-medium text-xs",
                      resultTone(result.status)
                    )}
                  >
                    {result.status[0]?.toUpperCase()}
                    {result.status.slice(1)}
                  </span>
                  <span className="text-brand-muted text-xs">Cleanup {result.cleanup}</span>
                  <span className="text-brand-muted text-xs">{result.durationMs} ms</span>
                </div>
                <p className="mt-1 text-brand-muted text-sm">{result.detail}</p>
                <ol className="mt-2 space-y-1 text-brand-muted text-xs">
                  {result.steps.map((step) => (
                    <li key={step.id}>
                      {step.label}: {step.status} — {step.detail}
                    </li>
                  ))}
                </ol>
                {result.recordedEffects.length > 0 ? (
                  <ul className="mt-2 space-y-1 break-words text-brand-muted text-xs [overflow-wrap:anywhere]">
                    {result.recordedEffects.map((effect) => (
                      <li key={effect}>{effect}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-heading font-semibold text-brand-dark text-lg">Test history</h3>
          <PortalSearchField
            label="Search Test Lab history"
            onChange={(event) => setTestSearch(event.target.value)}
            placeholder="Search test history"
            value={testSearch}
            wrapperClassName="min-w-64"
          />
        </div>
        <div className="mt-2 divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border">
          {completedHistory.length > 0 ? (
            completedHistory.map((run) => {
              const results = run.results ?? [];
              return (
                <details className="p-3" key={run._id}>
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                    <span className="font-medium text-brand-dark text-sm">
                      {results.length} checks by {run.actorName}
                    </span>
                    <span className="flex items-center gap-2 text-brand-muted text-xs">
                      {formatTimestamp(run.completedAt)}{" "}
                      <ChevronDown aria-hidden="true" className="size-4" />
                    </span>
                  </summary>
                  <p className="text-brand-muted text-xs">
                    {run.targetEnvironment} · {run.targetDeployment} · {run.targetRevision}
                  </p>
                  <p className="mt-1 text-brand-muted text-xs">
                    Duration {Math.max(0, (run.completedAt ?? run.startedAt) - run.startedAt)} ms
                    {run.note ? ` · ${run.note}` : ""}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {results.map((result) => (
                      <li key={result.recipeId}>
                        {result.label}: {result.status}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })
          ) : (
            <p className="p-4 text-brand-muted text-sm">No Test Lab runs yet.</p>
          )}
        </div>
        {canLoadMore ? (
          <button className="portal-small-btn mt-3 min-h-11" onClick={onLoadMore} type="button">
            Load older tests
          </button>
        ) : null}
      </section>
    </div>
  );
}

interface OperationalReceipt {
  _id: string;
  controlKey: string;
  createdAt: number;
  disposition: string;
  reason: string;
}

function activitySearchMatches(values: readonly (string | undefined)[], normalizedSearch: string) {
  return values.join(" ").toLocaleLowerCase().includes(normalizedSearch);
}

function OperationalAuditEvents({
  audits,
  canLoadMore,
  controlLabels,
  onLoadMore,
}: {
  audits: OperationalAuditEvent[];
  canLoadMore: boolean;
  controlLabels: ReadonlyMap<string, string>;
  onLoadMore: () => void;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleAudits = audits.filter((event) =>
    activitySearchMatches(
      [
        auditActivityLabel(event.action),
        event.actorName,
        event.commandId,
        event.reason,
        event.targetDeployment,
        event.targetEnvironment,
        event.targetRevision,
        ...event.changes.flatMap((change) => [change.key, controlLabels.get(change.key)]),
        ...(event.initializedControlKeys ?? []).flatMap((key) => [key, controlLabels.get(key)]),
      ],
      normalizedSearch
    )
  );
  return (
    <section>
      <div className="flex items-center gap-2">
        <Activity aria-hidden="true" className="size-5 text-citius-blue" />
        <h3 className="font-heading font-semibold text-brand-dark text-lg">Activity events</h3>
      </div>
      <p className="mt-1 text-brand-muted text-sm">
        Each Apply, automatic restoration, failed restoration, Undo, and release setup action is
        preserved as a separate event.
      </p>
      <PortalSearchField
        label="Search activity events"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search activity, target, reason, or feature"
        value={search}
        wrapperClassName="mt-3"
      />
      <div className="mt-2 divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border">
        {visibleAudits.length > 0 ? (
          visibleAudits.map((event) => (
            <article className="p-3" key={event._id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-brand-dark text-sm">
                    {auditActivityLabel(event.action)}
                  </p>
                  <p className="mt-1 text-brand-muted text-xs">
                    {event.actorName} · {formatTimestamp(event.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-brand-light px-2.5 py-1 text-brand-muted text-xs">
                  Immutable event
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-brand-muted text-sm">{event.reason}</p>
              {event.changes.length > 0 ? (
                <ul className="mt-2 space-y-1 text-brand-muted text-xs">
                  {event.changes.map((change) => (
                    <li key={change.key}>
                      {controlLabels.get(change.key)}: {stateLabel(change.before.state)} →{" "}
                      {stateLabel(change.after.state)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {event.initializedControlKeys && event.initializedControlKeys.length > 0 ? (
                <p className="mt-2 text-brand-muted text-xs">
                  Prepared:{" "}
                  {event.initializedControlKeys.map((key) => controlLabels.get(key)).join(", ")}.
                </p>
              ) : null}
              <p className="mt-2 break-all text-brand-muted text-xs">
                {event.targetEnvironment} · {event.targetDeployment} · {event.targetRevision}
              </p>
              <p className="mt-1 break-all text-brand-muted text-xs">
                Event {event._id} · Command {event.commandId}
                {event.changeSetId ? ` · Change set ${event.changeSetId}` : ""}
              </p>
            </article>
          ))
        ) : (
          <p className="p-4 text-brand-muted text-sm">No activity events match this search.</p>
        )}
      </div>
      {canLoadMore ? (
        <button className="portal-small-btn mt-3 min-h-11" onClick={onLoadMore} type="button">
          Load older activity
        </button>
      ) : null}
    </section>
  );
}

function OperationalChangeHistory({
  canLoadMore,
  changeSets,
  controlLabels,
  onLoadMore,
  onRequestUndo,
}: {
  canLoadMore: boolean;
  changeSets: OperationalChangeSet[];
  controlLabels: ReadonlyMap<string, string>;
  onLoadMore: () => void;
  onRequestUndo: (changeSet: OperationalChangeSet, trigger: HTMLButtonElement) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleChangeSets = changeSets.filter(
    (changeSet) =>
      (status === "all" || changeSet.status === status) &&
      activitySearchMatches(
        [
          changeSet.appliedByName,
          changeSet.auditEventId,
          changeSet.reason,
          changeSet.status,
          changeSet.targetDeployment,
          changeSet.targetEnvironment,
          changeSet.targetRevision,
          ...changeSet.changes.flatMap((change) => [change.key, controlLabels.get(change.key)]),
        ],
        normalizedSearch
      )
  );
  return (
    <section>
      <div className="flex items-center gap-2">
        <Activity aria-hidden="true" className="size-5 text-citius-blue" />
        <h3 className="font-heading font-semibold text-brand-dark text-lg">Change history</h3>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <PortalSearchField
          label="Search change history"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search changes"
          value={search}
        />
        <label>
          <span className="sr-only">Filter change history</span>
          <select
            className="portal-input min-h-11 w-full"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All activity</option>
            <option value="applied">Applied changes</option>
            <option value="restored">Automatic restorations</option>
            <option value="undone">Undo</option>
            <option value="restoration_failed">Needs attention</option>
          </select>
        </label>
      </div>
      <div className="mt-2 divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border">
        {visibleChangeSets.length > 0 ? (
          visibleChangeSets.map((changeSet) => (
            <div className="p-3" key={changeSet._id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-brand-dark text-sm">
                    {changeSetActivityLabel(changeSet.status)} · {changeSet.changeCount}{" "}
                    {changeSet.changeCount === 1 ? "change" : "changes"}
                  </p>
                  <p className="mt-1 text-brand-muted text-xs">
                    {changeSet.appliedByName} · {formatTimestamp(changeSet.appliedAt)}
                  </p>
                </div>
                {changeSet.undoAvailable ? (
                  <button
                    className="portal-small-btn min-h-11"
                    onClick={(event) => onRequestUndo(changeSet, event.currentTarget)}
                    type="button"
                  >
                    Undo latest change
                  </button>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-brand-muted text-sm">
                {changeSet.reason}
              </p>
              {changeSet.resolutionReason ? (
                <p className="mt-1 whitespace-pre-wrap text-brand-muted text-sm">
                  {changeSet.resolvedByName}: {changeSet.resolutionReason}
                </p>
              ) : null}
              <details className="mt-2 text-xs">
                <summary className="flex min-h-11 cursor-pointer items-center text-brand-muted">
                  Review before and after
                </summary>
                <ul className="mt-1 space-y-1 text-brand-muted">
                  {changeSet.changes.map((change) => (
                    <li key={change.key}>
                      {controlLabels.get(change.key) ?? change.key}:{" "}
                      {stateLabel(change.before.state)} → {stateLabel(change.after.state)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-brand-muted">
                  {changeSet.targetEnvironment} · {changeSet.targetDeployment} ·{" "}
                  {changeSet.targetRevision}
                </p>
                <p className="mt-1 break-all text-brand-muted">
                  Change set {changeSet._id} · Audit {changeSet.auditEventId}
                  {changeSet.resolutionAuditEventId
                    ? ` · Resolution audit ${changeSet.resolutionAuditEventId}`
                    : ""}
                </p>
                {changeSet.restorationAt ? (
                  <p>Restores at {formatTimestamp(changeSet.restorationAt)}.</p>
                ) : null}
              </details>
            </div>
          ))
        ) : (
          <p className="p-4 text-brand-muted text-sm">No live changes yet.</p>
        )}
      </div>
      {canLoadMore ? (
        <button className="portal-small-btn mt-3 min-h-11" onClick={onLoadMore} type="button">
          Load older changes
        </button>
      ) : null}
    </section>
  );
}

function OperationalEffectHistory({
  canLoadMore,
  controlLabels,
  onLoadMore,
  receipts,
}: {
  canLoadMore: boolean;
  controlLabels: ReadonlyMap<string, string>;
  onLoadMore: () => void;
  receipts: OperationalReceipt[];
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleReceipts = receipts.filter((receipt) =>
    activitySearchMatches(
      [
        receipt.controlKey,
        controlLabels.get(receipt.controlKey),
        receipt.disposition,
        receipt.reason,
      ],
      normalizedSearch
    )
  );
  return (
    <section>
      <div className="flex items-center gap-2">
        <Check aria-hidden="true" className="size-5 text-citius-blue" />
        <h3 className="font-heading font-semibold text-brand-dark text-lg">Effect history</h3>
      </div>
      <PortalSearchField
        label="Search effect history"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search effect history"
        value={search}
        wrapperClassName="mt-3"
      />
      <div className="mt-2 divide-y divide-brand-border overflow-hidden rounded-xl border border-brand-border">
        {visibleReceipts.length > 0 ? (
          visibleReceipts.map((receipt) => (
            <div className="p-3 text-sm" key={receipt._id}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-brand-dark">
                  {controlLabels.get(receipt.controlKey) ?? receipt.controlKey}
                </span>
                <span className="text-brand-muted text-xs">
                  {formatTimestamp(receipt.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-brand-muted">
                {effectDispositionLabel(receipt.disposition)} · {controlSourceLabel(receipt.reason)}
              </p>
            </div>
          ))
        ) : (
          <p className="p-4 text-brand-muted text-sm">No effect receipts yet.</p>
        )}
      </div>
      {canLoadMore ? (
        <button className="portal-small-btn mt-3 min-h-11" onClick={onLoadMore} type="button">
          Load older effects
        </button>
      ) : null}
    </section>
  );
}

const RUNTIME_HEALTH_LABELS = {
  degraded: "Degraded",
  not_observed: "Not observed",
  paused: "Paused",
  ready: "Ready",
  reconciling: "Reconciling",
  stale: "Stale",
  suppressed: "Suppressed",
} as const satisfies Record<RuntimeHealthStatus, string>;

function runtimeHealthTone(status: RuntimeHealthStatus) {
  if (status === "ready") {
    return "bg-emerald-100 text-emerald-900";
  }
  if (status === "reconciling") {
    return "bg-citius-blue/10 text-citius-blue";
  }
  if (status === "paused" || status === "suppressed") {
    return "bg-slate-200 text-slate-800";
  }
  return "bg-amber-100 text-amber-950";
}

function RuntimeHealthGroup({ heading, items }: { heading: string; items: RuntimeHealthItem[] }) {
  return (
    <section aria-labelledby={`runtime-health-${heading.toLowerCase().replaceAll(" ", "-")}`}>
      <h4
        className="font-semibold text-brand-dark text-sm"
        id={`runtime-health-${heading.toLowerCase().replaceAll(" ", "-")}`}
      >
        {heading}
      </h4>
      <ul className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li className="rounded-xl border border-brand-border bg-white/70 p-3" key={item.key}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="font-semibold text-brand-dark text-sm">{item.label}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium text-xs",
                  runtimeHealthTone(item.status)
                )}
              >
                {RUNTIME_HEALTH_LABELS[item.status]}
              </span>
            </div>
            <p className="mt-2 text-brand-muted text-xs">{item.summary}</p>
            <p className="mt-2 text-brand-muted text-xs">
              Last application evidence: {formatTimestamp(item.observedAt ?? undefined)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OperationalRuntimeHealth({
  health,
  onNavigate,
  onRefresh,
}: {
  health: RuntimeHealthSnapshot | undefined;
  onNavigate: (tab: "activity" | "controls" | "tests") => void;
  onRefresh: () => void;
}) {
  return (
    <section aria-labelledby="runtime-health-heading" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity aria-hidden="true" className="size-5 text-citius-blue" />
            <h3
              className="font-heading font-semibold text-brand-dark text-lg"
              id="runtime-health-heading"
            >
              Application runtime evidence
            </h3>
          </div>
          <p className="mt-1 max-w-3xl text-brand-muted text-sm">
            Read-only application evidence from existing projections, scheduled-job receipts, and
            workflow-nudge state. This is not Convex platform or monitoring-provider status.
          </p>
        </div>
        <button className="portal-small-btn min-h-11" onClick={onRefresh} type="button">
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh evidence
        </button>
      </div>

      {health ? (
        <div className="space-y-5">
          <p aria-live="polite" className="text-brand-muted text-xs">
            Evidence evaluated at {formatTimestamp(health.at)}. Missing evidence remains Not
            observed.
          </p>
          <RuntimeHealthGroup heading="Projection readiness" items={health.projections} />
          <RuntimeHealthGroup heading="Scheduled jobs" items={health.scheduledJobs} />
          <RuntimeHealthGroup heading="Workflow nudges" items={[health.workflowNudges]} />
        </div>
      ) : (
        <p
          className="rounded-xl border border-brand-border bg-brand-light p-4 text-brand-muted text-sm"
          role="status"
        >
          Loading application runtime evidence…
        </p>
      )}

      <nav aria-label="Runtime health follow-up views" className="flex flex-wrap gap-2">
        <button
          className="portal-small-btn min-h-11"
          onClick={() => onNavigate("controls")}
          type="button"
        >
          Review feature controls
        </button>
        <button
          className="portal-small-btn min-h-11"
          onClick={() => onNavigate("activity")}
          type="button"
        >
          Review activity
        </button>
        <button
          className="portal-small-btn min-h-11"
          onClick={() => onNavigate("tests")}
          type="button"
        >
          Open Test Lab
        </button>
      </nav>
    </section>
  );
}

export function OperationalActivity({
  audits,
  canLoadMoreAudits,
  canLoadMoreChanges,
  canLoadMoreReceipts,
  changeSets,
  controlLabels,
  onLoadMoreAudits,
  onLoadMoreChanges,
  onLoadMoreReceipts,
  onRequestUndo,
  receipts,
}: {
  audits: OperationalAuditEvent[];
  canLoadMoreAudits: boolean;
  canLoadMoreChanges: boolean;
  canLoadMoreReceipts: boolean;
  changeSets: OperationalChangeSet[];
  controlLabels: ReadonlyMap<string, string>;
  onLoadMoreAudits: () => void;
  onLoadMoreChanges: () => void;
  onLoadMoreReceipts: () => void;
  onRequestUndo: (changeSet: OperationalChangeSet, trigger: HTMLButtonElement) => void;
  receipts: OperationalReceipt[];
}) {
  return (
    <div className="space-y-6">
      <OperationalAuditEvents
        audits={audits}
        canLoadMore={canLoadMoreAudits}
        controlLabels={controlLabels}
        onLoadMore={onLoadMoreAudits}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <OperationalChangeHistory
          canLoadMore={canLoadMoreChanges}
          changeSets={changeSets}
          controlLabels={controlLabels}
          onLoadMore={onLoadMoreChanges}
          onRequestUndo={onRequestUndo}
        />
        <OperationalEffectHistory
          canLoadMore={canLoadMoreReceipts}
          controlLabels={controlLabels}
          onLoadMore={onLoadMoreReceipts}
          receipts={receipts}
        />
      </div>
    </div>
  );
}

export function UndoReviewPanel({
  changeSet,
  controlLabels,
  onCancel,
  onConfirm,
  onReasonChange,
  pending,
  reason,
}: {
  changeSet: OperationalChangeSet;
  controlLabels: ReadonlyMap<OperationalControlKey, string>;
  onCancel: () => void;
  onConfirm: () => void;
  onReasonChange: (value: string) => void;
  pending: boolean;
  reason: string;
}) {
  return (
    <section
      aria-busy={pending}
      className="sticky bottom-4 z-20 mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 shadow-xl"
    >
      <div className="flex gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-800" />
        <div>
          <h3 className="font-heading font-semibold text-brand-dark text-lg">Review undo</h3>
          <p className="mt-1 text-brand-muted text-sm">
            This restores the controls below to their state immediately before this change. Undo is
            one-shot and is unavailable after a newer change touches the same controls.
          </p>
        </div>
      </div>
      <ul className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-sm">
        {changeSet.changes.map((change) => (
          <li key={change.key}>
            {controlLabels.get(change.key) ?? change.key}: {stateLabel(change.after.state)} →{" "}
            {stateLabel(change.before.state)}
          </li>
        ))}
      </ul>
      <p className="mt-3 break-all text-brand-muted text-xs">
        Apply to {changeSet.targetEnvironment} · {changeSet.targetDeployment} ·{" "}
        {changeSet.targetRevision}
      </p>
      <label className="mt-4 block text-brand-dark text-sm">
        <span className="font-semibold">Why are you undoing this change?</span>
        <textarea
          className="portal-input mt-2 min-h-24 w-full resize-y"
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Required for the activity history"
          value={reason}
        />
      </label>
      <div className="mt-4 flex justify-end gap-2">
        <button
          className="portal-small-btn min-h-11"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="portal-primary-btn min-h-11"
          disabled={pending || reason.trim().length === 0}
          onClick={onConfirm}
          type="button"
        >
          {pending ? "Undoing…" : "Undo this change now"}
        </button>
      </div>
    </section>
  );
}
