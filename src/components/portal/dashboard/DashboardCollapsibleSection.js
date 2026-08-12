"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { DashboardPanel, DashboardProgress } from "./DashboardPanel";

const STORAGE_PREFIX = "portal-dashboard-collapse-";

function readCollapseOpen(key) {
  if (typeof window === "undefined") {
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
  } catch {
    // ignore
  }
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
  // Keep the server and first client render identical. The saved preference is
  // request-local browser state and must be restored only after hydration.
  const [workflowOpen, setWorkflowOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const workflowPanelId = `${useId().replaceAll(":", "")}-workflow`;
  const teamPanelId = `${useId().replaceAll(":", "")}-team`;

  useEffect(() => {
    setWorkflowOpen(readCollapseOpen("workflow"));
    setTeamOpen(readCollapseOpen("team"));
  }, []);

  if (!(showWorkflow || showTeam)) {
    return null;
  }

  return (
    <div className="space-y-5">
      {showWorkflow && departmentWorkflow?.length > 0 ? (
        <DashboardPanel
          title={
            <Button
              aria-controls={workflowPanelId}
              aria-expanded={workflowOpen}
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={() => {
                const next = !workflowOpen;
                persistCollapseOpen("workflow", next);
                setWorkflowOpen(next);
              }}
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
                  label={`${item.label}: ${typeof item.value === "number" ? item.value.toLocaleString("en-IN") : item.value}`}
                  value={item.percent}
                />
              ))}
            </div>
          </CollapsiblePanelBody>
        </DashboardPanel>
      ) : null}
      {showTeam && myTeam?.length > 0 ? (
        <DashboardPanel
          title={
            <Button
              aria-controls={teamPanelId}
              aria-expanded={teamOpen}
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={() => {
                const next = !teamOpen;
                persistCollapseOpen("team", next);
                setTeamOpen(next);
              }}
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
