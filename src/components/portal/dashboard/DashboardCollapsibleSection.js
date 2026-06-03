"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { DashboardPanel, DashboardProgress } from "./DashboardPanel";

const STORAGE_PREFIX = "portal-dashboard-collapse-";

function readCollapseOpen(key) {
  if (typeof window === "undefined") return true;
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

export function DashboardCollapsibleSection({
  departmentWorkflow,
  myTeam,
  showWorkflow,
  showTeam,
}) {
  const [workflowOpen, setWorkflowOpen] = useState(() => readCollapseOpen("workflow"));
  const [teamOpen, setTeamOpen] = useState(() => readCollapseOpen("team"));

  if (!showWorkflow && !showTeam) return null;

  return (
    <div className="space-y-5">
      {showWorkflow && departmentWorkflow?.length > 0 ? (
        <DashboardPanel
          title={
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={() => {
                setWorkflowOpen((open) => {
                  const next = !open;
                  persistCollapseOpen("workflow", next);
                  return next;
                });
              }}
              aria-expanded={workflowOpen}
            >
              <span>Department workflow</span>
              <ChevronDown
                size={18}
                className={`shrink-0 transition ${workflowOpen ? "rotate-180" : ""}`}
              />
            </button>
          }
        >
          {workflowOpen ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {departmentWorkflow.map((item) => (
                <DashboardProgress
                  key={item.label}
                  label={`${item.label}: ${typeof item.value === "number" ? item.value.toLocaleString("en-IN") : item.value}`}
                  value={item.percent}
                />
              ))}
            </div>
          ) : null}
        </DashboardPanel>
      ) : null}
      {showTeam && myTeam?.length > 0 ? (
        <DashboardPanel
          title={
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={() => {
                setTeamOpen((open) => {
                  const next = !open;
                  persistCollapseOpen("team", next);
                  return next;
                });
              }}
              aria-expanded={teamOpen}
            >
              <span>My team</span>
              <ChevronDown
                size={18}
                className={`shrink-0 transition ${teamOpen ? "rotate-180" : ""}`}
              />
            </button>
          }
        >
          {teamOpen ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {myTeam.map((member) => (
                <div
                  key={member.id}
                  className="rounded-xl border border-brand-border bg-brand-light p-4"
                >
                  <div className="text-sm font-semibold text-brand-dark">{member.name}</div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {member.function || member.department}
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {member.location || member.email}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </DashboardPanel>
      ) : null}
    </div>
  );
}
