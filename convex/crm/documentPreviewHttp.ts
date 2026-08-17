import { makeFunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import { httpAction } from "../_generated/server";
import type { DocumentPreviewKind, DocumentPreviewSourceType } from "./documentPreviewContract";
import { hashDocumentPreviewDeliveryToken } from "./documentPreviewToken";
import { assertSafeImagePreview } from "./lib/documentPreviewImageSafety";

interface DeliveryClaim {
  deliveryId: Id<"documentPreviewDeliveries">;
  encrypted: boolean;
  expectedSourceStorageId: Id<"_storage">;
  fileName: string;
  generation: number;
  mimeType: string;
  previewKind: DocumentPreviewKind;
  servingArtifact: boolean;
  sourceId: string;
  sourceType: DocumentPreviewSourceType;
  storageId: Id<"_storage">;
  warningCodes: string[];
}

const claimPortalDeliveryRef = makeFunctionReference<
  "mutation",
  { tokenHash: string },
  DeliveryClaim | null
>("crm/documentPreview:claimPortalDelivery");
const completePortalDeliveryRef = makeFunctionReference<
  "mutation",
  { deliveryId: Id<"documentPreviewDeliveries"> },
  boolean
>("crm/documentPreview:completePortalDelivery");
const claimWorkerDeliveryRef = makeFunctionReference<
  "mutation",
  { tokenHash: string },
  DeliveryClaim | null
>("crm/documentPreview:claimWorkerDelivery");
const completeWorkerDeliveryRef = makeFunctionReference<
  "mutation",
  { deliveryId: Id<"documentPreviewDeliveries"> },
  boolean
>("crm/documentPreview:completeWorkerDelivery");
const cancelDeliveryRef = makeFunctionReference<
  "mutation",
  { deliveryId: Id<"documentPreviewDeliveries"> },
  null
>("crm/documentPreview:cancelDelivery");
const recoverMissingArtifactRef = makeFunctionReference<
  "mutation",
  {
    expectedArtifactStorageId: Id<"_storage">;
    sourceId: string;
    sourceType: DocumentPreviewSourceType;
  },
  null
>("crm/documentPreview:recoverMissingArtifact");

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
} as const;
const PASSPORT_IV_BYTES = 16;
const PASSPORT_TAG_BYTES = 16;
const DELIVERY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/u;

function privateJson(error: string, status: number) {
  return Response.json({ error }, { headers: PRIVATE_HEADERS, status });
}

function safeFileName(value: string) {
  return (
    value
      .replace(/[\r\n\\"]/g, "_")
      .replace(/[^\w .,@()[\]-]/g, "_")
      .trim() || "document"
  );
}

function deliveryTokenFromRequest(request: Request) {
  const token = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
  return DELIVERY_TOKEN_PATTERN.test(token) ? token : null;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function decryptPassportFile(bytes: Uint8Array) {
  const encodedKey = process.env.ENCRYPTION_KEY;
  if (!(encodedKey && crypto.subtle) || bytes.length <= PASSPORT_IV_BYTES + PASSPORT_TAG_BYTES) {
    return null;
  }
  const keyBytes = base64ToBytes(encodedKey);
  const iv = new Uint8Array(bytes.slice(0, PASSPORT_IV_BYTES));
  const tag = bytes.slice(PASSPORT_IV_BYTES, PASSPORT_IV_BYTES + PASSPORT_TAG_BYTES);
  const ciphertext = bytes.slice(PASSPORT_IV_BYTES + PASSPORT_TAG_BYTES);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { length: 256, name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    return new Uint8Array(await crypto.subtle.decrypt({ iv, name: "AES-GCM" }, key, combined));
  } catch {
    return null;
  }
}

async function workerRequestIsAuthorized(request: Request) {
  const configured = process.env.DOCUMENT_PREVIEW_WORKER_SECRET?.trim();
  const provided = request.headers.get("x-document-preview-worker-secret")?.trim();
  if (!(configured && provided)) {
    return false;
  }
  const [configuredHash, providedHash] = await Promise.all([
    hashDocumentPreviewDeliveryToken(configured),
    hashDocumentPreviewDeliveryToken(provided),
  ]);
  let difference = Number(configuredHash.length !== providedHash.length);
  for (let index = 0; index < configuredHash.length; index += 1) {
    difference += Number(configuredHash[index] !== providedHash[index]);
  }
  return difference === 0;
}

async function readDeliveryBytes(
  ctx: { storage: { get: (id: Id<"_storage">) => Promise<Blob | null> } },
  claim: DeliveryClaim
) {
  const blob = await ctx.storage.get(claim.storageId);
  if (!blob) {
    return null;
  }
  const stored = new Uint8Array(await blob.arrayBuffer());
  return claim.encrypted ? await decryptPassportFile(stored) : stored;
}

function deliveryResponse(bytes: Uint8Array, claim: DeliveryClaim) {
  const fileName = safeFileName(claim.fileName);
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new Response(new Blob([body], { type: claim.mimeType }).stream(), {
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Disposition": `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(bytes.byteLength),
      "Content-Type": claim.mimeType,
      "X-Document-Preview-Generation": String(claim.generation),
      "X-Document-Preview-Kind": claim.previewKind,
      "X-Document-Preview-Warnings": claim.warningCodes.join(","),
    },
    status: 200,
  });
}

export const portalDocumentPreviewDelivery = httpAction(async (ctx, request) => {
  const token = deliveryTokenFromRequest(request);
  if (!token) {
    return privateJson("Preview delivery not found", 404);
  }
  try {
    const claim = await ctx.runMutation(claimPortalDeliveryRef, {
      tokenHash: await hashDocumentPreviewDeliveryToken(token),
    });
    if (!claim) {
      return privateJson("Preview delivery not found", 404);
    }
    const bytes = await readDeliveryBytes(ctx, claim);
    if (!bytes) {
      if (claim.servingArtifact) {
        await ctx.runMutation(recoverMissingArtifactRef, {
          expectedArtifactStorageId: claim.storageId,
          sourceId: claim.sourceId,
          sourceType: claim.sourceType,
        });
      }
      await ctx.runMutation(cancelDeliveryRef, { deliveryId: claim.deliveryId });
      return privateJson("Preview file is no longer available", 404);
    }
    if (claim.previewKind === "image") {
      try {
        assertSafeImagePreview(bytes.buffer, claim.mimeType);
      } catch {
        await ctx.runMutation(cancelDeliveryRef, { deliveryId: claim.deliveryId });
        return privateJson("Preview image is unsafe or corrupt", 422);
      }
    }
    const completed = await ctx.runMutation(completePortalDeliveryRef, {
      deliveryId: claim.deliveryId,
    });
    return completed
      ? deliveryResponse(bytes, claim)
      : privateJson("Preview source changed while it was being read", 409);
  } catch {
    return privateJson("Unable to access preview", 403);
  }
});

export const workerDocumentPreviewSourceDelivery = httpAction(async (ctx, request) => {
  if (!(await workerRequestIsAuthorized(request))) {
    return privateJson("Preview worker delivery not found", 404);
  }
  const token = deliveryTokenFromRequest(request);
  if (!token) {
    return privateJson("Preview worker delivery not found", 404);
  }
  try {
    const claim = await ctx.runMutation(claimWorkerDeliveryRef, {
      tokenHash: await hashDocumentPreviewDeliveryToken(token),
    });
    if (!claim) {
      return privateJson("Preview worker delivery not found", 404);
    }
    const bytes = await readDeliveryBytes(ctx, claim);
    if (!bytes) {
      await ctx.runMutation(cancelDeliveryRef, { deliveryId: claim.deliveryId });
      return privateJson("Preview source is no longer available", 404);
    }
    const completed = await ctx.runMutation(completeWorkerDeliveryRef, {
      deliveryId: claim.deliveryId,
    });
    return completed
      ? deliveryResponse(bytes, claim)
      : privateJson("Preview source changed while it was being read", 409);
  } catch {
    return privateJson("Unable to access preview source", 403);
  }
});
