"use node";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import {
  decryptBuffer,
  decryptPassportDetails,
  encryptBuffer,
  encryptPassportDetails,
} from "../lib/encryption";
import { logConvexApplicationError } from "../lib/observability";
import { recordCompletedDocumentAccess } from "./documentPreviewAudit";
import { downloadFileResultValidator, fileOperationSuccessValidator } from "./fileReturnContracts";
import { enforcePortalFileDownloadLimit } from "./lib/portalFileDownloadLimit";
import { PERMISSIONS } from "./lib/rolePolicy";
import { passportDocumentResultValidator } from "./operationsReturnContracts";
import { normalizePassportExpiryDate } from "./passportExpiry";
import { type PassportUploadFailureCode, validatePassportUpload } from "./passportUploadValidation";
import {
  encryptedPassportStorageContentType,
  passportUploadStorageContentType,
} from "./storageReferences";

function encryptPassportPayload(buffer: Buffer) {
  try {
    return encryptBuffer(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Encryption failed";
    if (message.includes("ENCRYPTION_KEY")) {
      const configurationError = new ConvexError(
        "Encryption is not configured. Ask an admin to set ENCRYPTION_KEY in the Convex deployment."
      );
      Object.defineProperty(configurationError, "cause", { value: error });
      throw configurationError;
    }
    const encryptionError = new ConvexError(`Failed to encrypt passport scan: ${message}`);
    Object.defineProperty(encryptionError, "cause", { value: error });
    throw encryptionError;
  }
}

const uploadTicketResultValidator = v.object({
  expiresAt: v.number(),
  storageContentType: v.string(),
  uploadToken: v.string(),
  uploadUrl: v.string(),
});

function configuredUploadEdgeSecret() {
  const secret = process.env.PORTAL_FILE_UPLOAD_SECRET?.trim();
  if (!secret) {
    throw new ConvexError("Passport upload is not configured");
  }
  return secret;
}

function assertUploadEdgeSecret(provided: string) {
  const expected = Buffer.from(configuredUploadEdgeSecret());
  const actual = Buffer.from(provided);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ConvexError("FORBIDDEN");
  }
}

function digestUploadToken(token: string) {
  return createHmac("sha256", configuredUploadEdgeSecret())
    .update(`passport-upload-ticket\0${token}`)
    .digest("hex");
}

function validationErrorMessage(code: PassportUploadFailureCode) {
  if (code === "invalid_size") {
    return "Passport scans must be between 1 byte and 15 MB.";
  }
  if (code === "mime_mismatch") {
    return "The stored file type does not match its passport upload.";
  }
  if (code === "active_content" || code === "password_protected") {
    return "Password-protected or active passport documents are not accepted.";
  }
  return "Passport scans must be valid PDF, JPEG, or PNG files.";
}

function encryptPassportDetailsPayload(args: {
  dateOfBirth?: string;
  expiryDate?: string;
  nationality?: string;
  number?: string;
}) {
  if (args.number && args.expiryDate && args.nationality && args.dateOfBirth) {
    return {
      encryptedPayload: encryptPassportDetails({
        dateOfBirth: args.dateOfBirth,
        expiryDate: args.expiryDate,
        nationality: args.nationality,
        number: args.number,
      }),
      lastFour: args.number.trim().slice(-4),
    };
  }
  return {
    encryptedPayload: encryptPassportDetails({
      dateOfBirth: "UNKNOWN",
      expiryDate: "UNKNOWN",
      nationality: "UNKNOWN",
      number: "UNKNOWN",
    }),
    lastFour: "",
  };
}

export const generateUploadUrl = action({
  args: {
    contentDigest: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    serverSecret: v.string(),
    travellerId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    expiresAt: number;
    storageContentType: string;
    uploadToken: string;
    uploadUrl: string;
  }> => {
    assertUploadEdgeSecret(args.serverSecret);
    const uploadToken = randomUUID();
    const tokenDigest = digestUploadToken(uploadToken);
    const ticket: { expiresAt: number; ticketId: Id<"passportUploadTickets"> } =
      await ctx.runMutation(internal.crm.passportUploadTickets.create, {
        expectedContentDigest: args.contentDigest,
        expectedFileSize: args.fileSize,
        expectedMimeType: args.mimeType,
        tokenDigest,
        travellerId: args.travellerId,
      });
    return {
      expiresAt: ticket.expiresAt,
      storageContentType: passportUploadStorageContentType(tokenDigest),
      uploadToken,
      uploadUrl: await ctx.storage.generateUploadUrl(),
    };
  },
  returns: uploadTicketResultValidator,
});

export const encryptAndStorePassport = action({
  args: {
    dateOfBirth: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    nationality: v.optional(v.string()),
    number: v.optional(v.string()),
    serverSecret: v.string(),
    tempStorageId: v.id("_storage"),
    travellerId: v.string(),
    uploadToken: v.string(),
  },
  handler: async (ctx, args) => {
    assertUploadEdgeSecret(args.serverSecret);
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access?.allowed && access.permissions.includes(PERMISSIONS.MANAGE_VISA))) {
      throw new ConvexError("FORBIDDEN");
    }
    const cleanupOwner = digestUploadToken(args.uploadToken);
    const claim = await ctx.runMutation(internal.crm.passportUploadTickets.claim, {
      cleanupOwner,
      purpose: "passport_scan",
      storageId: args.tempStorageId,
      tokenDigest: digestUploadToken(args.uploadToken),
      travellerId: args.travellerId,
    });
    if (claim.mode === "replay") {
      return { success: true };
    }

    let failureCode: PassportUploadFailureCode | "encryption_failed" = "storage_missing";
    let encryptedCleanupRecordId: Id<"passportUploadCleanupRecords"> | null = null;
    let encryptedStorageId: Id<"_storage"> | null = null;
    let promoted = false;
    try {
      const fileBlob = await ctx.storage.get(args.tempStorageId);
      if (!fileBlob) {
        throw new ConvexError("Uploaded passport file not found");
      }
      const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
      const validation = validatePassportUpload(fileBytes, {
        claimedMimeType: claim.mimeType,
        claimedSize: claim.fileSize,
      });
      if (!validation.ok) {
        failureCode = validation.code;
        throw new ConvexError(validationErrorMessage(validation.code));
      }

      failureCode = "encryption_failed";
      const encryptedBuffer = encryptPassportPayload(Buffer.from(fileBytes));
      ({ cleanupRecordId: encryptedCleanupRecordId } = await ctx.runMutation(
        internal.crm.passportUploadTickets.reserveEncryptedCleanup,
        {
          cleanupOwner,
          expectedContentDigest: createHash("sha256").update(encryptedBuffer).digest("base64"),
          expectedFileSize: encryptedBuffer.byteLength,
          ticketId: claim.ticketId,
        }
      ));
      encryptedStorageId = await ctx.storage.store(
        new Blob([new Uint8Array(encryptedBuffer)], {
          type: encryptedPassportStorageContentType(String(encryptedCleanupRecordId)),
        })
      );
      await ctx.runMutation(internal.crm.passportUploadTickets.bindEncryptedCleanup, {
        cleanupRecordId: encryptedCleanupRecordId,
        storageId: encryptedStorageId,
      });
      const { encryptedPayload, lastFour } = encryptPassportDetailsPayload(args);
      await ctx.runMutation(internal.crm.passportUploadTickets.promote, {
        cleanupOwner,
        contentDigest: validation.contentDigest,
        createdBy: access.authUserId || "unknown",
        encryptedCleanupRecordId,
        encryptedPayload,
        encryptedStorageId,
        expiryDate: normalizePassportExpiryDate(args.expiryDate),
        fileName: args.fileName,
        lastFour: lastFour || undefined,
        mimeType: validation.mimeType,
        ticketId: claim.ticketId,
      });
      promoted = true;
    } catch (error) {
      if (encryptedCleanupRecordId) {
        try {
          await ctx.runMutation(internal.crm.passportUploadTickets.requestEncryptedCleanup, {
            cleanupRecordId: encryptedCleanupRecordId,
          });
        } catch {
          logConvexApplicationError("passport_storage_cleanup_failure");
        }
      }
      throw error;
    } finally {
      if (!promoted) {
        await ctx.runMutation(internal.crm.passportUploadTickets.reject, {
          cleanupOwner,
          failureCode,
          ticketId: claim.ticketId,
        });
      }
    }

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});

export const discardPassportUpload = action({
  args: {
    serverSecret: v.string(),
    storageId: v.id("_storage"),
    travellerId: v.string(),
    uploadToken: v.string(),
  },
  handler: async (ctx, args) => {
    assertUploadEdgeSecret(args.serverSecret);
    const cleanupOwner = digestUploadToken(args.uploadToken);
    const claim = await ctx.runMutation(internal.crm.passportUploadTickets.claim, {
      cleanupOwner,
      purpose: "passport_scan",
      storageId: args.storageId,
      tokenDigest: digestUploadToken(args.uploadToken),
      travellerId: args.travellerId,
    });
    if (claim.mode === "claimed") {
      await ctx.runMutation(internal.crm.passportUploadTickets.reject, {
        cleanupOwner,
        failureCode: "processing_interrupted",
        ticketId: claim.ticketId,
      });
    }
    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});

type PassportMetadata = {
  storageId?: Id<"_storage">;
  mimeType?: string;
  fileName?: string;
} | null;

async function readPassportFile(
  ctx: ActionCtx,
  travellerId: string,
  operation: "download" | "preview"
) {
  const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
  if (!(access?.allowed && access.permissions.includes(PERMISSIONS.VIEW_VISA))) {
    throw new ConvexError("FORBIDDEN");
  }
  await enforcePortalFileDownloadLimit(ctx, access);

  const existing: PassportMetadata = await ctx.runQuery(
    internal.crm.passport.getAuthorizedPassportStorageMetadata,
    { travellerId }
  );

  if (!existing?.storageId) {
    throw new ConvexError("Passport document not found for this traveller");
  }

  const encryptedBlob = await ctx.storage.get(existing.storageId);
  if (!encryptedBlob) {
    throw new ConvexError("Encrypted passport file not found in storage");
  }

  const encryptedBytes = new Uint8Array(await encryptedBlob.arrayBuffer());
  const decryptedBuffer = decryptBuffer(Buffer.from(encryptedBytes));

  const decryptedBytes = new Uint8Array(decryptedBuffer);
  const responseBytes = new Uint8Array(decryptedBytes.byteLength);
  responseBytes.set(decryptedBytes);

  await recordCompletedDocumentAccess(ctx, {
    expectedSourceStorageId: existing.storageId,
    operation,
    sourceId: travellerId,
    sourceType: "passport",
  });

  return {
    bytes: responseBytes.buffer,
    fileName: existing.fileName || "passport.pdf",
    mimeType: existing.mimeType || "application/pdf",
  };
}

export const getPassportDocument = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: true; bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const file = await readPassportFile(ctx, args.travellerId, "download");
    return {
      success: true,
      ...file,
    };
  },
  returns: passportDocumentResultValidator,
});

export const getPassportFile = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> =>
    await readPassportFile(ctx, args.travellerId, "download"),
  returns: downloadFileResultValidator,
});

export const removePassport = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access?.allowed && access.permissions.includes(PERMISSIONS.MANAGE_VISA))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.runQuery(internal.crm.passport.getAuthorizedPassportStorageMetadata, {
      travellerId: args.travellerId,
    });

    const deletedStorageId: Id<"_storage"> | null = await ctx.runMutation(
      internal.crm.passport.deletePassportMetadata,
      {
        travellerId: args.travellerId,
      }
    );

    if (deletedStorageId) {
      await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
        storageId: deletedStorageId,
      });
    }

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});

export const backfillPassportExpiryDates = internalAction({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    continueCursor: string;
    isDone: boolean;
    processed: number;
    scanned: number;
    skipped: number;
    updated: number;
  }> => {
    const result: {
      continueCursor: string;
      isDone: boolean;
      page: Array<{ id: Id<"passportDetails">; encryptedPayload: string }>;
      scanned: number;
    } = await ctx.runQuery(internal.crm.passport.listPassportDetailsForBackfill, {
      cursor: args.cursor ?? null,
      limit: args.limit ?? 100,
    });
    const rows = result.page;
    const outcomes = await Promise.all(
      rows.map(async (row) => {
        try {
          const decrypted = decryptPassportDetails(row.encryptedPayload);
          const expiryDate = normalizePassportExpiryDate(decrypted.expiryDate);
          if (!expiryDate) {
            return "skipped" as const;
          }
          await ctx.runMutation(internal.crm.passport.backfillPassportExpiryDate, {
            expiryDate,
            passportId: row.id,
          });
          return "updated" as const;
        } catch {
          return "skipped" as const;
        }
      })
    );
    const updated = outcomes.filter((outcome) => outcome === "updated").length;
    const skipped = outcomes.filter((outcome) => outcome === "skipped").length;

    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      processed: rows.length,
      scanned: result.scanned,
      skipped,
      updated,
    };
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    processed: v.number(),
    scanned: v.number(),
    skipped: v.number(),
    updated: v.number(),
  }),
});
