import { createHash } from "node:crypto";
import { fromAny } from "@total-typescript/shoehorn";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import schema from "../schema";
import { modules } from "../test.setup";
import {
  PASSPORT_UPLOAD_CLAIM_LEASE_MS,
  PASSPORT_UPLOAD_RECOVERY_WINDOW_MS,
} from "./passportUploadTickets";
import {
  encryptedPassportStorageContentType,
  passportUploadStorageContentType,
} from "./storageReferences";

const NOW = new Date("2026-08-30T12:00:00.000Z");
const ISSUER = "https://auth.citius.test";
const QUARANTINE_BYTES = "passport-quarantine-fixture";
const recoveryDescriptor = {
  expectedContentDigest: createHash("sha256").update(QUARANTINE_BYTES).digest("base64"),
  expectedFileSize: Buffer.byteLength(QUARANTINE_BYTES),
  expectedMimeType: "application/pdf",
};

function quarantineBlob() {
  return new Blob([QUARANTINE_BYTES]);
}

interface SystemStorageWriter {
  patch: (table: "_storage", id: Id<"_storage">, value: { contentType: string }) => Promise<void>;
}

function systemStorageWriter(db: MutationCtx["db"]) {
  // SAFETY: convex-test's runtime database includes system-table patching,
  // which its public GenericMutationCtx type intentionally omits.
  return fromAny<SystemStorageWriter, MutationCtx["db"]>(db);
}

async function storeQuarantine(t: ReturnType<typeof harness>, tokenDigest: string) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(quarantineBlob());
    await systemStorageWriter(ctx.db).patch("_storage", storageId, {
      contentType: passportUploadStorageContentType(tokenDigest),
    });
    return storageId;
  });
}

async function storeEncryptedCandidate(
  t: ReturnType<typeof harness>,
  cleanupRecordId: Id<"passportUploadCleanupRecords">,
  bytes: string
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([bytes]));
    await systemStorageWriter(ctx.db).patch("_storage", storageId, {
      contentType: encryptedPassportStorageContentType(String(cleanupRecordId)),
    });
    return storageId;
  });
}

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

function identity(subject: string) {
  return {
    email: `${subject}@citius.test`,
    issuer: ISSUER,
    subject,
    tokenIdentifier: `${ISSUER}|${subject}`,
  };
}

async function seed(t: ReturnType<typeof harness>) {
  return await t.run(async (ctx) => {
    const staffIds: Id<"staffUsers">[] = [];
    for (const subject of ["upload_actor_a", "upload_actor_b"]) {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `${ISSUER}|${subject}`,
        createdAt: NOW.getTime(),
        legacyAuthUserId: subject,
        status: "linked",
        updatedAt: NOW.getTime(),
      });
      staffIds.push(
        await ctx.db.insert("staffUsers", {
          active: true,
          authUserId: subject,
          createdAt: NOW.getTime(),
          email: `${subject}@citius.test`,
          emailNormalized: `${subject}@citius.test`,
          name: subject,
          roles: ["Directors"],
          updatedAt: NOW.getTime(),
        })
      );
    }
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Upload custody fixture",
      confirmedPax: 2,
      createdAt: NOW.getTime(),
      createdBy: "upload_actor_a",
      destination: "Delhi",
      jobCode: "JC-UPLOAD-1",
      status: "Open",
      updatedAt: NOW.getTime(),
    });
    const travellerIds: Id<"travellers">[] = [];
    for (const fullName of ["Traveller One", "Traveller Two"]) {
      travellerIds.push(
        await ctx.db.insert("travellers", {
          callingStatus: "Pending",
          createdAt: NOW.getTime(),
          createdBy: "upload_actor_a",
          foodPreference: "Veg",
          fullName,
          guestType: "Client",
          jobCardId,
          paymentType: "Company Paid",
          roomType: "Single",
          ticketStatus: "Pending Issue",
          updatedAt: NOW.getTime(),
          visaRequired: true,
          visaStatus: "Not Started",
        })
      );
    }
    return { jobCardId, staffIds, travellerIds };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered passport upload ticket boundary", () => {
  test("recovers provider storage after route death before claim or discard", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "route-death-ticket",
      travellerId: String(travellerId),
    });

    // Failure injection: the provider write completed, then the Next process
    // died before it could call claim or discard with the returned storage ID.
    const orphanedStorageId = await storeQuarantine(t, "route-death-ticket");
    vi.advanceTimersByTime(PASSPORT_UPLOAD_RECOVERY_WINDOW_MS);

    await expect(
      t.mutation(internal.crm.passportUploadTickets.recoverUnclaimedUpload, {
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ recovered: true, terminal: false });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanup, {
        cleanupOwner: "route-death-ticket",
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ degraded: false, deleted: true, terminal: true });

    await t.run(async (ctx) => {
      expect(await ctx.storage.get(orphanedStorageId)).toBeNull();
      expect(await ctx.db.get("passportUploadTickets", ticket.ticketId)).toMatchObject({
        claimedStorageId: orphanedStorageId,
        cleanupCompletedAt: NOW.getTime() + PASSPORT_UPLOAD_RECOVERY_WINDOW_MS,
        failureCode: "processing_interrupted",
        recoveryMatchCount: 1,
        status: "rejected",
      });
    });
  });

  test("keeps every ambiguous recovery candidate discoverable without choosing an owner", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "ambiguous-route-death-ticket",
      travellerId: String(travellerId),
    });
    await Promise.all([
      storeQuarantine(t, "ambiguous-route-death-ticket"),
      storeQuarantine(t, "ambiguous-route-death-ticket"),
    ]);
    vi.advanceTimersByTime(PASSPORT_UPLOAD_RECOVERY_WINDOW_MS);

    await expect(
      t.mutation(internal.crm.passportUploadTickets.recoverUnclaimedUpload, {
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ recovered: false, terminal: true });
    await expect(
      t.query(internal.crm.passportUploadTickets.verifyCleanupResiduals, { limit: 10 })
    ).resolves.toMatchObject({
      plaintext: [
        {
          failureCode: "ambiguous_storage",
          ownershipBinding: "recovery_descriptor",
          recoveryMatchCount: 2,
          residualPresent: true,
          ticketId: ticket.ticketId,
        },
      ],
    });
    await expect(
      t.query(internal.crm.passportUploadTickets.verifyRecoveryResidualPage, {
        cursor: null,
        ticketId: ticket.ticketId,
      })
    ).resolves.toMatchObject({
      descriptorActive: true,
      isDone: true,
      matchingCandidates: 2,
      recordedMatchCount: 2,
    });
  });

  test("binds actor, Traveller, purpose, expiry, and one claim", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId, siblingTravellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const actorB = t.withIdentity(identity("upload_actor_b"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "ticket-a",
      travellerId: String(travellerId),
    });
    const storageId = await storeQuarantine(t, "ticket-a");

    await expect(
      actorB.mutation(internal.crm.passportUploadTickets.claim, {
        cleanupOwner: "owner-a",
        purpose: "passport_scan",
        storageId,
        tokenDigest: "ticket-a",
        travellerId: String(travellerId),
      })
    ).rejects.toThrow("invalid or expired");
    await expect(
      actorA.mutation(internal.crm.passportUploadTickets.claim, {
        cleanupOwner: "owner-a",
        purpose: "passport_scan",
        storageId,
        tokenDigest: "ticket-a",
        travellerId: String(siblingTravellerId),
      })
    ).rejects.toThrow("invalid or expired");
    await expect(
      actorA.mutation(internal.crm.passportUploadTickets.claim, {
        cleanupOwner: "owner-a",
        // SAFETY: This intentionally bypasses the static literal to prove the registered validator rejects a hostile purpose.
        purpose: "not-a-purpose" as "passport_scan",
        storageId,
        tokenDigest: "ticket-a",
        travellerId: String(travellerId),
      })
    ).rejects.toThrow();

    await expect(
      actorA.mutation(internal.crm.passportUploadTickets.claim, {
        cleanupOwner: "owner-a",
        purpose: "passport_scan",
        storageId,
        tokenDigest: "ticket-a",
        travellerId: String(travellerId),
      })
    ).resolves.toMatchObject({ mode: "claimed", ticketId: ticket.ticketId });
    const otherStorageId = await storeQuarantine(t, "ticket-a");
    await expect(
      actorA.mutation(internal.crm.passportUploadTickets.claim, {
        cleanupOwner: "owner-a",
        purpose: "passport_scan",
        storageId: otherStorageId,
        tokenDigest: "ticket-a",
        travellerId: String(travellerId),
      })
    ).rejects.toThrow("invalid or expired");
  });

  test("denies exactly at expiry and preserves referenced storage", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const expiring = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "ticket-expiring",
      travellerId: String(travellerId),
    });
    const referencedStorageId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(quarantineBlob());
      await systemStorageWriter(ctx.db).patch("_storage", storageId, {
        contentType: passportUploadStorageContentType("ticket-expiring"),
      });
      await ctx.db.insert("attachments", {
        createdAt: NOW.getTime(),
        createdBy: "fixture",
        entityId: "expense-1",
        entityType: "expense",
        fileName: "proof.pdf",
        storageId: String(storageId),
      });
      await ctx.db.patch("passportUploadTickets", expiring.ticketId, {
        expiresAt: NOW.getTime(),
      });
      return storageId;
    });

    await expect(
      actorA.mutation(internal.crm.passportUploadTickets.claim, {
        cleanupOwner: "expiry-owner",
        purpose: "passport_scan",
        storageId: referencedStorageId,
        tokenDigest: "ticket-expiring",
        travellerId: String(travellerId),
      })
    ).rejects.toThrow("invalid or expired");
    expect(await t.run(async (ctx) => (await ctx.storage.get(referencedStorageId)) !== null)).toBe(
      true
    );

    await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "ticket-referenced",
      travellerId: String(travellerId),
    });
    await expect(
      actorA.mutation(internal.crm.passportUploadTickets.claim, {
        cleanupOwner: "referenced-owner",
        purpose: "passport_scan",
        storageId: referencedStorageId,
        tokenDigest: "ticket-referenced",
        travellerId: String(travellerId),
      })
    ).rejects.toThrow("does not match its recovery record");
    expect(await t.run(async (ctx) => (await ctx.storage.get(referencedStorageId)) !== null)).toBe(
      true
    );
  });

  test("serializes two ticket claims for the same quarantine blob", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    await Promise.all(
      ["race-one", "race-two"].map((tokenDigest) =>
        actorA.mutation(internal.crm.passportUploadTickets.create, {
          ...recoveryDescriptor,
          tokenDigest,
          travellerId: String(travellerId),
        })
      )
    );
    const storageId = await storeQuarantine(t, "race-one");
    const results = await Promise.allSettled(
      ["race-one", "race-two"].map((tokenDigest) =>
        actorA.mutation(internal.crm.passportUploadTickets.claim, {
          cleanupOwner: tokenDigest,
          purpose: "passport_scan",
          storageId,
          tokenDigest,
          travellerId: String(travellerId),
        })
      )
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  test("promotes encrypted storage and ticket state atomically with one replay", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "promotion-ticket",
      travellerId: String(travellerId),
    });
    const plaintextStorageId = await storeQuarantine(t, "promotion-ticket");
    await actorA.mutation(internal.crm.passportUploadTickets.claim, {
      cleanupOwner: "promotion-owner",
      purpose: "passport_scan",
      storageId: plaintextStorageId,
      tokenDigest: "promotion-ticket",
      travellerId: String(travellerId),
    });
    const { cleanupRecordId } = await actorA.mutation(
      internal.crm.passportUploadTickets.reserveEncryptedCleanup,
      {
        cleanupOwner: "promotion-owner",
        expectedContentDigest: createHash("sha256").update("encrypted").digest("base64"),
        expectedFileSize: Buffer.byteLength("encrypted"),
        ticketId: ticket.ticketId,
      }
    );
    const encryptedStorageId = await storeEncryptedCandidate(t, cleanupRecordId, "encrypted");
    await actorA.mutation(internal.crm.passportUploadTickets.bindEncryptedCleanup, {
      cleanupRecordId,
      storageId: encryptedStorageId,
    });

    await actorA.mutation(internal.crm.passportUploadTickets.promote, {
      cleanupOwner: "promotion-owner",
      contentDigest: "validated-content-digest",
      createdBy: "upload_actor_a",
      encryptedCleanupRecordId: cleanupRecordId,
      encryptedPayload: "encrypted-passport-metadata",
      encryptedStorageId,
      fileName: "passport.pdf",
      mimeType: "application/pdf",
      ticketId: ticket.ticketId,
    });

    await t.run(async (ctx) => {
      const passport = await ctx.db
        .query("passportDetails")
        .withIndex("by_travellerId", (query) => query.eq("travellerId", travellerId))
        .unique();
      expect(passport?.storageId).toBe(encryptedStorageId);
      expect(await ctx.db.get("passportUploadTickets", ticket.ticketId)).toMatchObject({
        contentDigest: "validated-content-digest",
        promotedStorageId: encryptedStorageId,
        status: "promoted",
      });
    });
    await expect(
      actorA.mutation(internal.crm.passportUploadTickets.claim, {
        cleanupOwner: "promotion-owner",
        purpose: "passport_scan",
        storageId: plaintextStorageId,
        tokenDigest: "promotion-ticket",
        travellerId: String(travellerId),
      })
    ).resolves.toMatchObject({ mode: "replay", ticketId: ticket.ticketId });
  });

  test("keeps plaintext durably retry-owned and deletes it idempotently", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "cleanup-ticket",
      travellerId: String(travellerId),
    });
    const storageId = await storeQuarantine(t, "cleanup-ticket");
    await actorA.mutation(internal.crm.passportUploadTickets.claim, {
      cleanupOwner: "cleanup-owner",
      purpose: "passport_scan",
      storageId,
      tokenDigest: "cleanup-ticket",
      travellerId: String(travellerId),
    });
    await actorA.mutation(internal.crm.passportUploadTickets.reject, {
      cleanupOwner: "cleanup-owner",
      failureCode: "processing_interrupted",
      ticketId: ticket.ticketId,
    });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanup, {
        cleanupOwner: "cleanup-owner",
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ degraded: false, deleted: true, terminal: true });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanup, {
        cleanupOwner: "cleanup-owner",
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ degraded: false, deleted: false, terminal: true });
    await t.run(async (ctx) => {
      expect(await ctx.storage.get(storageId)).toBeNull();
      expect(await ctx.db.get("passportUploadTickets", ticket.ticketId)).toMatchObject({
        cleanupCompletedAt: NOW.getTime(),
        status: "rejected",
      });
    });
  });

  test("keeps exhausted plaintext cleanup degraded, verifiable, and exactly retryable", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "late-reference-ticket",
      travellerId: String(travellerId),
    });
    const storageId = await storeQuarantine(t, "late-reference-ticket");
    await actorA.mutation(internal.crm.passportUploadTickets.claim, {
      cleanupOwner: "late-reference-owner",
      purpose: "passport_scan",
      storageId,
      tokenDigest: "late-reference-ticket",
      travellerId: String(travellerId),
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("attachments", {
        createdAt: NOW.getTime(),
        createdBy: "hostile-race-fixture",
        entityId: "expense-race",
        entityType: "expense",
        fileName: "reused.pdf",
        storageId: String(storageId),
      });
    });
    await actorA.mutation(internal.crm.passportUploadTickets.reject, {
      cleanupOwner: "late-reference-owner",
      failureCode: "processing_interrupted",
      ticketId: ticket.ticketId,
    });

    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanup, {
        cleanupOwner: "late-reference-owner",
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ degraded: false, deleted: false, terminal: false });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanup, {
        cleanupOwner: "late-reference-owner",
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ degraded: false, deleted: false, terminal: false });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanup, {
        cleanupOwner: "late-reference-owner",
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ degraded: true, deleted: false, terminal: true });
    await t.run(async (ctx) => {
      expect(await ctx.storage.get(storageId)).not.toBeNull();
      expect(await ctx.db.get("passportUploadTickets", ticket.ticketId)).toMatchObject({
        cleanupAttempts: 3,
        cleanupDegradedAt: NOW.getTime(),
        failureCode: "storage_referenced",
        status: "cleanup_degraded",
      });
    });
    await expect(
      t.query(internal.crm.passportUploadTickets.verifyCleanupResiduals, { limit: 10 })
    ).resolves.toMatchObject({
      plaintext: [
        {
          attempts: 3,
          failureCode: "storage_referenced",
          ownershipBinding: "storage_id",
          residualPresent: true,
          ticketId: ticket.ticketId,
        },
      ],
    });

    await t.run(async (ctx) => {
      const attachment = await ctx.db
        .query("attachments")
        .withIndex("by_storageId", (query) => query.eq("storageId", String(storageId)))
        .unique();
      if (attachment) {
        await ctx.db.delete("attachments", attachment._id);
      }
    });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.retryPlaintextCleanup, {
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ queued: true });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanup, {
        cleanupOwner: "late-reference-owner",
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ degraded: false, deleted: true, terminal: true });
  });

  test("keeps exhausted encrypted cleanup degraded, verifiable, and exactly retryable", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "encrypted-residual-ticket",
      travellerId: String(travellerId),
    });
    const plaintextStorageId = await storeQuarantine(t, "encrypted-residual-ticket");
    await actorA.mutation(internal.crm.passportUploadTickets.claim, {
      cleanupOwner: "encrypted-residual-owner",
      purpose: "passport_scan",
      storageId: plaintextStorageId,
      tokenDigest: "encrypted-residual-ticket",
      travellerId: String(travellerId),
    });
    const { cleanupRecordId } = await actorA.mutation(
      internal.crm.passportUploadTickets.reserveEncryptedCleanup,
      {
        cleanupOwner: "encrypted-residual-owner",
        expectedContentDigest: createHash("sha256").update("encrypted-residual").digest("base64"),
        expectedFileSize: Buffer.byteLength("encrypted-residual"),
        ticketId: ticket.ticketId,
      }
    );
    const encryptedStorageId = await storeEncryptedCandidate(
      t,
      cleanupRecordId,
      "encrypted-residual"
    );
    await actorA.mutation(internal.crm.passportUploadTickets.bindEncryptedCleanup, {
      cleanupRecordId,
      storageId: encryptedStorageId,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("attachments", {
        createdAt: NOW.getTime(),
        createdBy: "hostile-encrypted-reference",
        entityId: "expense-encrypted-residual",
        entityType: "expense",
        fileName: "encrypted-residual.bin",
        storageId: String(encryptedStorageId),
      });
    });
    await actorA.mutation(internal.crm.passportUploadTickets.requestEncryptedCleanup, {
      cleanupRecordId,
    });

    for (const expected of [
      { degraded: false, deleted: false, terminal: false },
      { degraded: false, deleted: false, terminal: false },
      { degraded: true, deleted: false, terminal: true },
    ]) {
      await expect(
        t.mutation(internal.crm.passportUploadTickets.cleanupEncrypted, { cleanupRecordId })
      ).resolves.toEqual(expected);
    }
    await expect(
      t.query(internal.crm.passportUploadTickets.verifyCleanupResiduals, { limit: 10 })
    ).resolves.toMatchObject({
      encrypted: [
        {
          attempts: 3,
          cleanupRecordId,
          failureCode: "storage_referenced",
          kind: "encrypted_candidate",
          residualPresent: true,
          ticketId: ticket.ticketId,
        },
      ],
    });

    await t.run(async (ctx) => {
      const attachment = await ctx.db
        .query("attachments")
        .withIndex("by_storageId", (query) => query.eq("storageId", String(encryptedStorageId)))
        .unique();
      if (attachment) {
        await ctx.db.delete("attachments", attachment._id);
      }
    });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.retryEncryptedCleanup, { cleanupRecordId })
    ).resolves.toEqual({ queued: true });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanupEncrypted, { cleanupRecordId })
    ).resolves.toEqual({ degraded: false, deleted: true, terminal: true });
    expect(await t.run(async (ctx) => (await ctx.storage.get(encryptedStorageId)) === null)).toBe(
      true
    );
  });

  test("cleans a bound encrypted candidate after action death before promotion", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "encrypted-post-bind-death-ticket",
      travellerId: String(travellerId),
    });
    const plaintextStorageId = await storeQuarantine(t, "encrypted-post-bind-death-ticket");
    await actorA.mutation(internal.crm.passportUploadTickets.claim, {
      cleanupOwner: "encrypted-post-bind-death-owner",
      purpose: "passport_scan",
      storageId: plaintextStorageId,
      tokenDigest: "encrypted-post-bind-death-ticket",
      travellerId: String(travellerId),
    });
    const encryptedBytes = "encrypted-post-bind-death";
    const { cleanupRecordId } = await actorA.mutation(
      internal.crm.passportUploadTickets.reserveEncryptedCleanup,
      {
        cleanupOwner: "encrypted-post-bind-death-owner",
        expectedContentDigest: createHash("sha256").update(encryptedBytes).digest("base64"),
        expectedFileSize: Buffer.byteLength(encryptedBytes),
        ticketId: ticket.ticketId,
      }
    );
    const orphanedStorageId = await storeEncryptedCandidate(t, cleanupRecordId, encryptedBytes);
    await actorA.mutation(internal.crm.passportUploadTickets.bindEncryptedCleanup, {
      cleanupRecordId,
      storageId: orphanedStorageId,
    });
    await expect(
      t.mutation(internal.crm.storageReferences.deleteIfUnreferenced, {
        storageId: orphanedStorageId,
      })
    ).resolves.toEqual({ deleted: false });

    // Failure injection: binding committed, then the action died before the
    // promotion transaction could release the encrypted candidate.
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await t.run(async (ctx) => {
      expect(await ctx.storage.get(orphanedStorageId)).toBeNull();
      expect(await ctx.db.get("passportUploadCleanupRecords", cleanupRecordId)).toMatchObject({
        status: "completed",
        storageId: orphanedStorageId,
      });
    });
  });

  test("recovers an encrypted candidate after action death before cleanup binding", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      ...recoveryDescriptor,
      tokenDigest: "encrypted-route-death-ticket",
      travellerId: String(travellerId),
    });
    const plaintextStorageId = await storeQuarantine(t, "encrypted-route-death-ticket");
    await actorA.mutation(internal.crm.passportUploadTickets.claim, {
      cleanupOwner: "encrypted-route-death-owner",
      purpose: "passport_scan",
      storageId: plaintextStorageId,
      tokenDigest: "encrypted-route-death-ticket",
      travellerId: String(travellerId),
    });
    const encryptedBytes = "encrypted-route-death";
    const { cleanupRecordId } = await actorA.mutation(
      internal.crm.passportUploadTickets.reserveEncryptedCleanup,
      {
        cleanupOwner: "encrypted-route-death-owner",
        expectedContentDigest: createHash("sha256").update(encryptedBytes).digest("base64"),
        expectedFileSize: Buffer.byteLength(encryptedBytes),
        ticketId: ticket.ticketId,
      }
    );

    // Failure injection: encrypted storage completed, then the action died
    // before bindEncryptedCleanup could attach the returned storage ID.
    const orphanedStorageId = await storeEncryptedCandidate(t, cleanupRecordId, encryptedBytes);
    vi.advanceTimersByTime(PASSPORT_UPLOAD_CLAIM_LEASE_MS);
    await expect(
      t.mutation(internal.crm.passportUploadTickets.recoverEncryptedCleanup, {
        cleanupRecordId,
      })
    ).resolves.toEqual({ recovered: true, terminal: false });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanupEncrypted, { cleanupRecordId })
    ).resolves.toEqual({ degraded: false, deleted: true, terminal: true });
    await t.run(async (ctx) => {
      expect(await ctx.storage.get(orphanedStorageId)).toBeNull();
      expect(await ctx.db.get("passportUploadCleanupRecords", cleanupRecordId)).toMatchObject({
        completedAt: NOW.getTime() + PASSPORT_UPLOAD_CLAIM_LEASE_MS,
        recoveryMatchCount: 1,
        status: "completed",
        storageId: orphanedStorageId,
      });
    });
  });
});
