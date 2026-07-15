import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import {
  deleteStorageFile,
  flushDeferredNotificationCleanup,
  type NotificationEntityIdentity,
} from "./lib";

const JOB_CARD_CASCADE_PAGE_SIZE = 32;

const stageDefinitions = [
  ["travellers", "travellers", "traveller"],
  ["travelBatches", "travelBatches", "travelBatch"],
  ["visaRecords", "visaRecords", "visaRecord"],
  ["flightSegments", "flightSegments", "flightSegment"],
  ["flightGroups", "flightGroups", "flightGroup"],
  ["pnrs", "pnrs", "pnr"],
  ["tickets", "tickets", "ticket"],
  ["seatAllocations", "seatAllocations", "seatAllocation"],
  ["hotels", "hotels", "hotel"],
  ["roomingListEntries", "roomingListEntries", "roomingListEntry"],
  ["tourManagerAssignments", "tourManagerAssignments", "tourManager"],
  ["vendors", "vendors", "vendor"],
  ["itineraries", "itineraries", "itinerary"],
  ["eventFlows", "eventFlows", "eventFlow"],
  ["checklistTasks", "checklistTasks", "checklistTask"],
  ["invoices", "invoices", "invoice"],
  ["additionalServices", "additionalServices", "additionalService"],
  ["expenseEntries", "expenseEntries", "expense"],
] as const;

type JobCardCascadeStage = (typeof stageDefinitions)[number][0];
const jobCardCascadeStageValidator = v.union(
  ...stageDefinitions.map(([stage]) => v.literal(stage))
);

function stageDefinition(stage: JobCardCascadeStage) {
  const definition = stageDefinitions.find(([candidate]) => candidate === stage);
  if (!definition) {
    throw new Error(`Unknown Job Card cascade stage: ${stage}`);
  }
  return definition;
}

function nextStage(stage: JobCardCascadeStage) {
  const index = stageDefinitions.findIndex(([candidate]) => candidate === stage);
  return stageDefinitions[index + 1]?.[0] ?? null;
}

function safeFailureSummary(error: unknown) {
  if (error instanceof Error && error.message.includes("Invalid")) {
    return "Cleanup stopped because its deletion reference is no longer valid.";
  }
  return "Cleanup stopped before every linked record could be removed.";
}

async function failOperation(
  ctx: any,
  operationId: Id<"jobCardDeletionOperations">,
  error: unknown
) {
  const operation = await ctx.db.get(operationId);
  if (!operation || operation.status !== "running") {
    return;
  }
  const now = Date.now();
  await ctx.db.patch(operationId, {
    failedAt: now,
    failureSummary: safeFailureSummary(error),
    lastProgressAt: now,
    status: "failed",
  });
}

async function finalizeIfReady(ctx: any, operationId: Id<"jobCardDeletionOperations">) {
  const operation = await ctx.db.get(operationId);
  if (!operation || operation.status !== "running" || operation.stage !== "finishingDescendants") {
    return false;
  }
  const pendingWorker = await ctx.db
    .query("jobCardDeletionWorkers")
    .withIndex("by_operation_status", (q: any) =>
      q.eq("operationId", operationId).eq("status", "running")
    )
    .first();
  if (pendingWorker) {
    return false;
  }
  const now = Date.now();
  await ctx.db.patch(operationId, {
    completedAt: now,
    lastProgressAt: now,
    stage: "complete",
    status: "complete",
  });
  return true;
}

async function completeWorker(
  ctx: any,
  operationId: Id<"jobCardDeletionOperations">,
  workerId: Id<"jobCardDeletionWorkers">
) {
  const worker = await ctx.db.get(workerId);
  if (!worker || worker.operationId !== operationId || worker.status === "complete") {
    return;
  }
  const now = Date.now();
  await ctx.db.patch(workerId, { completedAt: now, status: "complete" });
  await ctx.db.patch(operationId, { lastProgressAt: now });
  await finalizeIfReady(ctx, operationId);
}

async function registerWorker(
  ctx: any,
  operationId: Id<"jobCardDeletionOperations">,
  kind: "approval" | "traveller",
  workerKey: string
) {
  const existing = await ctx.db
    .query("jobCardDeletionWorkers")
    .withIndex("by_operation_workerKey", (q: any) =>
      q.eq("operationId", operationId).eq("workerKey", workerKey)
    )
    .first();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("jobCardDeletionWorkers", {
    kind,
    operationId,
    status: "running",
    workerKey,
  });
}

function incrementStageCount(
  stageCounts: Array<{ count: number; stage: string }>,
  stage: string,
  count: number
) {
  const existing = stageCounts.find((entry) => entry.stage === stage);
  return existing
    ? stageCounts.map((entry) =>
        entry.stage === stage ? { ...entry, count: entry.count + count } : entry
      )
    : [...stageCounts, { count, stage }];
}

export const continueApprovalCleanup = internalMutation({
  args: {
    approvalEntityId: v.string(),
    approvalEntityType: v.string(),
    operationId: v.optional(v.id("jobCardDeletionOperations")),
    workerId: v.optional(v.id("jobCardDeletionWorkers")),
  },
  handler: async (ctx, args) => {
    try {
      const rows = await ctx.db
        .query("approvalRequests")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", args.approvalEntityType).eq("entityId", args.approvalEntityId)
        )
        .take(JOB_CARD_CASCADE_PAGE_SIZE);
      await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
      await flushDeferredNotificationCleanup(
        ctx,
        rows.map((row) => ({ entityId: String(row._id), entityType: "approval" }))
      );
      if (rows.length === JOB_CARD_CASCADE_PAGE_SIZE) {
        await ctx.scheduler.runAfter(0, internal.crm.jobCardDeletion.continueApprovalCleanup, args);
      } else if (args.operationId && args.workerId) {
        await completeWorker(ctx, args.operationId, args.workerId);
      }
      return { complete: rows.length < JOB_CARD_CASCADE_PAGE_SIZE, deleted: rows.length };
    } catch (error) {
      if (args.operationId) {
        await failOperation(ctx, args.operationId, error);
        return { complete: false, deleted: 0 };
      }
      throw error;
    }
  },
});

export const continueJobCardCascade = internalMutation({
  args: {
    jobCardId: v.string(),
    operationId: v.id("jobCardDeletionOperations"),
    stage: jobCardCascadeStageValidator,
  },
  handler: async (ctx, args) => {
    try {
      const operation = await ctx.db.get(args.operationId);
      if (!operation || operation.status !== "running" || operation.stage !== args.stage) {
        return { complete: operation?.status === "complete", deleted: 0 };
      }
      const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
      if (!jobCardId) {
        throw new Error("Invalid Job Card cleanup identity");
      }
      const [, tableName, entityType] = stageDefinition(args.stage);
      const rows = await (ctx.db.query as any)(tableName)
        .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", jobCardId))
        .take(JOB_CARD_CASCADE_PAGE_SIZE);
      const notifications: NotificationEntityIdentity[] = [];
      await Promise.all(
        rows.map(async (row: any) => {
          if (args.stage === "travellers") {
            const workerId = await registerWorker(
              ctx,
              args.operationId,
              "traveller",
              `traveller:${String(row._id)}`
            );
            await ctx.scheduler.runAfter(0, internal.crm.travellers.continueTravellerCleanup, {
              mode: "private",
              operationId: args.operationId,
              stage: "passportDetails",
              travellerId: String(row._id),
              workerId,
            });
          }
          if (args.stage === "expenseEntries") {
            if (row.proofAttachmentId) {
              const attachment = await ctx.db.get(row.proofAttachmentId as Id<"attachments">);
              if (attachment) {
                await deleteStorageFile(ctx, attachment.storageId, "expense proof");
                await ctx.db.delete(attachment._id);
              }
            }
            const workerId = await registerWorker(
              ctx,
              args.operationId,
              "approval",
              `approval:${String(row._id)}`
            );
            await ctx.scheduler.runAfter(0, internal.crm.jobCardDeletion.continueApprovalCleanup, {
              approvalEntityId: String(row._id),
              approvalEntityType: "expense",
              operationId: args.operationId,
              workerId,
            });
          }
          notifications.push({ entityId: String(row._id), entityType });
          await ctx.db.delete(row._id);
        })
      );
      await flushDeferredNotificationCleanup(ctx, notifications);

      const followingStage =
        rows.length === JOB_CARD_CASCADE_PAGE_SIZE ? args.stage : nextStage(args.stage);
      const now = Date.now();
      await ctx.db.patch(args.operationId, {
        deletedCount: operation.deletedCount + rows.length,
        lastProgressAt: now,
        stage: followingStage ?? "finishingDescendants",
        stageCounts: incrementStageCount(operation.stageCounts, args.stage, rows.length),
      });
      if (followingStage) {
        await ctx.scheduler.runAfter(0, internal.crm.jobCardDeletion.continueJobCardCascade, {
          jobCardId: args.jobCardId,
          operationId: args.operationId,
          stage: followingStage,
        });
      } else {
        await finalizeIfReady(ctx, args.operationId);
      }
      return { complete: !followingStage, deleted: rows.length };
    } catch (error) {
      await failOperation(ctx, args.operationId, error);
      return { complete: false, deleted: 0 };
    }
  },
});

export async function completeJobCardDeletionWorker(
  ctx: any,
  operationId: Id<"jobCardDeletionOperations">,
  workerId: Id<"jobCardDeletionWorkers">
) {
  await completeWorker(ctx, operationId, workerId);
}

export async function failJobCardDeletionOperation(
  ctx: any,
  operationId: Id<"jobCardDeletionOperations">,
  error: unknown
) {
  await failOperation(ctx, operationId, error);
}
