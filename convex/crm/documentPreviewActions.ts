import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import { validateDocumentPreviewArtifact } from "./documentPreviewArtifact";
import {
  type DocumentPreviewFileResult,
  type DocumentPreviewSourceType,
  documentPreviewFileResultValidator,
  documentPreviewKindValidator,
  documentPreviewSourceTypeValidator,
} from "./documentPreviewContract";
import {
  createDocumentPreviewDeliveryToken,
  hashDocumentPreviewDeliveryToken,
} from "./documentPreviewToken";
import { enforcePortalFileDownloadLimit } from "./lib/portalFileDownloadLimit";

interface AuthorizedFileState {
  artifactMimeType?: string;
  artifactStorageId?: Id<"_storage">;
  canRetry: boolean;
  encrypted: boolean;
  errorCode?: string;
  fileName: string;
  generation: number;
  mimeType: string;
  previewKind: "image" | "pdf" | "presentation" | "spreadsheet" | "text" | "unsupported" | "word";
  sourceStorageId: Id<"_storage">;
  status: "preparing" | "ready" | "unavailable";
  warningCodes: string[];
}

const getAuthorizedFileStateRef = makeFunctionReference<
  "query",
  { sourceId: string; sourceType: DocumentPreviewSourceType },
  AuthorizedFileState | null
>("crm/documentPreview:getAuthorizedFileState");
const requestPreparationRef = makeFunctionReference<
  "mutation",
  { sourceId: string; sourceType: DocumentPreviewSourceType },
  unknown
>("crm/documentPreview:requestPreparation");
const issuePortalDeliveryRef = makeFunctionReference<
  "mutation",
  {
    deliveryStorageId: Id<"_storage">;
    expectedSourceStorageId: Id<"_storage">;
    generation: number;
    previewKind: AuthorizedFileState["previewKind"];
    servingArtifact: boolean;
    sourceId: string;
    sourceType: DocumentPreviewSourceType;
    tokenHash: string;
    warningCodes: string[];
  },
  { expiresAt: number }
>("crm/documentPreview:issuePortalDelivery");
const issueWorkerDeliveryRef = makeFunctionReference<
  "mutation",
  {
    generation: number;
    leaseId: string;
    operationId: Id<"documentPreviewOperations">;
    tokenHash: string;
  },
  {
    expiresAt: number;
    fileName: string;
    generation: number;
    mimeType: string;
    operationId: Id<"documentPreviewOperations">;
    previewKind: "presentation" | "spreadsheet" | "word";
  } | null
>("crm/documentPreview:issueWorkerDelivery");

interface ClaimedSource {
  encrypted: boolean;
  fileName: string;
  generation: number;
  mimeType: string;
  operationId: Id<"documentPreviewOperations">;
  previewKind: "presentation" | "spreadsheet" | "word";
  sourceStorageId: Id<"_storage">;
}

const getClaimedSourceRef = makeFunctionReference<
  "query",
  {
    generation: number;
    leaseId: string;
    operationId: Id<"documentPreviewOperations">;
  },
  ClaimedSource | null
>("crm/documentPreview:getClaimedSource");
const commitValidatedPreparationRef = makeFunctionReference<
  "mutation",
  {
    artifactMimeType: string;
    artifactStorageId: Id<"_storage">;
    durationMs: number;
    generation: number;
    leaseId: string;
    operationId: Id<"documentPreviewOperations">;
    pageCount?: number;
    sheetCount?: number;
    validationErrorCode?:
      | "conversion_failed"
      | "corrupt"
      | "encrypted"
      | "expansion_limit"
      | "processing_timeout"
      | "resource_limit"
      | "signature_mismatch"
      | "unsafe_content"
      | "unsupported_format"
      | "worker_unavailable";
    warningCodes: string[];
  },
  { accepted: boolean }
>("crm/documentPreview:commitValidatedPreparation");

export const getPreviewFile = action({
  args: { sourceId: v.string(), sourceType: documentPreviewSourceTypeValidator },
  handler: async (ctx, args): Promise<DocumentPreviewFileResult> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access?.allowed) {
      throw new ConvexError("FORBIDDEN");
    }
    await enforcePortalFileDownloadLimit(ctx, access);
    let state = await ctx.runQuery(getAuthorizedFileStateRef, args);
    if (!state) {
      throw new ConvexError("FORBIDDEN");
    }
    if (
      state.status === "preparing" &&
      (state.previewKind === "word" ||
        state.previewKind === "presentation" ||
        state.previewKind === "spreadsheet")
    ) {
      await ctx.runMutation(requestPreparationRef, args);
      state = await ctx.runQuery(getAuthorizedFileStateRef, args);
      if (!state) {
        throw new ConvexError("FORBIDDEN");
      }
    }
    const isOffice =
      state.previewKind === "word" ||
      state.previewKind === "presentation" ||
      state.previewKind === "spreadsheet";
    if (state.status === "unavailable" && !(isOffice && state.canRetry)) {
      return {
        canRetry: state.canRetry,
        // SAFETY: state.errorCode is produced by documentPreviewErrorCodeValidator; null maps to the contract fallback.
        errorCode: (state.errorCode ?? "conversion_failed") as
          | "conversion_failed"
          | "corrupt"
          | "encrypted"
          | "expansion_limit"
          | "processing_timeout"
          | "resource_limit"
          | "signature_mismatch"
          | "unsafe_content"
          | "unsupported_format"
          | "worker_unavailable",
        generation: state.generation,
        previewKind: state.previewKind,
        status: "unavailable",
      };
    }

    // The current Staff Workspace renderer consumes original Office bytes in
    // isolated browser workers. Paged PDF artifacts are compatible with the
    // Word/PowerPoint renderer; spreadsheet JSON is not yet a shared contract.
    const artifactReady = Boolean(
      state.status === "ready" &&
        (state.previewKind === "word" || state.previewKind === "presentation") &&
        state.artifactStorageId &&
        state.artifactMimeType === "application/pdf"
    );
    const storageId = artifactReady ? state.artifactStorageId : state.sourceStorageId;
    if (!storageId) {
      throw new ConvexError("Preview artifact is no longer available");
    }
    const deliveryToken = createDocumentPreviewDeliveryToken();
    const tokenHash = await hashDocumentPreviewDeliveryToken(deliveryToken);
    const delivery = await ctx.runMutation(issuePortalDeliveryRef, {
      deliveryStorageId: storageId,
      expectedSourceStorageId: state.sourceStorageId,
      generation: state.generation,
      previewKind: state.previewKind,
      servingArtifact: artifactReady,
      sourceId: args.sourceId,
      sourceType: args.sourceType,
      tokenHash,
      warningCodes: state.warningCodes,
    });
    return {
      deliveryToken,
      expiresAt: delivery.expiresAt,
      fileName: state.fileName,
      generation: state.generation,
      mimeType: artifactReady ? "application/pdf" : state.mimeType,
      previewKind: state.previewKind,
      status: "ready",
      warningCodes: state.warningCodes,
    };
  },
  returns: documentPreviewFileResultValidator,
});

// First-party conversion worker boundary. The caller must claim an operation
// through claimNextPreparation, then fetch bytes with the same opaque lease.
// The isolated converter must have no network access and must commit only
// inert PDF (Word/PowerPoint) or JSON (spreadsheet) artifacts through
// completePreparation. Raw source bytes and storage IDs never cross to UI APIs.
export const getClaimedSourceFile = internalAction({
  args: {
    generation: v.number(),
    leaseId: v.string(),
    operationId: v.id("documentPreviewOperations"),
  },
  handler: async (ctx, args) => {
    const deliveryToken = createDocumentPreviewDeliveryToken();
    const tokenHash = await hashDocumentPreviewDeliveryToken(deliveryToken);
    const source = await ctx.runMutation(issueWorkerDeliveryRef, { ...args, tokenHash });
    if (!source) {
      throw new ConvexError("Preview preparation lease is invalid or stale");
    }
    return {
      deliveryToken,
      expiresAt: source.expiresAt,
      fileName: source.fileName,
      generation: source.generation,
      mimeType: source.mimeType,
      operationId: source.operationId,
      previewKind: source.previewKind,
    };
  },
  returns: v.object({
    deliveryToken: v.string(),
    expiresAt: v.number(),
    fileName: v.string(),
    generation: v.number(),
    mimeType: v.string(),
    operationId: v.id("documentPreviewOperations"),
    previewKind: documentPreviewKindValidator,
  }),
});

export const completePreparation = internalAction({
  args: {
    artifactMimeType: v.string(),
    artifactStorageId: v.id("_storage"),
    durationMs: v.number(),
    generation: v.number(),
    leaseId: v.string(),
    operationId: v.id("documentPreviewOperations"),
    pageCount: v.optional(v.number()),
    sheetCount: v.optional(v.number()),
    warningCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.runQuery(getClaimedSourceRef, {
      generation: args.generation,
      leaseId: args.leaseId,
      operationId: args.operationId,
    });
    const blob = source ? await ctx.storage.get(args.artifactStorageId) : null;
    const validation =
      source && blob
        ? await validateDocumentPreviewArtifact(blob, source.previewKind)
        : { valid: false as const };
    return await ctx.runMutation(commitValidatedPreparationRef, {
      ...args,
      validationErrorCode: validation.valid ? undefined : (validation.errorCode ?? "corrupt"),
    });
  },
  returns: v.object({ accepted: v.boolean() }),
});
