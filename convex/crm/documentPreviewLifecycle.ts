import { makeFunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { DocumentPreviewSourceType } from "./documentPreviewContract";

const prepareUploadedSourceRef = makeFunctionReference<
  "mutation",
  { sourceId: string; sourceType: DocumentPreviewSourceType },
  null
>("crm/documentPreview:prepareUploadedSource");
const invalidateSourceBatchRef = makeFunctionReference<
  "mutation",
  {
    sourceIds: string[];
    sourceType: "commercialFile" | "proposalAttachment" | "queryAttachment";
  },
  null
>("crm/documentPreview:invalidateSourceBatch");

const INVALIDATION_BATCH_SIZE = 25;

export async function scheduleDocumentPreviewPreparation(
  ctx: MutationCtx,
  sourceType: DocumentPreviewSourceType,
  sourceId: string
) {
  await ctx.scheduler.runAfter(0, prepareUploadedSourceRef, { sourceId, sourceType });
}

export async function scheduleDocumentPreviewInvalidationBatches(
  ctx: MutationCtx,
  sourceType: "commercialFile" | "proposalAttachment" | "queryAttachment",
  sourceIds: string[]
) {
  const batches = Array.from(
    { length: Math.ceil(sourceIds.length / INVALIDATION_BATCH_SIZE) },
    (_, index) =>
      sourceIds.slice(index * INVALIDATION_BATCH_SIZE, (index + 1) * INVALIDATION_BATCH_SIZE)
  );
  await Promise.all(
    batches.map((sourceIdsBatch) =>
      ctx.scheduler.runAfter(0, invalidateSourceBatchRef, {
        sourceIds: sourceIdsBatch,
        sourceType,
      })
    )
  );
}

export async function invalidateDocumentPreviewSource(
  ctx: MutationCtx,
  sourceType: DocumentPreviewSourceType,
  sourceId: string
) {
  const operation = await ctx.db
    .query("documentPreviewOperations")
    .withIndex("by_sourceType_and_sourceId", (q) =>
      q.eq("sourceType", sourceType).eq("sourceId", sourceId)
    )
    .unique();
  if (!operation) {
    return false;
  }
  const artifactStorageId: Id<"_storage"> | null = operation.artifactStorageId ?? null;
  await ctx.db.delete("documentPreviewOperations", operation._id);
  if (artifactStorageId) {
    await ctx.scheduler.runAfter(0, internal.crm.storageReferences.deleteIfUnreferenced, {
      storageId: artifactStorageId,
    });
  }
  return true;
}
