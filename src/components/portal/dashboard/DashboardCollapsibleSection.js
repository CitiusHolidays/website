"use client";

import { ChevronDown } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { useMotionUITransition } from "@/components/motion-ui/ui-theme";
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

function CollapsiblePanelBody({ open, children }) {
  const uiTransition = useMotionUITransition("ui");

  return (
    <m.div
      animate={{ opacity: open ? 1 : 0 }}
      className={`grid transition-[grid-template-rows] duration-200 ease-[var(--portal-ease-out)] motion-reduce-spatial ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
      initial={false}
      transition={{ duration: uiTransition.duration, ease: "linear" }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </m.div>
  );
}

export function DashboardCollapsibleSection({
  departmentWorkflow,
  myTeam,
  showWorkflow,
  showTeam,
}) {
  const [workflowOpen, setWorkflowOpen] = useState(() => readCollapseOpen("workflow"));
  const [teamOpen, setTeamOpen] = useState(() => readCollapseOpen("team"));

  if (!(showWorkflow || showTeam)) {
    return null;
  }

  return (
    <div className="space-y-5">
      {showWorkflow && departmentWorkflow?.length > 0 ? (
        <DashboardPanel
          title={
            <button
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
                className={`shrink-0 transition-transform duration-200 ease-[var(--portal-ease-out)] ${workflowOpen ? "rotate-180" : ""}`}
                size={18}
              />
            </button>
          }
        >
          <CollapsiblePanelBody open={workflowOpen}>
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
            <button
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
                className={`shrink-0 transition-transform duration-200 ease-[var(--portal-ease-out)] ${teamOpen ? "rotate-180" : ""}`}
                size={18}
              />
            </button>
          }
        >
          <CollapsiblePanelBody open={teamOpen}>
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
