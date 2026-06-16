"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDisplayDate } from "@/lib/formatDate";
import { buildJobCardCommandCenter } from "@/lib/portal/jobCardCommandCenter";
import JobCardReadinessMap from "./JobCardReadinessMap";
import JobCardTaskBoard from "./JobCardTaskBoard";

export default function JobCardCommandCenter({ jobCardId }) {
  const payload = useQuery(api.crm.jobCards.getCommandCenter, { jobCardId });
  const [tasksOpen, setTasksOpen] = useState(false);
  if (payload === undefined) {
    return <div className="h-64 animate-pulse rounded-lg bg-brand-light" />;
  }
  const model = buildJobCardCommandCenter(payload);
  const job = payload.jobCard;
  const tasks = payload.checklistTasks ?? [];
  const completedCount = tasks.filter((task) => task.completed).length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-brand-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href="/portal/job-cards" className="font-sans text-xs text-citius-blue">
              Back to Job Cards
            </Link>
            <h1 className="mt-1 font-heading text-xl font-semibold text-brand-dark">{job.jobCode}</h1>
            <p className="font-sans text-sm text-brand-muted">
              {job.clientName} · {job.destination || "Destination pending"}
              {job.travelStartDate
                ? ` · ${formatDisplayDate(job.travelStartDate)}${job.travelEndDate ? ` – ${formatDisplayDate(job.travelEndDate)}` : ""}`
                : ""}
            </p>
          </div>
          <div className="text-right font-sans text-xs text-brand-muted">
            <div>{job.status}</div>
            <div className="mt-1">
              Contracting: {job.contractingOwnerName || "Unassigned"}
            </div>
          </div>
        </div>
      </section>
      <JobCardReadinessMap sections={model.readinessSections} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-lg border border-brand-border bg-white">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            onClick={() => setTasksOpen((open) => !open)}
            aria-expanded={tasksOpen}
          >
            <div>
              <h2 className="font-heading text-base text-brand-dark">Checklist tasks</h2>
              <p className="font-sans text-xs text-brand-muted">
                {completedCount} / {tasks.length} complete
              </p>
            </div>
            <ChevronDown
              size={18}
              className={`shrink-0 text-brand-muted transition ${tasksOpen ? "rotate-180" : ""}`}
            />
          </button>
          {tasksOpen ? (
            <div className="border-t border-brand-border px-4 py-3">
              <JobCardTaskBoard tasks={tasks} />
            </div>
          ) : null}
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg border border-brand-border bg-white p-4">
            <h2 className="font-heading text-base text-brand-dark">Blockers</h2>
            <ul className="mt-3 space-y-2">
              {model.blockers.length === 0 ? (
                <li className="font-sans text-sm text-brand-muted">No readiness blockers.</li>
              ) : (
                model.blockers.map((blocker) => (
                  <li key={blocker.key} className="font-sans text-sm text-brand-muted">
                    {blocker.label}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="rounded-lg border border-brand-border bg-white p-4">
            <h2 className="font-heading text-base text-brand-dark">Next actions</h2>
            <ul className="mt-3 space-y-2">
              {model.nextActions.slice(0, 8).map((action) => (
                <li key={action.id} className="font-sans text-sm text-brand-muted">
                  {action.label}
                  {action.dueDate ? ` · ${action.dueDate}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
