import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

const NOW = new Date("2026-08-30T12:00:00.000Z");
const ISSUER = "https://auth.citius.test";

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
  test("binds actor, Traveller, purpose, expiry, and one claim", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId, siblingTravellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const actorB = t.withIdentity(identity("upload_actor_b"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      tokenDigest: "ticket-a",
      travellerId: String(travellerId),
    });
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["plain-a"])));

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
    const otherStorageId = await t.run(
      async (ctx) => await ctx.storage.store(new Blob(["plain-b"]))
    );
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
      tokenDigest: "ticket-expiring",
      travellerId: String(travellerId),
    });
    const referencedStorageId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["already-owned"]));
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
    ).rejects.toThrow("already owned");
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
          tokenDigest,
          travellerId: String(travellerId),
        })
      )
    );
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["race"])));
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
      tokenDigest: "promotion-ticket",
      travellerId: String(travellerId),
    });
    const [plaintextStorageId, encryptedStorageId] = await t.run(
      async (ctx) =>
        await Promise.all([
          ctx.storage.store(new Blob(["plaintext"])),
          ctx.storage.store(new Blob(["encrypted"])),
        ])
    );
    await actorA.mutation(internal.crm.passportUploadTickets.claim, {
      cleanupOwner: "promotion-owner",
      purpose: "passport_scan",
      storageId: plaintextStorageId,
      tokenDigest: "promotion-ticket",
      travellerId: String(travellerId),
    });

    await actorA.mutation(internal.crm.passportUploadTickets.promote, {
      cleanupOwner: "promotion-owner",
      contentDigest: "validated-content-digest",
      createdBy: "upload_actor_a",
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
      tokenDigest: "cleanup-ticket",
      travellerId: String(travellerId),
    });
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["cleanup"])));
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
    ).resolves.toEqual({ deleted: true, terminal: true });
    await expect(
      t.mutation(internal.crm.passportUploadTickets.cleanup, {
        cleanupOwner: "cleanup-owner",
        ticketId: ticket.ticketId,
      })
    ).resolves.toEqual({ deleted: false, terminal: true });
    await t.run(async (ctx) => {
      expect(await ctx.storage.get(storageId)).toBeNull();
      expect(await ctx.db.get("passportUploadTickets", ticket.ticketId)).toMatchObject({
        cleanupCompletedAt: NOW.getTime(),
        status: "rejected",
      });
    });
  });

  test("keeps a late-referenced quarantine blob retry-owned instead of deleting it", async () => {
    const t = harness();
    const { travellerIds } = await seed(t);
    const [travellerId] = travellerIds;
    const actorA = t.withIdentity(identity("upload_actor_a"));
    const ticket = await actorA.mutation(internal.crm.passportUploadTickets.create, {
      tokenDigest: "late-reference-ticket",
      travellerId: String(travellerId),
    });
    const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["quarantine"])));
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
    ).resolves.toEqual({ deleted: false, terminal: false });
    await t.run(async (ctx) => {
      expect(await ctx.storage.get(storageId)).not.toBeNull();
      expect(await ctx.db.get("passportUploadTickets", ticket.ticketId)).toMatchObject({
        cleanupAfter: NOW.getTime() + 1000,
        cleanupAttempts: 1,
        failureCode: "storage_referenced",
        status: "cleanup_pending",
      });
    });
  });
});
