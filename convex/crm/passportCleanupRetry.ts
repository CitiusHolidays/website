import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getVisibleJob } from "./jobCardVisibility";
import type { PortalAccess } from "./lib/staffAccess";

export type PassportCleanupTarget =
  | { kind: "passport_upload_cleanup"; ticketId: Id<"passportUploadTickets"> }
  | {
      cleanupRecordId: Id<"passportUploadCleanupRecords">;
      kind: "passport_encrypted_cleanup";
    };

export async function visiblePassportCleanupJob(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  ticket: Doc<"passportUploadTickets">
) {
  const traveller = await ctx.db.get("travellers", ticket.targetTravellerId);
  if (!(traveller && traveller.jobCardId === ticket.targetJobCardId)) {
    return null;
  }
  return await getVisibleJob(ctx, access, ticket.targetJobCardId);
}

export async function plaintextPassportResidualPresent(
  ctx: QueryCtx | MutationCtx,
  ticket: Doc<"passportUploadTickets">
) {
  return ticket.claimedStorageId
    ? (await ctx.db.system.get("_storage", ticket.claimedStorageId)) !== null
    : (ticket.recoveryResidualCount ?? 0) > 0;
}

export async function encryptedPassportResidualPresent(
  ctx: QueryCtx | MutationCtx,
  record: Doc<"passportUploadCleanupRecords">
) {
  return record.storageId
    ? (await ctx.db.system.get("_storage", record.storageId)) !== null
    : (record.recoveryResidualCount ?? 0) > 0;
}

export async function loadPassportCleanupRetryTarget(
  ctx: MutationCtx,
  access: PortalAccess,
  cleanup: PassportCleanupTarget
) {
  if (cleanup.kind === "passport_upload_cleanup") {
    const ticket = await ctx.db.get("passportUploadTickets", cleanup.ticketId);
    const job = ticket ? await visiblePassportCleanupJob(ctx, access, ticket) : null;
    return ticket && job
      ? {
          failureCode: ticket.failureCode,
          residualPresent: await plaintextPassportResidualPresent(ctx, ticket),
          status: ticket.status,
          targetId: `passport-upload:${String(ticket._id)}`,
          updatedAt: ticket.updatedAt,
        }
      : null;
  }
  const record = await ctx.db.get("passportUploadCleanupRecords", cleanup.cleanupRecordId);
  const ticket = record ? await ctx.db.get("passportUploadTickets", record.ticketId) : null;
  const job = ticket ? await visiblePassportCleanupJob(ctx, access, ticket) : null;
  return record && ticket && job
    ? {
        failureCode: record.failureCode,
        residualPresent: await encryptedPassportResidualPresent(ctx, record),
        status: record.status,
        targetId: `passport-encrypted:${String(record._id)}`,
        updatedAt: record.updatedAt,
      }
    : null;
}

export async function queuePlaintextCleanupRetry(
  ctx: MutationCtx,
  ticketId: Id<"passportUploadTickets">
) {
  const ticket = await ctx.db.get("passportUploadTickets", ticketId);
  if (ticket?.status !== "cleanup_degraded") {
    return { queued: false };
  }
  const now = Date.now();
  if (!(ticket.claimedStorageId && ticket.cleanupOwner)) {
    if ((ticket.recoveryResidualCount ?? 0) < 1) {
      return { queued: false };
    }
    await ctx.db.patch("passportUploadTickets", ticket._id, {
      cleanupAfter: undefined,
      cleanupCompletedAt: undefined,
      cleanupDegradedAt: undefined,
      failureCode: undefined,
      recoveryCandidateStorageId: undefined,
      recoveryCompletedAt: undefined,
      recoveryCursor: undefined,
      recoveryMatchCount: 0,
      recoveryResidualCount: 0,
      status: "issued",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.recoverUnclaimedUpload, {
      ticketId: ticket._id,
    });
    return { queued: true };
  }
  await ctx.db.patch("passportUploadTickets", ticket._id, {
    cleanupAfter: now,
    cleanupDegradedAt: undefined,
    status: "cleanup_pending",
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanup, {
    cleanupOwner: ticket.cleanupOwner,
    ticketId: ticket._id,
  });
  return { queued: true };
}

export async function queueEncryptedCleanupRetry(
  ctx: MutationCtx,
  cleanupRecordId: Id<"passportUploadCleanupRecords">
) {
  const record = await ctx.db.get("passportUploadCleanupRecords", cleanupRecordId);
  if (record?.status !== "degraded") {
    return { queued: false };
  }
  const now = Date.now();
  if (!record.storageId) {
    if (
      record.expectedContentDigest === undefined ||
      record.expectedFileSize === undefined ||
      record.recoveryResidualCount === undefined ||
      record.recoveryResidualCount < 1 ||
      record.recoveryWindowEndsAt === undefined
    ) {
      return { queued: false };
    }
    await ctx.db.patch("passportUploadCleanupRecords", record._id, {
      cleanupAfter: record.recoveryWindowEndsAt,
      completedAt: undefined,
      degradedAt: undefined,
      failureCode: undefined,
      recoveryCandidateStorageId: undefined,
      recoveryCompletedAt: undefined,
      recoveryCursor: undefined,
      recoveryMatchCount: 0,
      recoveryResidualCount: 0,
      status: "reserved",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      Math.max(record.recoveryWindowEndsAt - now, 0),
      internal.crm.passportUploadTickets.recoverEncryptedCleanup,
      { cleanupRecordId: record._id }
    );
    return { queued: true };
  }
  await ctx.db.patch("passportUploadCleanupRecords", record._id, {
    cleanupAfter: now,
    degradedAt: undefined,
    status: "pending",
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.crm.passportUploadTickets.cleanupEncrypted, {
    cleanupRecordId: record._id,
  });
  return { queued: true };
}
