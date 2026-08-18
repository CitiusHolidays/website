import { makeFunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { DocumentPreviewSourceType } from "./documentPreviewContract";

const recordCompletedAccessRef = makeFunctionReference<
  "mutation",
  {
    expectedSourceStorageId: Id<"_storage">;
    operation: "download" | "preview";
    sourceId: string;
    sourceType: DocumentPreviewSourceType;
  },
  null
>("crm/documentPreview:recordCompletedAccess");

export async function recordCompletedDocumentAccess(
  ctx: Pick<ActionCtx, "runMutation">,
  args: {
    expectedSourceStorageId: Id<"_storage">;
    operation: "download" | "preview";
    sourceId: string;
    sourceType: DocumentPreviewSourceType;
  }
) {
  await ctx.runMutation(recordCompletedAccessRef, args);
}
