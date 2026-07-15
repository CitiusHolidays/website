import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";

export const fileOperationSuccessValidator = v.object({ success: v.boolean() });
export const uploadUrlResultValidator = v.string();
export const downloadFileResultValidator = v.object({
  bytes: v.bytes(),
  fileName: v.string(),
  mimeType: v.string(),
});
export const nullableDownloadFileResultValidator = v.union(v.null(), downloadFileResultValidator);

export const queryAttachmentOutputValidator = v.object({
  createdAt: v.string(),
  fileName: v.string(),
  fileSize: v.number(),
  id: v.id("queryAttachments"),
  mimeType: v.string(),
});
export const queryAttachmentListPageResultValidator = paginationResultValidator(
  queryAttachmentOutputValidator
);
export const queryAttachmentRecordResultValidator = v.union(
  v.null(),
  v.object({
    fileName: v.string(),
    id: v.id("queryAttachments"),
    mimeType: v.string(),
    queryId: v.id("queries"),
    storageId: v.id("_storage"),
  })
);

export const proposalAttachmentOutputValidator = v.object({
  createdAt: v.string(),
  fileName: v.string(),
  fileSize: v.number(),
  id: v.id("proposalAttachments"),
  mimeType: v.string(),
});
export const proposalAttachmentListResultValidator = v.array(proposalAttachmentOutputValidator);
export const proposalAttachmentRecordResultValidator = v.union(
  v.null(),
  v.object({
    fileName: v.string(),
    id: v.id("proposalAttachments"),
    mimeType: v.string(),
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
  })
);
export const proposalAccessResultValidator = v.object({ id: v.id("proposals") });
export const finalizedPdfRecordResultValidator = v.union(
  v.null(),
  v.object({
    fileName: v.string(),
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
  })
);
