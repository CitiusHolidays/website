import { convexTest } from "convex-test";
import sharp from "sharp";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { handlePhotoUpload } from "./postTourFeedbackHttp";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const paginationOpts = { cursor: null, numItems: 10 };
// A synthetic 1x1 PNG; no customer or operational images enter the tests.
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  )
);

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function seed(t: ReturnType<typeof harness>) {
  const identities = [
    { id: "tour-manager", name: "Synthetic Tour Manager", role: "Tour Manager" as const },
    { id: "other-tour-manager", name: "Other Tour Manager", role: "Tour Manager" as const },
    { id: "hr", name: "Synthetic HR", role: "HR" as const },
    { id: "director", name: "Synthetic Director", role: "Directors" as const },
  ];
  const staffIds = await t.run(async (ctx) => {
    const ids: Record<string, Id<"staffUsers">> = {};
    for (const identity of identities) {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `https://feedback.test|${identity.id}`,
        createdAt: NOW,
        legacyAuthUserId: identity.id,
        status: "linked",
        updatedAt: NOW,
      });
      ids[identity.id] = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: identity.id,
        createdAt: NOW,
        email: `${identity.id}@feedback.test`,
        emailNormalized: `${identity.id}@feedback.test`,
        name: identity.name,
        roles: [identity.role],
        updatedAt: NOW,
      });
    }
    return ids;
  });
  const jobCardId = await t.run((ctx) =>
    ctx.db.insert("jobCards", {
      clientName: "Synthetic group",
      confirmedPax: 20,
      createdAt: NOW,
      createdBy: "another-owner",
      destination: "Jaipur",
      jobCode: "JC-TEST-26",
      status: "Closed",
      travelEndDate: "2026-10-04",
      travelStartDate: "2026-10-01",
      updatedAt: NOW,
    })
  );
  const assignmentId = await t.run((ctx) =>
    ctx.db.insert("tourManagerAssignments", {
      callingStatus: "Pending",
      createdAt: NOW,
      createdBy: "director",
      jobCardId,
      name: "Synthetic Tour Manager",
      staffId: staffIds["tour-manager"],
      status: "Assigned",
      updatedAt: NOW,
    })
  );
  const actor = (id: string) =>
    t.withIdentity({
      email: `${id}@feedback.test`,
      issuer: "https://feedback.test",
      subject: id,
      tokenIdentifier: `https://feedback.test|${id}`,
    });
  return { actor, assignmentId, jobCardId, staffIds };
}

async function createFeedback(fixture: Awaited<ReturnType<typeof seed>>) {
  return await fixture.actor("tour-manager").mutation(api.crm.postTourFeedback.create, {
    category: "food",
    comment: "Restaurant service was slow; select a quieter venue next time.",
    jobCardId: fixture.jobCardId,
    vendorName: "Synthetic restaurant",
    vendorRating: null,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("post-tour staff feedback", () => {
  test("shares safe feedback with all active staff without widening Job Card access", async () => {
    const t = harness();
    const fixture = await seed(t);
    await createFeedback(fixture);
    const asHr = fixture.actor("hr");
    const result = await asHr.query(api.crm.postTourFeedback.list, { paginationOpts });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({
      authorName: "Synthetic Tour Manager",
      canDelete: false,
      canEdit: false,
      category: "food",
      job: { destination: "Jaipur", jobCode: "JC-TEST-26" },
      photos: [],
      vendorRating: null,
    });
    expect(Object.keys(result.page[0].job).sort()).toEqual([
      "clientName",
      "destination",
      "jobCardId",
      "jobCode",
      "travelEndDate",
      "travelStartDate",
    ]);
    expect(JSON.stringify(result)).not.toContain("authUserId");
    await expect(
      asHr.query(api.crm.jobCards.getDetail, { jobCardId: fixture.jobCardId })
    ).rejects.toThrow("FORBIDDEN");
    await expect(t.query(api.crm.postTourFeedback.list, { paginationOpts })).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(
      fixture.actor("customer").query(api.crm.postTourFeedback.list, { paginationOpts })
    ).rejects.toThrow("FORBIDDEN");
    await t.run((ctx) => ctx.db.patch("staffUsers", fixture.staffIds.hr, { active: false }));
    await expect(asHr.query(api.crm.postTourFeedback.list, { paginationOpts })).rejects.toThrow(
      "FORBIDDEN"
    );
  });

  test("hides untouched Job Card metadata from unrelated staff until feedback is shared", async () => {
    const t = harness();
    const fixture = await seed(t);
    const asHr = fixture.actor("hr");
    expect(
      await asHr.query(api.crm.postTourFeedback.getJobContext, { jobCardId: fixture.jobCardId })
    ).toBeNull();
    expect((await asHr.query(api.crm.postTourFeedback.listJobs, { paginationOpts })).page).toEqual(
      []
    );
    expect(
      await fixture
        .actor("tour-manager")
        .query(api.crm.postTourFeedback.getJobContext, { jobCardId: fixture.jobCardId })
    ).toMatchObject({ canCompose: true });
    expect(
      await fixture
        .actor("director")
        .query(api.crm.postTourFeedback.getJobContext, { jobCardId: fixture.jobCardId })
    ).toMatchObject({ canCompose: false });
    await createFeedback(fixture);
    expect(
      await asHr.query(api.crm.postTourFeedback.getJobContext, { jobCardId: fixture.jobCardId })
    ).toMatchObject({ canCompose: false, jobCode: "JC-TEST-26" });
    expect(
      (await asHr.query(api.crm.postTourFeedback.listJobs, { paginationOpts })).page
    ).toHaveLength(1);
  });

  test("requires assigned tour-manager identity, preserves audit author, and separates N/A from zero", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await createFeedback(fixture);
    await expect(
      fixture.actor("other-tour-manager").mutation(api.crm.postTourFeedback.create, {
        category: "overall",
        comment: "Unassigned",
        jobCardId: fixture.jobCardId,
      })
    ).rejects.toThrow("FORBIDDEN");
    for (const vendorRating of [0, 11, 1.5, Number.NaN]) {
      await expect(
        fixture.actor("tour-manager").mutation(api.crm.postTourFeedback.update, {
          category: "food",
          comment: "Updated",
          feedbackId: id,
          vendorRating,
        })
      ).rejects.toThrow("Choose a rating");
    }
    await fixture.actor("director").mutation(api.crm.postTourFeedback.update, {
      category: "food",
      comment: "Moderated recommendation",
      feedbackId: id,
      vendorRating: 3,
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("postTourFeedback", id)).toMatchObject({
        authorName: "Synthetic Tour Manager",
        authorStaffId: fixture.staffIds["tour-manager"],
        lastEditedByName: "Synthetic Director",
        vendorRating: 3,
      });
    });
    await expect(
      fixture.actor("hr").mutation(api.crm.postTourFeedback.remove, { feedbackId: id })
    ).rejects.toThrow("FORBIDDEN");
    await t.run((ctx) =>
      ctx.db.patch("tourManagerAssignments", fixture.assignmentId, { status: "Inactive" })
    );
    await expect(
      fixture.actor("tour-manager").mutation(api.crm.postTourFeedback.update, {
        category: "food",
        comment: "Old assignment",
        feedbackId: id,
      })
    ).rejects.toThrow("FORBIDDEN");
    await fixture.actor("director").mutation(api.crm.postTourFeedback.remove, { feedbackId: id });
    expect(
      (await fixture.actor("hr").query(api.crm.postTourFeedback.list, { paginationOpts })).page
    ).toEqual([]);
  });

  test("does not let legacy names override an explicit assignment to another staff member", async () => {
    const t = harness();
    const fixture = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("tourManagerAssignments", fixture.assignmentId, {
        staffId: fixture.staffIds["other-tour-manager"],
      });
      await ctx.db.patch("jobCards", fixture.jobCardId, {
        tourManagerName: "Synthetic Tour Manager",
      });
    });
    expect(
      await fixture
        .actor("tour-manager")
        .query(api.crm.postTourFeedback.getJobContext, { jobCardId: fixture.jobCardId })
    ).toMatchObject({ canCompose: false });
    await expect(createFeedback(fixture)).rejects.toThrow("FORBIDDEN");
    // Existing name-only assignments still work when they have no linked identity.
    await t.run((ctx) =>
      ctx.db.patch("tourManagerAssignments", fixture.assignmentId, { staffId: undefined })
    );
    expect(
      await fixture
        .actor("tour-manager")
        .query(api.crm.postTourFeedback.getJobContext, { jobCardId: fixture.jobCardId })
    ).toMatchObject({ canCompose: true });
  });

  test("paginates the shared feed and per-job feed using schema-backed indexes", async () => {
    const t = harness();
    const fixture = await seed(t);
    for (let index = 0; index < 3; index += 1) {
      await createFeedback(fixture);
    }
    const first = await fixture
      .actor("hr")
      .query(api.crm.postTourFeedback.list, { paginationOpts: { cursor: null, numItems: 2 } });
    expect(first.page).toHaveLength(2);
    expect(first.isDone).toBe(false);
    const second = await fixture.actor("hr").query(api.crm.postTourFeedback.list, {
      paginationOpts: { cursor: first.continueCursor, numItems: 2 },
    });
    expect(second.page).toHaveLength(1);
    expect(second.isDone).toBe(true);
    const byJob = await fixture
      .actor("hr")
      .query(api.crm.postTourFeedback.list, { jobCardId: fixture.jobCardId, paginationOpts });
    expect(byJob.page).toHaveLength(3);
    const jobs = await fixture
      .actor("tour-manager")
      .query(api.crm.postTourFeedback.listJobs, { paginationOpts });
    expect(jobs.page[0]).toMatchObject({ canCompose: true, jobCardId: fixture.jobCardId });
  });

  test("treats invalid route Job Card references as an empty staff view", async () => {
    const t = harness();
    const fixture = await seed(t);
    await createFeedback(fixture);
    for (const jobCardId of ["not-a-job-card-id", ""]) {
      expect(
        await fixture.actor("hr").query(api.crm.postTourFeedback.getJobContext, { jobCardId })
      ).toBeNull();
      expect(
        await fixture
          .actor("hr")
          .query(api.crm.postTourFeedback.list, { jobCardId, paginationOpts })
      ).toEqual({
        continueCursor: "",
        isDone: true,
        page: [],
      });
      await expect(t.query(api.crm.postTourFeedback.getJobContext, { jobCardId })).rejects.toThrow(
        "FORBIDDEN"
      );
      await expect(
        t.query(api.crm.postTourFeedback.list, { jobCardId, paginationOpts })
      ).rejects.toThrow("FORBIDDEN");
    }
  });

  test("fully decodes uploaded bytes, strips metadata, and downloads only through staff auth", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await createFeedback(fixture);
    const photoWithMetadata = await sharp(Buffer.from(PNG))
      .withMetadata({ exif: { IFD0: { Copyright: "Synthetic metadata" } } })
      .toBuffer();
    const uploaded = await fixture
      .actor("tour-manager")
      .fetch(`/post-tour-feedback/photo?feedbackId=${id}&fileName=synthetic.png`, {
        body: new Uint8Array(photoWithMetadata),
        headers: { "Content-Type": "image/png" },
        method: "POST",
      });
    expect(uploaded.status).toBe(201);
    // SAFETY: This fixture reads the validated ID returned by the registered upload endpoint after its successful response.
    const { id: photoId } = (await uploaded.json()) as { id: Id<"postTourFeedbackPhotos"> };
    const file = await fixture
      .actor("hr")
      .action(api.crm.postTourFeedbackActions.getPhotoFile, { photoId });
    expect(file.mimeType).toBe("image/png");
    expect(file.fileName).toBe("synthetic.png");
    expect(file.bytes.byteLength).toBeGreaterThan(1);
    expect((await sharp(Buffer.from(file.bytes)).metadata()).exif).toBeUndefined();
    await expect(
      t.action(api.crm.postTourFeedbackActions.getPhotoFile, { photoId })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      fixture
        .actor("other-tour-manager")
        .mutation(api.crm.postTourFeedback.removePhoto, { photoId })
    ).rejects.toThrow("FORBIDDEN");
    const stored = await t.run((ctx) => ctx.db.get("postTourFeedbackPhotos", photoId));
    if (!stored) {
      throw new Error("Expected stored photo");
    }
    expect(stored.uploadedBy).toBe("https://feedback.test|tour-manager");
    expect(
      await t.query(internal.crm.storageReferences.isStorageReferenced, {
        storageId: stored.thumbnailStorageId,
      })
    ).toBe(true);
    expect(
      await t.query(internal.crm.storageReferences.isStorageReferenced, {
        storageId: stored.storageId,
      })
    ).toBe(true);
    await fixture.actor("tour-manager").mutation(api.crm.postTourFeedback.removePhoto, { photoId });
    await t.run(async (ctx) => {
      expect(await ctx.storage.get(stored.storageId)).toBeNull();
      expect(await ctx.storage.get(stored.thumbnailStorageId)).toBeNull();
    });
  });

  test("rejects forged types, corrupt image content, oversized uploads and unassigned upload actors", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await createFeedback(fixture);
    const path = `/post-tour-feedback/photo?feedbackId=${id}&fileName=bad.jpg`;
    for (const input of [
      { body: PNG, headers: { "Content-Type": "image/jpeg" } },
      {
        body: new TextEncoder().encode("<svg>not a photo</svg>"),
        headers: { "Content-Type": "image/png" },
      },
      { body: PNG.slice(0, 30), headers: { "Content-Type": "image/png" } },
    ]) {
      const result = await fixture.actor("tour-manager").fetch(path, { ...input, method: "POST" });
      expect(result.status).toBe(400);
    }
    const oversize = await fixture.actor("tour-manager").fetch(path, {
      body: PNG,
      headers: { "Content-Length": String(4 * 1024 * 1024 + 1), "Content-Type": "image/png" },
      method: "POST",
    });
    expect(oversize.status).toBe(413);
    const streamedOversize = await fixture.actor("tour-manager").fetch(path, {
      body: new Uint8Array(4 * 1024 * 1024 + 1),
      headers: { "Content-Type": "image/png" },
      method: "POST",
    });
    expect(streamedOversize.status).toBe(413);
    const unauthenticated = await t.fetch(path, {
      body: PNG,
      headers: { "Content-Type": "image/png" },
      method: "POST",
    });
    expect(unauthenticated.status).toBe(403);
    const unassigned = await fixture.actor("other-tour-manager").fetch(path, {
      body: PNG,
      headers: { "Content-Type": "image/png" },
      method: "POST",
    });
    expect(unassigned.status).toBe(403);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("postTourFeedbackPhotos").collect()).toEqual([]);
      expect(await ctx.db.system.query("_storage").collect()).toEqual([]);
    });
  });

  test("rechecks assignment at save time and never binds a stale authorized upload", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await createFeedback(fixture);
    await fixture
      .actor("tour-manager")
      .query(internal.crm.postTourFeedback.verifyPhotoUpload, { feedbackId: id });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([PNG])));
    await t.run((ctx) =>
      ctx.db.patch("tourManagerAssignments", fixture.assignmentId, { status: "Inactive" })
    );
    await expect(
      fixture.actor("tour-manager").mutation(internal.crm.postTourFeedback.savePhoto, {
        actorAuthUserId: "https://feedback.test|tour-manager",
        feedbackId: id,
        fileName: "synthetic.png",
        fileSize: PNG.byteLength,
        mimeType: "image/png",
        storageId,
        thumbnailStorageId: storageId,
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      fixture
        .actor("tour-manager")
        .action(internal.crm.postTourFeedbackActions.validateAndSavePhoto, {
          feedbackId: id,
          fileName: "synthetic.png",
          mimeType: "image/png",
          storageId,
        })
    ).rejects.toThrow("FORBIDDEN");
    await t.run(async (ctx) => {
      expect(await ctx.storage.get(storageId)).toBeNull();
    });
  });

  test("bounds each feedback entry to eight photos without retaining rejected uploads", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await createFeedback(fixture);
    for (let index = 0; index < 8; index += 1) {
      const uploaded = await fixture
        .actor("tour-manager")
        .fetch(`/post-tour-feedback/photo?feedbackId=${id}&fileName=synthetic.png`, {
          body: PNG,
          headers: { "Content-Type": "image/png" },
          method: "POST",
        });
      expect(uploaded.status).toBe(201);
    }
    const rejected = await fixture
      .actor("tour-manager")
      .fetch(`/post-tour-feedback/photo?feedbackId=${id}&fileName=synthetic.png`, {
        body: PNG,
        headers: { "Content-Type": "image/png" },
        method: "POST",
      });
    expect(rejected.status).toBe(400);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("postTourFeedbackPhotos").collect()).toHaveLength(8);
      expect(await ctx.db.system.query("_storage").collect()).toHaveLength(16);
    });
  });

  test("Job Card deletion drains feedback rows and private photo blobs", async () => {
    vi.useFakeTimers();
    const t = harness();
    const fixture = await seed(t);
    const { id } = await createFeedback(fixture);
    const photo = await fixture
      .actor("tour-manager")
      .fetch(`/post-tour-feedback/photo?feedbackId=${id}&fileName=synthetic.png`, {
        body: PNG,
        headers: { "Content-Type": "image/png" },
        method: "POST",
      });
    expect(photo.status).toBe(201);
    // SAFETY: This fixture reads the validated ID returned by the registered upload endpoint after its successful response.
    const { id: photoId } = (await photo.json()) as { id: Id<"postTourFeedbackPhotos"> };
    const stored = await t.run((ctx) => ctx.db.get("postTourFeedbackPhotos", photoId));
    if (!stored) {
      throw new Error("Expected stored photo");
    }
    const deleted = await fixture
      .actor("director")
      .mutation(api.crm.jobCards.remove, { jobCardId: fixture.jobCardId });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await t.run(async (ctx) => {
      expect(await ctx.db.get("postTourFeedback", id)).toBeNull();
      expect(await ctx.db.get("postTourFeedbackPhotos", photoId)).toBeNull();
      expect(await ctx.storage.get(stored.storageId)).toBeNull();
      expect(await ctx.storage.get(stored.thumbnailStorageId)).toBeNull();
      expect(await ctx.db.get("jobCardDeletionOperations", deleted.operationId)).toMatchObject({
        stage: "complete",
        status: "complete",
      });
    });
  });

  test("keeps thumbnail reads independent from the manual download budget", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await createFeedback(fixture);
    const uploaded = await fixture
      .actor("tour-manager")
      .fetch(`/post-tour-feedback/photo?feedbackId=${id}`, {
        body: PNG,
        headers: { "Content-Type": "image/png" },
        method: "POST",
      });
    expect(uploaded.status).toBe(201);
    const photo = await t.run((ctx) =>
      ctx.db
        .query("postTourFeedbackPhotos")
        .withIndex("by_feedbackId", (q) => q.eq("feedbackId", id))
        .first()
    );
    if (!photo) {
      throw new Error("Expected uploaded photo");
    }
    for (let index = 0; index < 35; index += 1) {
      const thumbnail = await fixture
        .actor("hr")
        .action(api.crm.postTourFeedbackActions.getPhotoThumbnail, { photoId: photo._id });
      expect(thumbnail.mimeType).toBe("image/jpeg");
      expect(thumbnail.bytes.byteLength).toBeLessThanOrEqual(256 * 1024);
    }
    expect(
      (
        await fixture
          .actor("hr")
          .action(api.crm.postTourFeedbackActions.getPhotoFile, { photoId: photo._id })
      ).mimeType
    ).toBe("image/png");
    await expect(
      t.action(api.crm.postTourFeedbackActions.getPhotoThumbnail, { photoId: photo._id })
    ).rejects.toThrow("FORBIDDEN");
    await t.run(async (ctx) => {
      const media = await ctx.db
        .query("portalFileDownloadRateLimits")
        .withIndex("by_authUserId", (q) =>
          q.eq("authUserId", "post-tour-thumbnail:https://feedback.test|hr")
        )
        .unique();
      expect(media?.count).toBe(35);
      if (!media) {
        throw new Error("Expected media limit");
      }
      await ctx.db.patch("portalFileDownloadRateLimits", media._id, { count: 240 });
    });
    await expect(
      fixture
        .actor("hr")
        .action(api.crm.postTourFeedbackActions.getPhotoThumbnail, { photoId: photo._id })
    ).rejects.toThrow();
    expect(
      (
        await fixture
          .actor("hr")
          .action(api.crm.postTourFeedbackActions.getPhotoFile, { photoId: photo._id })
      ).bytes.byteLength
    ).toBeGreaterThan(0);
  });

  test("HTTP owns raw photo cleanup when Node dispatch rejects before the image handler starts", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await createFeedback(fixture);
    const status = await fixture.actor("tour-manager").action(async (ctx) => {
      const response = await handlePhotoUpload(
        {
          ...ctx,
          runAction: () => Promise.reject(new Error("Node dispatch unavailable")),
        },
        new Request(`https://feedback.test/post-tour-feedback/photo?feedbackId=${id}`, {
          body: PNG,
          headers: { "Content-Type": "image/png" },
          method: "POST",
        })
      );
      return response.status;
    });
    expect(status).toBe(400);
    await t.run(async (ctx) => {
      expect((await ctx.db.system.query("_storage").collect()).length).toBe(0);
    });
  });

  test("E2E cleanup removes owned reports and both photo blobs, restores reusable feedback, and preserves another actor's work", async () => {
    vi.stubEnv("E2E_PROVISIONING_TARGET", "development");
    vi.stubEnv("E2E_SEED_SECRET", "integration-secret");
    vi.stubEnv("E2E_TARGET_ID", "development-integration");
    const t = harness();
    const fixture = await seed(t);
    const { id: reusableId } = await createFeedback(fixture);
    const original = await t.run((ctx) => ctx.db.get("postTourFeedback", reusableId));
    const runId = "018fbe7a-62c8-7f35-9d2f-2d3f53f9e111";
    await t.mutation(internal.crm.e2eRunOwnership.begin, {
      authUserIds: ["https://feedback.test|tour-manager"],
      runId,
      targetId: "development-integration",
    });
    const { id: ownedId } = await createFeedback(fixture);
    await fixture.actor("tour-manager").mutation(api.crm.postTourFeedback.update, {
      category: "food",
      comment: "Temporary E2E edit",
      feedbackId: reusableId,
    });
    for (const feedbackId of [ownedId, reusableId]) {
      const uploaded = await fixture
        .actor("tour-manager")
        .fetch(`/post-tour-feedback/photo?feedbackId=${feedbackId}`, {
          body: PNG,
          headers: { "Content-Type": "image/png" },
          method: "POST",
        });
      expect(uploaded.status).toBe(201);
    }
    await t.run((ctx) =>
      ctx.db.insert("tourManagerAssignments", {
        callingStatus: "Pending",
        createdAt: NOW,
        createdBy: "director",
        jobCardId: fixture.jobCardId,
        name: "Other Tour Manager",
        staffId: fixture.staffIds["other-tour-manager"],
        status: "Assigned",
        updatedAt: NOW,
      })
    );
    const { id: otherId } = await fixture
      .actor("other-tour-manager")
      .mutation(api.crm.postTourFeedback.create, {
        category: "hotel",
        comment: "Another actor's persistent feedback",
        jobCardId: fixture.jobCardId,
      });
    const photos = await t.run(async (ctx) => {
      const ledger = await ctx.db
        .query("e2eOwnedRecords")
        .withIndex("by_runId_createdAt", (q) => q.eq("runId", runId))
        .collect();
      expect(ledger.filter((row) => row.tableName === "postTourFeedback")).toHaveLength(1);
      expect(ledger.filter((row) => row.tableName === "postTourFeedbackPhotos")).toHaveLength(2);
      expect(
        ledger
          .filter((row) => row.tableName === "postTourFeedbackPhotos")
          .every((row) => row.storageIds.length === 2 && row.cleanupOrder === 100)
      ).toBe(true);
      expect(ledger.find((row) => row.tableName === "postTourFeedback")?.cleanupOrder).toBe(90);
      return await ctx.db.query("postTourFeedbackPhotos").collect();
    });
    expect(
      await t.mutation(internal.crm.e2eRunOwnership.cleanupPage, {
        pageSize: 50,
        runId,
        targetId: "development-integration",
      })
    ).toMatchObject({ complete: true, residualCount: 0 });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("postTourFeedback", ownedId)).toBeNull();
      expect(await ctx.db.get("postTourFeedback", otherId)).not.toBeNull();
      expect(await ctx.db.get("postTourFeedback", reusableId)).toEqual(original);
      expect(await ctx.db.get("jobCards", fixture.jobCardId)).not.toBeNull();
      expect(await ctx.db.query("postTourFeedbackPhotos").collect()).toEqual([]);
      expect(await ctx.db.query("e2eOwnedRecords").collect()).toEqual([]);
      expect(await ctx.db.query("e2eMutatedRecords").collect()).toEqual([]);
      for (const photo of photos) {
        expect(await ctx.storage.get(photo.storageId)).toBeNull();
        expect(await ctx.storage.get(photo.thumbnailStorageId)).toBeNull();
      }
    });
  });
});
