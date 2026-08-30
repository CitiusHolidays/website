import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  isRuntimeBoolean,
  isRuntimeObject,
  isRuntimeString,
  type RuntimeObject,
  type RuntimeValue,
} from "../lib/runtimeValues";
import { DEFAULT_CHECKLIST } from "./jobCardConstants";
import { insertWithE2eOwnership } from "./lib/e2eOwnership";
import { isStaffRole } from "./lib/rolePolicy";

interface ChecklistItem {
  category?: string;
  completed?: boolean;
  done?: boolean;
  dueDate?: string;
  key?: string;
  label?: string;
  owner?: string;
  title?: string;
}

function optionalBoolean(value: RuntimeValue) {
  return isRuntimeBoolean(value) ? value : undefined;
}

function optionalString(value: RuntimeValue) {
  return isRuntimeString(value) ? value : undefined;
}

function isRuntimeRecord(value: RuntimeValue): value is RuntimeObject {
  return (
    isRuntimeObject(value) &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Error)
  );
}

function readChecklistItems(value: RuntimeValue): ChecklistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((candidate) =>
    isRuntimeRecord(candidate)
      ? [
          {
            category: optionalString(candidate.category),
            completed: optionalBoolean(candidate.completed),
            done: optionalBoolean(candidate.done),
            dueDate: optionalString(candidate.dueDate),
            key: optionalString(candidate.key),
            label: optionalString(candidate.label),
            owner: optionalString(candidate.owner),
            title: optionalString(candidate.title),
          },
        ]
      : []
  );
}

function checklistItemToTask(
  item: ChecklistItem,
  index: number,
  createdBy: string,
  timestamp: number
) {
  return {
    category: item.category ?? item.owner ?? "Operations",
    completed: Boolean(item.done ?? item.completed),
    completedAt: item.done || item.completed ? timestamp : undefined,
    createdAt: timestamp,
    createdBy,
    dueDate: item.dueDate,
    ownerRole: item.owner && isStaffRole(item.owner) ? item.owner : undefined,
    title: item.label ?? item.title ?? `Checklist item ${index + 1}`,
    updatedAt: timestamp,
  };
}

export async function materializeDefaultChecklistTasks(
  ctx: MutationCtx,
  jobCardId: Id<"jobCards">,
  checklist: ChecklistItem[],
  createdBy: string,
  timestamp = Date.now()
) {
  await Promise.all(
    (checklist.length > 0 ? checklist : DEFAULT_CHECKLIST).map((item, index) =>
      insertWithE2eOwnership(ctx, "checklistTasks", {
        jobCardId,
        ...checklistItemToTask(item, index, createdBy, timestamp),
      })
    )
  );
}

export async function getChecklistTasksWithFallback(
  ctx: QueryCtx | MutationCtx,
  job: Doc<"jobCards">,
  maximumRows?: number
) {
  const taskQuery = ctx.db
    .query("checklistTasks")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id));
  const tasks = maximumRows ? await taskQuery.take(maximumRows) : await taskQuery.collect();
  if (tasks.length > 0) {
    return tasks.sort((a, b) => a.createdAt - b.createdAt);
  }
  const legacyItems = readChecklistItems(job.preDepartureChecklist);
  return (legacyItems.length > 0 ? legacyItems : DEFAULT_CHECKLIST).map((item, index) => ({
    jobCardId: job._id,
    legacyKey: `legacy-${job._id}-${item.key ?? index}`,
    ...checklistItemToTask(item, index, job.createdBy, job.createdAt),
  }));
}
