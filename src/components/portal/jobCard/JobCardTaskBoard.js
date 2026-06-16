"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { formatDisplayDate } from "@/lib/formatDate";

const EMPTY_TASKS = [];

export default function JobCardTaskBoard({ tasks = EMPTY_TASKS }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {tasks.map((task) => (
        <div key={task._id} className="rounded-lg border border-brand-border bg-white p-4">
          <div className="flex items-start gap-3">
            {task.completed ? (
              <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 size-4 text-brand-muted" />
            )}
            <div>
              <p className="font-heading text-sm text-brand-dark">{task.title}</p>
              <p className="mt-1 font-sans text-xs text-brand-muted">
                {task.category}
                {task.dueDate ? ` · Due ${formatDisplayDate(task.dueDate)}` : ""}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
