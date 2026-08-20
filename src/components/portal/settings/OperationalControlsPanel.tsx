"use client";

import { api } from "@convex/_generated/api";
import { useAction, useConvexAuth, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { cn } from "@/lib/utils";
import { formatConvexError } from "../workspace/portalWorkspaceListHelpers";
import {
  ChangeSetReviewPanel,
  LatestChangeReceipt,
  OperationalActivity,
  OperationalControlCatalog,
  OperationalTargetBanner,
  ProductionTestLab,
  UndoReviewPanel,
} from "./OperationalControlPanelSections";
import {
  type ControlStatusFilter,
  filterOperationalControls,
  isExactAdmin,
  type OperationalChangeSet,
  type OperationalControlKey,
  type OperationalControlRow,
  type PersistedControlState,
  type ProductionTestRecipeId,
  type ProductionTestResult,
  persistedStateForConfiguredState,
  type RestorationChoice,
  restorationDelayMsFor,
} from "./operationalControlViewModel";

const PANEL_TABS = [
  { id: "controls", label: "Feature controls" },
  { id: "tests", label: "Test Lab" },
  { id: "activity", label: "Activity" },
] as const;
type PanelTab = (typeof PANEL_TABS)[number]["id"];
const HISTORY_PAGE_SIZE = 12;

function useProtectedHistory(canQuery: boolean, tab: PanelTab) {
  const activityVisible = canQuery && tab === "activity";
  const audits = usePaginatedQuery(
    api.crm.settings.listOperationalControlAudit,
    activityVisible ? {} : "skip",
    { initialNumItems: HISTORY_PAGE_SIZE }
  );
  const changeSets = usePaginatedQuery(
    api.crm.settings.listOperationalChangeSets,
    canQuery && tab !== "tests" ? {} : "skip",
    { initialNumItems: HISTORY_PAGE_SIZE }
  );
  const receipts = usePaginatedQuery(
    api.crm.settings.listOperationalEffectReceipts,
    activityVisible ? {} : "skip",
    { initialNumItems: HISTORY_PAGE_SIZE }
  );
  const testRuns = usePaginatedQuery(
    api.crm.productionTestLab.listRuns,
    canQuery && tab === "tests" ? {} : "skip",
    { initialNumItems: HISTORY_PAGE_SIZE }
  );
  return { audits, changeSets, receipts, testRuns };
}

function useOperationalControlsPanel(tab: PanelTab, onUndoClosed: () => void) {
  const toast = usePortalToast();
  const [queryAt] = useState(Date.now);
  const { isAuthenticated } = useConvexAuth();
  const liveAccess = useQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const canQuery = isAuthenticated && isExactAdmin(liveAccess);
  const controls = useQuery(
    api.crm.settings.listOperationalControls,
    canQuery ? { at: queryAt } : "skip"
  );
  const targetIdentity = useQuery(
    api.crm.settings.getOperationalControlTargetIdentity,
    canQuery ? {} : "skip"
  );
  const recipes = useQuery(
    api.crm.productionTestLab.listRecipes,
    canQuery && tab === "tests" ? {} : "skip"
  );
  const activeTestRuns = useQuery(
    api.crm.productionTestLab.listActiveRuns,
    canQuery && tab === "tests" ? {} : "skip"
  );
  const history = useProtectedHistory(canQuery, tab);
  const applyChangeSet = useMutation(api.crm.settings.applyOperationalChangeSet);
  const undoChangeSet = useMutation(api.crm.settings.undoOperationalChangeSet);
  const runRecipes = useAction(api.crm.productionTestLab.runRecipes);
  const resumeRun = useAction(api.crm.productionTestLab.resumeRun);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ControlStatusFilter>("all");
  const [staged, setStaged] = useState(
    () => new Map<OperationalControlKey, PersistedControlState>()
  );
  const [reviewing, setReviewing] = useState(false);
  const [reason, setReason] = useState("");
  const [restoration, setRestoration] = useState<RestorationChoice>("none");
  const [applying, setApplying] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<ReadonlySet<ProductionTestRecipeId>>(
    () => new Set<ProductionTestRecipeId>(["inbound_leads"])
  );
  const [runningTests, setRunningTests] = useState(false);
  const [testNote, setTestNote] = useState("");
  const [latestResults, setLatestResults] = useState<ProductionTestResult[] | null>(null);
  const [undoTarget, setUndoTarget] = useState<OperationalChangeSet | null>(null);
  const [undoReason, setUndoReason] = useState("");
  const [undoPending, setUndoPending] = useState(false);
  const [latestAppliedReceipt, setLatestAppliedReceipt] = useState<OperationalChangeSet | null>(
    null
  );

  const rows: OperationalControlRow[] = controls ?? [];
  const controlsByKey = new Map(rows.map((control) => [control.key, control]));
  const controlLabels = new Map(rows.map((control) => [control.key, control.label]));
  const visibleControls = filterOperationalControls(rows, staged, search, filter);
  const stagedRows = Array.from(staged, ([key, state]) => ({
    control: controlsByKey.get(key),
    state,
  })).flatMap((entry) => (entry.control ? [{ control: entry.control, state: entry.state }] : []));

  const stageControl = (control: OperationalControlRow, state: PersistedControlState) => {
    setStaged((current) => {
      const next = new Map(current);
      let currentState: PersistedControlState = "default";
      if (control.configuredState === "paused") {
        currentState = "disabled";
      } else if (control.configuredState === "available") {
        currentState = "enabled";
      }
      if (state === currentState) {
        next.delete(control.key);
      } else {
        next.set(control.key, state);
      }
      return next;
    });
    setReviewing(false);
  };

  const applyReviewedChanges = async () => {
    if (reason.trim().length === 0 || stagedRows.length === 0 || !targetIdentity) {
      return;
    }
    setApplying(true);
    try {
      const restorationAfterMs = restorationDelayMsFor(restoration);
      const result = await applyChangeSet({
        changes: stagedRows.map(({ control, state }) => ({
          expectedRevision: control.revision,
          key: control.key,
          state,
        })),
        commandId: crypto.randomUUID(),
        expectedTargetDeployment: targetIdentity.targetDeployment,
        expectedTargetEnvironment: targetIdentity.targetEnvironment,
        expectedTargetRevision: targetIdentity.targetRevision,
        reason: reason.trim(),
        restorationAfterMs,
      });
      const changes: OperationalChangeSet["changes"] = stagedRows.map(({ control, state }) => {
        const before: OperationalChangeSet["changes"][number]["before"] = {
          state: persistedStateForConfiguredState(control.configuredState),
        };
        if (control.expiresAt !== undefined) {
          before.expiresAt = control.expiresAt;
        }
        return {
          after: { state },
          before,
          key: control.key,
        };
      });
      const appliedReceipt: OperationalChangeSet = {
        _id: result.changeSetId,
        appliedAt: Date.now(),
        appliedByName: "You",
        auditEventId: result.auditEventId,
        changeCount: stagedRows.length,
        changes,
        reason: reason.trim(),
        status: "applied",
        targetDeployment: targetIdentity.targetDeployment,
        targetEnvironment: targetIdentity.targetEnvironment,
        targetRevision: targetIdentity.targetRevision,
        undoAvailable: true,
      };
      if (result.restorationAt !== null) {
        appliedReceipt.restorationAt = result.restorationAt;
      }
      setLatestAppliedReceipt(appliedReceipt);
      toast.success(
        stagedRows.length +
          (stagedRows.length === 1
            ? " feature change applied."
            : " feature changes applied together.")
      );
      setStaged(new Map());
      setReason("");
      setRestoration("none");
      setReviewing(false);
    } catch (error) {
      toast.error(
        formatConvexError(error, "Could not apply the reviewed change set. Refresh and try again.")
      );
    }
    setApplying(false);
  };

  const toggleRecipe = (id: ProductionTestRecipeId) => {
    setSelectedRecipes((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const runSelectedRecipes = async () => {
    if (selectedRecipes.size === 0 || !targetIdentity) {
      return;
    }
    setRunningTests(true);
    try {
      const result = await runRecipes({
        commandId: crypto.randomUUID(),
        expectedTargetDeployment: targetIdentity.targetDeployment,
        expectedTargetEnvironment: targetIdentity.targetEnvironment,
        expectedTargetRevision: targetIdentity.targetRevision,
        note: testNote.trim() || undefined,
        recipeIds: Array.from(selectedRecipes),
      });
      setLatestResults(result.run.results);
      setTestNote("");
      if (result.run.status === "passed") {
        toast.success("Test Lab checks passed. No customer or provider effects were created.");
      } else {
        toast.error("Test Lab completed with failed checks. Review the recorded results below.");
      }
    } catch (error) {
      toast.error(formatConvexError(error, "Could not run the selected Test Lab checks."));
    }
    setRunningTests(false);
  };

  const resumeTestRun = async (runId: NonNullable<typeof activeTestRuns>[number]["_id"]) => {
    setRunningTests(true);
    try {
      const result = await resumeRun({ runId });
      setLatestResults(result.run.results);
      if (result.run.status === "passed") {
        toast.success("The recovered Test Lab run passed without live effects.");
      } else {
        toast.error("The recovered Test Lab run completed with failed checks.");
      }
    } catch (error) {
      toast.error(formatConvexError(error, "Could not recover that Test Lab run."));
    }
    setRunningTests(false);
  };

  const applyUndo = async () => {
    if (!(undoTarget && undoReason.trim() && targetIdentity)) {
      return;
    }
    setUndoPending(true);
    try {
      await undoChangeSet({
        changeSetId: undoTarget._id,
        commandId: crypto.randomUUID(),
        expectedTargetDeployment: targetIdentity.targetDeployment,
        expectedTargetEnvironment: targetIdentity.targetEnvironment,
        expectedTargetRevision: targetIdentity.targetRevision,
        reason: undoReason.trim(),
      });
      toast.success("The latest change was undone and the previous state was restored.");
      setUndoTarget(null);
      setUndoReason("");
      setLatestAppliedReceipt(null);
      onUndoClosed();
    } catch (error) {
      toast.error(formatConvexError(error, "Undo is no longer available for that change."));
    }
    setUndoPending(false);
  };

  return {
    activeTestRuns,
    applying,
    applyReviewedChanges,
    applyUndo,
    audits: history.audits,
    changeSets: history.changeSets,
    controlLabels,
    controls,
    filter,
    latestAppliedReceipt,
    latestResults,
    reason,
    receipts: history.receipts,
    recipes,
    restoration,
    resumeTestRun,
    reviewing,
    runningTests,
    runSelectedRecipes,
    search,
    selectedRecipes,
    setFilter,
    setReason,
    setRestoration,
    setReviewing,
    setSearch,
    setTestNote,
    setUndoReason,
    setUndoTarget,
    stageControl,
    staged,
    stagedRows,
    targetIdentity,
    testNote,
    testRuns: history.testRuns,
    toggleRecipe,
    undoPending,
    undoReason,
    undoTarget,
    visibleControls,
  };
}

function canLoadMore(status: string) {
  return status === "CanLoadMore";
}

export function OperationalControlsPanel() {
  const [tab, setTab] = useState<PanelTab>("controls");
  const undoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const focusUndoTrigger = () => queueMicrotask(() => undoTriggerRef.current?.focus());
  const panel = useOperationalControlsPanel(tab, focusUndoTrigger);
  const closeUndoReview = () => {
    panel.setUndoTarget(null);
    focusUndoTrigger();
  };
  if (panel.controls === undefined) {
    return (
      <section className="rounded-2xl border border-brand-border/70 bg-white/95 p-5" role="status">
        Loading feature controls…
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-brand-border/70 bg-white/95 p-4 shadow-[0_12px_34px_rgba(16,42,131,0.045)] md:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading font-semibold text-brand-dark text-lg">
              Live feature controls
            </h2>
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-brand-light px-3 text-brand-muted text-xs">
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              Admin only
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-brand-muted text-sm">
            Pause or restore individual live features. Stage any number of changes, review them
            together, then apply the complete set immediately.
          </p>
        </div>
        {panel.staged.size > 0 ? (
          <button
            className="portal-primary-btn min-h-11"
            onClick={() => {
              setTab("controls");
              panel.setReviewing(true);
            }}
            type="button"
          >
            Review {panel.staged.size} staged {panel.staged.size === 1 ? "change" : "changes"}
          </button>
        ) : null}
      </div>

      <OperationalTargetBanner identity={panel.targetIdentity} />

      <div
        aria-label="Feature control views"
        className="my-5 flex flex-wrap gap-1 rounded-full bg-brand-light p-1"
        role="tablist"
      >
        {PANEL_TABS.map((entry) => {
          const selected = tab === entry.id;
          return (
            <button
              aria-controls={`operational-panel-${entry.id}`}
              aria-selected={selected}
              className={cn(
                "min-h-11 rounded-full px-4 font-semibold text-sm focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2",
                selected
                  ? "bg-white text-brand-dark shadow-sm"
                  : "text-brand-muted hover:text-brand-dark"
              )}
              id={`operational-tab-${entry.id}`}
              key={entry.id}
              onClick={() => setTab(entry.id)}
              role="tab"
              type="button"
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby={`operational-tab-${tab}`}
        className="space-y-6"
        id={`operational-panel-${tab}`}
        role="tabpanel"
      >
        {tab === "controls" ? (
          <>
            <OperationalControlCatalog
              controlLabels={panel.controlLabels}
              controls={panel.visibleControls}
              filter={panel.filter}
              onFilterChange={panel.setFilter}
              onSearchChange={panel.setSearch}
              onStage={panel.stageControl}
              search={panel.search}
              staged={panel.staged}
            />
            {panel.reviewing && panel.stagedRows.length > 0 && panel.targetIdentity ? (
              <ChangeSetReviewPanel
                allControls={panel.controls}
                changes={panel.stagedRows}
                controlLabels={panel.controlLabels}
                identity={panel.targetIdentity}
                onApply={panel.applyReviewedChanges}
                onCancel={() => panel.setReviewing(false)}
                onReasonChange={panel.setReason}
                onRestorationChange={panel.setRestoration}
                pending={panel.applying}
                reason={panel.reason}
                restoration={panel.restoration}
              />
            ) : null}
            <LatestChangeReceipt
              changeSet={
                panel.latestAppliedReceipt
                  ? (panel.changeSets.results.find(
                      (changeSet) => changeSet._id === panel.latestAppliedReceipt?._id
                    ) ?? panel.latestAppliedReceipt)
                  : panel.changeSets.results[0]
              }
              controlLabels={panel.controlLabels}
            />
          </>
        ) : null}
        {tab === "tests" ? (
          <ProductionTestLab
            activeRuns={panel.activeTestRuns ?? []}
            canLoadMore={canLoadMore(panel.testRuns.status)}
            history={panel.testRuns.results}
            latestResults={panel.latestResults}
            note={panel.testNote}
            onLoadMore={() => panel.testRuns.loadMore(HISTORY_PAGE_SIZE)}
            onNoteChange={panel.setTestNote}
            onResume={panel.resumeTestRun}
            onRun={panel.runSelectedRecipes}
            onToggle={panel.toggleRecipe}
            pending={panel.runningTests}
            recipes={panel.recipes}
            selected={panel.selectedRecipes}
          />
        ) : null}
        {tab === "activity" ? (
          <>
            <OperationalActivity
              audits={panel.audits.results}
              canLoadMoreAudits={canLoadMore(panel.audits.status)}
              canLoadMoreChanges={canLoadMore(panel.changeSets.status)}
              canLoadMoreReceipts={canLoadMore(panel.receipts.status)}
              changeSets={panel.changeSets.results}
              controlLabels={panel.controlLabels}
              onLoadMoreAudits={() => panel.audits.loadMore(HISTORY_PAGE_SIZE)}
              onLoadMoreChanges={() => panel.changeSets.loadMore(HISTORY_PAGE_SIZE)}
              onLoadMoreReceipts={() => panel.receipts.loadMore(HISTORY_PAGE_SIZE)}
              onRequestUndo={(changeSet, trigger) => {
                undoTriggerRef.current = trigger;
                panel.setUndoTarget(changeSet);
                panel.setUndoReason("");
              }}
              receipts={panel.receipts.results}
            />
            {panel.undoTarget ? (
              <UndoReviewPanel
                changeSet={panel.undoTarget}
                controlLabels={panel.controlLabels}
                onCancel={closeUndoReview}
                onConfirm={panel.applyUndo}
                onReasonChange={panel.setUndoReason}
                pending={panel.undoPending}
                reason={panel.undoReason}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
