import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { DEFAULT_CHECKLIST } from "./jobCardConstants";

function checklistItemToTask(item: any, index: number, createdBy: string, timestamp: number) {
  return {
    category: item.category ?? item.owner ?? "Operations",
    completed: Boolean(item.done ?? item.completed),
    completedAt: item.done || item.completed ? timestamp : undefined,
    createdAt: timestamp,
    createdBy,
    dueDate: item.dueDate,
    ownerRole: item.owner,
    title: item.label ?? item.title ?? `Checklist item ${index + 1}`,
    updatedAt: timestamp,
  };
}

export async function materializeDefaultChecklistTasks(
  ctx: MutationCtx,
  jobCardId: Id<"jobCards">,
  checklist: any[],
  createdBy: string,
  timestamp = Date.now()
) {
  await Promise.all(
    (checklist.length > 0 ? checklist : DEFAULT_CHECKLIST).map((item, index) =>
      ctx.db.insert("checklistTasks", {
        jobCardId,
        ...checklistItemToTask(item, index, createdBy, timestamp),
      })
    )
  );
}

export async function getChecklistTasksWithFallback(ctx: QueryCtx | MutationCtx, job: any) {
  const tasks = await ctx.db
    .query("checklistTasks")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
    .collect();
  if (tasks.length > 0) {
    return tasks.sort((a, b) => a.createdAt - b.createdAt);
  }
  return (job.preDepartureChecklist ?? DEFAULT_CHECKLIST).map((item: any, index: number) => ({
    _id: `legacy-${job._id}-${item.key ?? index}`,
    jobCardId: job._id,
    ...checklistItemToTask(item, index, job.createdBy, job.createdAt),
    legacy: true,
  }));
}
