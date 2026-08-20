"use client";

import { ChevronDown } from "lucide-react";
import { useId, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/application-button";
import { isRuntimeNumber } from "../../../lib/runtimeValues";
import { DashboardPanel, DashboardProgress } from "./DashboardPanel";

const STORAGE_PREFIX = "portal-dashboard-collapse-";

function readCollapseOpen(key) {
  if (!("window" in globalThis)) {
    return true;
  }
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${key}`) !== "0";
  } catch {
    return true;
  }
}

function persistCollapseOpen(key, open) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, open ? "1" : "0");
    window.dispatchEvent(new window.Event("portal-dashboard-collapse"));
  } catch {
    // ignore
  }
}

function subscribeCollapseOpen(onStoreChange) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("portal-dashboard-collapse", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("portal-dashboard-collapse", onStoreChange);
  };
}

function useCollapseOpen(key) {
  return useSyncExternalStore(
    subscribeCollapseOpen,
    () => readCollapseOpen(key),
    () => true
  );
}

function CollapsiblePanelBody({ id, open, children }) {
  return (
    <div aria-hidden={open ? undefined : "true"} className="overflow-hidden" hidden={!open} id={id}>
      {children}
    </div>
  );
}

export function DashboardCollapsibleSection({
  departmentWorkflow,
  myTeam,
  showWorkflow,
  showTeam,
}) {
  const workflowOpen = useCollapseOpen("workflow");
  const teamOpen = useCollapseOpen("team");
  const workflowPanelId = `${useId().replaceAll(":", "")}-workflow`;
  const teamPanelId = `${useId().replaceAll(":", "")}-team`;

  const toggleWorkflow = () => {
    const next = !workflowOpen;
    persistCollapseOpen("workflow", next);
  };
  const toggleTeam = () => {
    const next = !teamOpen;
    persistCollapseOpen("team", next);
  };

  if (!(showWorkflow || showTeam)) {
    return null;
  }

  return (
    <div className="space-y-5">
      {showWorkflow && departmentWorkflow?.length > 0 ? (
        <DashboardPanel
          ariaLabel="Department workflow"
          title={
            <Button
              aria-controls={workflowPanelId}
              aria-expanded={workflowOpen}
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={toggleWorkflow}
              type="button"
            >
              <span>Department workflow</span>
              <ChevronDown
                aria-hidden
                className={`shrink-0 transition-transform duration-200 ease-[var(--portal-ease-out)] motion-reduce:transition-none ${workflowOpen ? "rotate-180" : ""}`}
                size={18}
              />
            </Button>
          }
        >
          <CollapsiblePanelBody id={workflowPanelId} open={workflowOpen}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {departmentWorkflow.map((item) => (
                <DashboardProgress
                  key={item.label}
                  label={`${item.label}: ${isRuntimeNumber(item.value) ? item.value.toLocaleString("en-IN") : item.value}`}
                  value={item.percent}
                />
              ))}
            </div>
          </CollapsiblePanelBody>
        </DashboardPanel>
      ) : null}
      {showTeam && myTeam?.length > 0 ? (
        <DashboardPanel
          ariaLabel="My team"
          title={
            <Button
              aria-controls={teamPanelId}
              aria-expanded={teamOpen}
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={toggleTeam}
              type="button"
            >
              <span>My team</span>
              <ChevronDown
                aria-hidden
                className={`shrink-0 transition-transform duration-200 ease-[var(--portal-ease-out)] motion-reduce:transition-none ${teamOpen ? "rotate-180" : ""}`}
                size={18}
              />
            </Button>
          }
        >
          <CollapsiblePanelBody id={teamPanelId} open={teamOpen}>
            <div className="grid gap-3 sm:grid-cols-2">
              {myTeam.map((member) => (
                <div
                  className="rounded-xl border border-brand-border bg-brand-light p-4"
                  key={member.id}
                >
                  <div className="font-semibold text-brand-dark text-sm">{member.name}</div>
                  <div className="mt-1 text-brand-muted text-xs">
                    {member.function || member.department}
                  </div>
                  <div className="mt-1 text-brand-muted text-xs">
                    {member.location || member.email}
                  </div>
                </div>
              ))}
            </div>
          </CollapsiblePanelBody>
        </DashboardPanel>
      ) : null}
    </div>
  );
}
