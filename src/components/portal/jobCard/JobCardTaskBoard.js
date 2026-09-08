"use client";

import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatDisplayDate } from "@/lib/formatDate";

const EMPTY_TASKS = [];

function ChecklistEntries({ tasks }) {
  return (
    <ul className="mt-2 space-y-3">
      {tasks.map((task) => (
        <li className="flex items-start gap-2" key={task._id ?? task.legacyKey}>
          {task.completed ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-700" />
          ) : (
            <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-muted" />
          )}
          <div className="min-w-0">
            <p className="font-sans text-brand-dark text-sm">{task.title}</p>
            <p className="mt-1 font-sans text-brand-muted text-xs">
              {task.completed ? "Complete" : "Pending"} · {task.category}
              {task.dueDate ? ` · Due ${formatDisplayDate(task.dueDate)}` : ""}
            </p>
            <p className="font-sans text-brand-muted text-xs">
              Owner: {task.ownerRole || "Not recorded"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TaskActions({ actions, checklistRef, sectionKey, tasks }) {
  if (sectionKey === "checklist") {
    const action = actions.find((candidate) => candidate.status === "available" && candidate.href);
    return (
      <details className="mt-2" id="checklist-tasks" ref={checklistRef}>
        <summary className="min-h-11 cursor-pointer content-center font-sans font-semibold text-citius-blue text-sm focus-visible:outline-2 focus-visible:outline-offset-2">
          {action?.label || "Checklist entries"}
        </summary>
        {tasks.length ? (
          <ChecklistEntries tasks={tasks} />
        ) : (
          <p className="font-sans text-brand-muted text-sm">No checklist entries recorded.</p>
        )}
      </details>
    );
  }
  return actions.map((action) =>
    action.status === "available" && action.href ? (
      <Link
        className="mt-2 inline-flex min-h-11 items-center font-sans font-semibold text-citius-blue text-sm hover:underline"
        href={action.href}
        key={action.id}
      >
        {action.label}
      </Link>
    ) : (
      <p className="mt-2 font-sans text-brand-muted text-xs" key={action.id}>
        {action.label} · Continue with {action.owner.label}
      </p>
    )
  );
}

export default function JobCardTaskBoard({
  actions = EMPTY_TASKS,
  blockers = EMPTY_TASKS,
  money,
  sections = EMPTY_TASKS,
  tasks = EMPTY_TASKS,
}) {
  const checklistRef = useRef(null);
  useEffect(() => {
    const revealChecklist = () => {
      if (window.location.hash === "#checklist-tasks" && checklistRef.current) {
        checklistRef.current.open = true;
      }
    };
    revealChecklist();
    window.addEventListener("hashchange", revealChecklist);
    return () => window.removeEventListener("hashchange", revealChecklist);
  }, []);

  return (
    <section
      aria-labelledby="job-card-tasks-heading"
      className="rounded-lg border border-brand-border bg-white"
    >
      <h2 className="px-4 pt-4 font-heading text-base text-brand-dark" id="job-card-tasks-heading">
        Tasks
      </h2>
      {sections.length === 0 ? (
        <p className="p-4 font-sans text-brand-muted text-sm">Task status is unavailable.</p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {sections
            .toSorted((left, right) => Number(left.complete) - Number(right.complete))
            .map((section) => {
              const sectionActions = actions.filter((action) => action.sectionKey === section.key);
              const sectionBlockers = blockers.filter((blocker) => blocker.key === section.key);
              const owner = section.owner ?? sectionActions[0]?.owner;
              return (
                <li className="p-4" key={section.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-sans font-semibold text-brand-dark text-sm">
                      {section.label}
                    </h3>
                    {section.total > 0 || !section.complete ? (
                      <p className="font-sans text-brand-muted text-xs tabular-nums">
                        {section.complete ? "Complete · " : ""}
                        {section.done} / {section.total}
                        {section.coverage === "partial" ? " · Partial snapshot" : ""}
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-1 font-sans text-brand-muted text-xs">
                    Owner: {owner?.label || "Not recorded"}
                  </p>
                  {sectionBlockers.map((blocker) => (
                    <p className="mt-2 font-sans text-amber-900 text-sm" key={blocker.label}>
                      {blocker.severity === "critical" ? "Action needed: " : "Review: "}
                      {blocker.label}
                    </p>
                  ))}
                  {section.key === "finance" ? (
                    <p className="mt-2 font-sans text-brand-muted text-sm">{money.label}</p>
                  ) : null}
                  <TaskActions
                    actions={sectionActions}
                    checklistRef={checklistRef}
                    sectionKey={section.key}
                    tasks={tasks}
                  />
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}
