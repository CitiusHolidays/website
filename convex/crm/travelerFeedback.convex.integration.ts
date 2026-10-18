import type { Infer } from "convex/values";
import { convexTest } from "convex-test";
import sharp from "sharp";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  TRAVELER_JSON_MAX_BYTES,
  type travelerFeedbackFormValidator,
} from "../lib/travelerFeedbackValidators";
import schema from "../schema";
import { modules } from "../test.setup";
import { handleTravelerPhoto } from "./travelerFeedbackHttp";
import { feedbackTokenHash } from "./travelerFeedbackSecurity";

const NOW = Date.parse("2026-10-17T12:00:00Z");
const paginationOpts = { cursor: null, numItems: 20 };
const COMMENTS = {
  food: "The food was fresh and varied.",
  hotel: "",
  improvements: "",
  itinerary: "",
  overall: "A well organised trip.",
  whatWentWell: "",
};
const EMPTY_COMMENTS = { ...COMMENTS, food: "", overall: "" };
const RESPONSE_TOKEN = "r".repeat(43);
const OTHER_RESPONSE_TOKEN = "s".repeat(43);
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  )
);

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function setup() {
  const t = harness();
  const { jobCardId, staffIds } = await t.run(async (ctx) => {
    const insertedStaffIds: Record<string, Id<"staffUsers">> = {};
    for (const [actor, role] of [
      ["director", "Directors"],
      ["operator", "Operations"],
      ["unassigned", "Operations"],
      ["hr", "HR"],
    ] as const) {
      insertedStaffIds[actor] = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: `https://traveler-feedback.test|${actor}`,
        createdAt: NOW,
        email: `${actor}@traveler-feedback.test`,
        emailNormalized: `${actor}@traveler-feedback.test`,
        name: `Synthetic ${actor}`,
        roles: [role],
        updatedAt: NOW,
      });
    }
    const insertedJobCardId = await ctx.db.insert("jobCards", {
      clientName: "Private client company",
      confirmedPax: 90,
      createdAt: NOW,
      createdBy: "https://traveler-feedback.test|operator",
      destination: "Jaipur",
      jobCode: "JC/PRIVATE/26",
      operationsOwnerId: insertedStaffIds.operator,
      sellingPricePerPax: 100_000,
      status: "Closed",
      travelEndDate: "2026-10-04",
      travelStartDate: "2026-10-01",
      updatedAt: NOW,
    });
    return { jobCardId: insertedJobCardId, staffIds: insertedStaffIds };
  });
  const actor = (subject: string) =>
    t.withIdentity({
      issuer: "https://traveler-feedback.test",
      subject,
      tokenIdentifier: `https://traveler-feedback.test|${subject}`,
    });
  const issue = () =>
    actor("operator").action(api.crm.travelerFeedbackActions.createRequest, {
      jobCardId,
      publicTripLabel: "Your Jaipur journey",
    });
  return { actor, issue, jobCardId, staffIds, t };
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function submit(token: string, responseToken = RESPONSE_TOKEN, content = COMMENTS) {
  return {
    body: JSON.stringify({
      comments: content,
      respondentEmail: " ASHA@example.test ",
      respondentName: "Asha",
      responseToken,
    }),
    headers: { ...headers(token), "Content-Type": "application/json" },
    method: "POST",
  };
}

function photo(token: string, responseToken = RESPONSE_TOKEN) {
  return {
    body: PNG,
    headers: {
      ...headers(token),
      "Content-Type": "image/png",
      "X-Feedback-Category": "food",
      "X-Feedback-Response": responseToken,
      "X-File-Name": "synthetic.png",
    },
    method: "POST",
  };
}

async function distinctPhoto(index: number) {
  return new Uint8Array(
    await sharp({
      create: {
        background: { b: 20, g: 40, r: index },
        channels: 3,
        height: 1,
        width: 1,
      },
    })
      .png()
      .toBuffer()
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("scoped traveller feedback", () => {
  test("staff issue scoped expiring links once and cannot enumerate tokens or unrelated JCs", async () => {
    const { actor, issue, jobCardId, t } = await setup();
    const created = await issue();
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const request = await t.run((ctx) => ctx.db.get("travelerFeedbackRequests", created.id));
    expect(request?.tokenHash).toBe(await feedbackTokenHash(created.token));
    expect(request?.expiresAt).toBeGreaterThan(Date.now());
    expect(JSON.stringify(request)).not.toContain(created.token);
    const listed = await actor("operator").query(api.crm.travelerFeedback.listRequests, {
      jobCardId,
      paginationOpts,
    });
    expect(
      await actor("operator").query(api.crm.travelerFeedback.getRequestAccess, { jobCardId })
    ).toEqual({ canManage: true });
    expect(Object.keys(listed.page[0]).sort()).toEqual([
      "createdAt",
      "expiresAt",
      "id",
      "publicTripLabel",
      "responseCount",
      "revokedAt",
    ]);
    for (const subject of ["hr", "unassigned", "customer"]) {
      if (subject !== "customer") {
        expect(
          await actor(subject).query(api.crm.travelerFeedback.getRequestAccess, { jobCardId })
        ).toEqual({ canManage: false });
      }
      await expect(
        actor(subject).action(api.crm.travelerFeedbackActions.createRequest, {
          jobCardId,
          publicTripLabel: "Not authorized",
        })
      ).rejects.toThrow("FORBIDDEN");
      await expect(
        actor(subject).query(api.crm.travelerFeedback.listRequests, { jobCardId, paginationOpts })
      ).rejects.toThrow("FORBIDDEN");
      await expect(
        actor(subject).mutation(api.crm.travelerFeedback.revokeRequest, { requestId: created.id })
      ).rejects.toThrow("FORBIDDEN");
    }
    await expect(
      t.action(api.crm.travelerFeedbackActions.createRequest, {
        jobCardId,
        publicTripLabel: "Not signed in",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      actor("operator").action(api.crm.travelerFeedbackActions.createRequest, {
        expiresInDays: 31,
        jobCardId,
        publicTripLabel: "Invalid expiry",
      })
    ).rejects.toThrow("expiry");
    for (let index = 1; index < 12; index += 1) {
      await issue();
    }
    await expect(issue()).rejects.toThrow("Too many feedback links");
  });

  test("public form exposes only a manual trip label and form metadata; no account or JC access", async () => {
    const { issue, jobCardId, t } = await setup();
    const { token } = await issue();
    const response = await t.fetch("/traveler-feedback/form", {
      headers: headers(token),
      method: "POST",
    });
    expect(response.status).toBe(200);
    // SAFETY: This response comes from the registered endpoint backed by the exact return validator.
    const form = (await response.json()) as Infer<typeof travelerFeedbackFormValidator>;
    expect(form).toMatchObject({ maxPhotoBytes: 4 * 1024 * 1024, maxPhotos: 8 });
    expect(Object.keys(form).sort()).toEqual([
      "categories",
      "expiresAt",
      "maxPhotoBytes",
      "maxPhotos",
      "publicTripLabel",
    ]);
    const text = JSON.stringify(form);
    expect(text).not.toContain(jobCardId);
    expect(text).not.toContain("PRIVATE");
    expect(text).not.toContain("Private client company");
    expect(text).not.toContain("respondent");
    const missing = await t.fetch("/traveler-feedback/form", { method: "POST" });
    expect(missing.ok).toBe(false);
    const wrong = await t.fetch("/traveler-feedback/form", {
      headers: headers("z".repeat(43)),
      method: "POST",
    });
    expect(wrong.status).toBe(410);
    expect((await t.fetch("/traveler-feedback/form")).status).toBe(404);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("customerJourneyEntitlements").collect()).toEqual([]);
      expect(await ctx.db.query("userProfiles").collect()).toEqual([]);
    });
  });

  test("submits idempotently without exposing respondent email or granting promotional consent", async () => {
    const { actor, issue, jobCardId, staffIds, t } = await setup();
    const { id, token } = await issue();
    const first = await t.fetch("/traveler-feedback/submit", submit(token));
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ success: true });
    expect((await t.fetch("/traveler-feedback/submit", submit(token))).status).toBe(201);
    const changed = await t.fetch(
      "/traveler-feedback/submit",
      submit(token, RESPONSE_TOKEN, { ...COMMENTS, overall: "Changed after submitting" })
    );
    expect(changed.status).toBe(410);
    await t.run(async (ctx) => {
      const request = await ctx.db.get("travelerFeedbackRequests", id);
      expect(request?.responseCount).toBe(1);
      const rows = await ctx.db.query("travelerFeedbackResponses").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].respondentEmail).toBe("asha@example.test");
      expect(JSON.stringify(rows)).not.toContain(RESPONSE_TOKEN);
      expect(await ctx.db.query("travellers").collect()).toEqual([]);
      expect(await ctx.db.query("userProfiles").collect()).toEqual([]);
    });
    const shared = await actor("hr").query(api.crm.travelerFeedback.listResponses, {
      paginationOpts,
    });
    expect(shared.page).toHaveLength(1);
    expect(shared.page[0]).toMatchObject({ comments: COMMENTS, respondentName: "Asha" });
    expect(JSON.stringify(shared)).not.toContain("asha@example.test");
    expect(JSON.stringify(shared)).not.toContain("responseTokenHash");
    expect(JSON.stringify(shared)).not.toContain("tokenHash");
    await expect(actor("hr").query(api.crm.jobCards.getDetail, { jobCardId })).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(
      t.query(api.crm.travelerFeedback.listResponses, { paginationOpts })
    ).rejects.toThrow("FORBIDDEN");
    await t.run((ctx) => ctx.db.patch("staffUsers", staffIds.hr, { active: false }));
    await expect(
      actor("hr").query(api.crm.travelerFeedback.listResponses, { paginationOpts })
    ).rejects.toThrow("FORBIDDEN");
  });

  test.each(["overall", "itinerary", "hotel", "food", "whatWentWell", "improvements"])(
    "accepts %s alone without a name, contact details or photos",
    async (category) => {
      const { actor, issue, t } = await setup();
      const { token } = await issue();
      const comments = { ...EMPTY_COMMENTS, [category]: "  The local guide was helpful. \n" };
      const submission = {
        ...submit(token),
        body: JSON.stringify({ comments, responseToken: RESPONSE_TOKEN }),
      };
      expect((await t.fetch("/traveler-feedback/submit", submission)).status).toBe(201);
      const saved = await actor("hr").query(api.crm.travelerFeedback.listResponses, {
        paginationOpts,
      });
      expect(saved.page).toHaveLength(1);
      expect(saved.page[0]).toMatchObject({
        comments: { ...EMPTY_COMMENTS, [category]: "The local guide was helpful." },
        photos: [],
        respondentName: "",
      });
    }
  );

  test.each(["", " \n\t ", "\u00a0\u2003"])(
    "rejects blank or whitespace-only feedback with the same requirement as the form (%j)",
    async (blank) => {
      const { issue, t } = await setup();
      const { token } = await issue();
      const response = await t.fetch(
        "/traveler-feedback/submit",
        submit(token, RESPONSE_TOKEN, { ...EMPTY_COMMENTS, overall: blank })
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Add a comment in at least one section." });
      await t.run(async (ctx) => {
        expect(await ctx.db.query("travelerFeedbackResponses").collect()).toHaveLength(0);
      });
    }
  );

  test("explains the comment length limit without suggesting more questions are required", async () => {
    const { issue, t } = await setup();
    const { token } = await issue();
    const response = await t.fetch(
      "/traveler-feedback/submit",
      submit(token, RESPONSE_TOKEN, { ...EMPTY_COMMENTS, overall: "a".repeat(2001) })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Keep each comment to 2,000 characters or fewer.",
    });
  });

  test("accepts six full multilingual answers within the shared JSON bound and rejects oversized bodies", async () => {
    const { actor, issue, t } = await setup();
    const { token } = await issue();
    const comments = {
      food: "食".repeat(2000),
      hotel: "住".repeat(2000),
      improvements: "旅".repeat(2000),
      itinerary: "न".repeat(2000),
      overall: "य".repeat(2000),
      whatWentWell: "म".repeat(2000),
    };
    const submission = submit(token, RESPONSE_TOKEN, comments);
    const bytes = new TextEncoder().encode(submission.body).byteLength;
    expect(bytes).toBeGreaterThan(32 * 1024);
    expect(bytes).toBeLessThan(TRAVELER_JSON_MAX_BYTES);
    expect((await t.fetch("/traveler-feedback/submit", submission)).status).toBe(201);
    const saved = await actor("hr").query(api.crm.travelerFeedback.listResponses, {
      paginationOpts,
    });
    expect(saved.page[0]?.comments).toEqual(comments);
    const oversized = {
      ...submit(token, OTHER_RESPONSE_TOKEN),
      body: " ".repeat(TRAVELER_JSON_MAX_BYTES + 1),
    };
    expect((await t.fetch("/traveler-feedback/submit", oversized)).status).toBe(413);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("travelerFeedbackResponses").collect()).toHaveLength(1);
    });
  });

  test("revoked, expired and deleted-JC links reject form, submission and photo attachment", async () => {
    const { actor, issue, jobCardId, t } = await setup();
    const revoked = await issue();
    expect((await t.fetch("/traveler-feedback/submit", submit(revoked.token))).status).toBe(201);
    await actor("operator").mutation(api.crm.travelerFeedback.revokeRequest, {
      requestId: revoked.id,
    });
    const expired = await issue();
    await t.run((ctx) =>
      ctx.db.patch("travelerFeedbackRequests", expired.id, { expiresAt: Date.now() - 1 })
    );
    for (const token of [revoked.token, expired.token]) {
      expect(
        (await t.fetch("/traveler-feedback/form", { headers: headers(token), method: "POST" }))
          .status
      ).toBe(410);
      expect((await t.fetch("/traveler-feedback/submit", submit(token))).status).toBe(410);
      expect((await t.fetch("/traveler-feedback/photo", photo(token))).status).toBe(410);
    }
    const deleted = await issue();
    await t.run((ctx) => ctx.db.delete("jobCards", jobCardId));
    expect(
      (
        await t.fetch("/traveler-feedback/form", {
          headers: headers(deleted.token),
          method: "POST",
        })
      ).status
    ).toBe(410);
  });

  test("keeps each response photo scoped to both request and response secrets, strips metadata", async () => {
    const { actor, issue, t } = await setup();
    const first = await issue();
    const second = await issue();
    await t.fetch("/traveler-feedback/submit", submit(first.token));
    await t.fetch("/traveler-feedback/submit", submit(second.token, OTHER_RESPONSE_TOKEN));
    const crossed = await t.fetch(
      "/traveler-feedback/photo",
      photo(first.token, OTHER_RESPONSE_TOKEN)
    );
    expect(crossed.status).toBe(410);
    expect(
      (await t.fetch("/traveler-feedback/photo", photo(first.token, "t".repeat(43)))).status
    ).toBe(410);
    const withMetadata = await sharp(Buffer.from(PNG))
      .withMetadata({ exif: { IFD0: { Copyright: "Synthetic camera metadata" } } })
      .toBuffer();
    const uploaded = await t.fetch("/traveler-feedback/photo", {
      ...photo(first.token),
      body: new Uint8Array(withMetadata),
    });
    expect(uploaded.status).toBe(201);
    expect(await uploaded.json()).toEqual({ photoCount: 1, success: true });
    const photos = await t.run((ctx) => ctx.db.query("travelerFeedbackPhotos").collect());
    expect(photos).toHaveLength(1);
    const file = await actor("hr").action(api.crm.travelerFeedbackActions.getPhotoFile, {
      photoId: photos[0]._id,
    });
    expect((await sharp(Buffer.from(file.bytes)).metadata()).exif).toBeUndefined();
    const thumbnail = await actor("hr").action(api.crm.travelerFeedbackActions.getPhotoThumbnail, {
      photoId: photos[0]._id,
    });
    expect(thumbnail.bytes.byteLength).toBeLessThanOrEqual(256 * 1024);
    expect((await sharp(Buffer.from(thumbnail.bytes)).metadata()).exif).toBeUndefined();
    await expect(
      t.action(api.crm.travelerFeedbackActions.getPhotoFile, { photoId: photos[0]._id })
    ).rejects.toThrow("FORBIDDEN");
    await t.run(async (ctx) => {
      expect((await ctx.db.system.query("_storage").collect()).length).toBe(2);
    });
  });

  test("rejects forged/corrupt/oversized photos, bounds counts, and cleans rejected blobs", async () => {
    const { issue, t } = await setup();
    const { token } = await issue();
    await t.fetch("/traveler-feedback/submit", submit(token));
    for (const input of [
      {
        ...photo(token),
        headers: { ...photo(token).headers, "Content-Type": "image/jpeg" },
      },
      { ...photo(token), body: new TextEncoder().encode("<svg>not a photo</svg>") },
      { ...photo(token), body: PNG.slice(0, 30) },
    ]) {
      expect((await t.fetch("/traveler-feedback/photo", input)).status).toBe(400);
    }
    expect(
      (
        await t.fetch("/traveler-feedback/photo", {
          ...photo(token),
          body: new Uint8Array(4 * 1024 * 1024 + 1),
        })
      ).status
    ).toBe(413);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("travelerFeedbackPhotos").collect()).toEqual([]);
      expect(await ctx.db.system.query("_storage").collect()).toEqual([]);
    });
    for (let index = 0; index < 8; index += 1) {
      expect(
        (
          await t.fetch("/traveler-feedback/photo", {
            ...photo(token),
            body: await distinctPhoto(index),
          })
        ).status
      ).toBe(201);
    }
    expect(
      (
        await t.fetch("/traveler-feedback/photo", {
          ...photo(token),
          body: await distinctPhoto(9),
        })
      ).status
    ).toBe(400);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("travelerFeedbackPhotos").collect()).toHaveLength(8);
      expect(await ctx.db.system.query("_storage").collect()).toHaveLength(16);
    });
  });

  test("replays committed photo uploads at the cap without duplicate rows or blobs, while preserving expiry, revocation and rate limits", async () => {
    const { actor, issue, t } = await setup();
    const { id, token } = await issue();
    await t.fetch("/traveler-feedback/submit", submit(token));
    for (let index = 0; index < 8; index += 1) {
      await t.fetch("/traveler-feedback/photo", {
        ...photo(token),
        body: await distinctPhoto(index),
      });
    }
    const replay = {
      ...photo(token),
      body: await distinctPhoto(0),
      headers: {
        ...photo(token).headers,
        "X-Feedback-Category": "hotel",
        "X-File-Name": "retry-renamed.png",
      },
    };
    const retry = await t.fetch("/traveler-feedback/photo", replay);
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual({ photoCount: 8, success: true });
    await t.run(async (ctx) => {
      const photos = await ctx.db.query("travelerFeedbackPhotos").collect();
      expect(photos).toHaveLength(8);
      expect(photos.every((saved) => /^[a-f0-9]{64}$/.test(saved.contentDigest ?? ""))).toBe(true);
      expect(photos.every((saved) => saved.category === "food")).toBe(true);
      const response = await ctx.db.query("travelerFeedbackResponses").first();
      expect(response?.photoCount).toBe(8);
      expect(await ctx.db.system.query("_storage").collect()).toHaveLength(16);
      await ctx.db.patch("travelerFeedbackRequests", id, {
        photoWindowCount: 120,
        photoWindowStartedAt: Date.now(),
      });
    });
    expect((await t.fetch("/traveler-feedback/photo", replay)).status).toBe(429);
    await t.run((ctx) =>
      ctx.db.patch("travelerFeedbackRequests", id, {
        expiresAt: Date.now() - 1,
        photoWindowCount: 0,
      })
    );
    expect((await t.fetch("/traveler-feedback/photo", replay)).status).toBe(410);
    await t.run((ctx) =>
      ctx.db.patch("travelerFeedbackRequests", id, { expiresAt: Date.now() + 60_000 })
    );
    await actor("operator").mutation(api.crm.travelerFeedback.revokeRequest, { requestId: id });
    expect((await t.fetch("/traveler-feedback/photo", replay)).status).toBe(410);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("travelerFeedbackPhotos").collect()).toHaveLength(8);
      expect(await ctx.db.system.query("_storage").collect()).toHaveLength(16);
    });
  });

  test("rechecks revocation during image processing and cleans dispatch failures", async () => {
    const { actor, issue, t } = await setup();
    const { id, token } = await issue();
    await t.fetch("/traveler-feedback/submit", submit(token));
    const tokenHash = await feedbackTokenHash(token);
    const responseTokenHash = await feedbackTokenHash(RESPONSE_TOKEN);
    await t.mutation(internal.crm.travelerFeedback.authorizePhoto, {
      responseTokenHash,
      tokenHash,
    });
    await actor("operator").mutation(api.crm.travelerFeedback.revokeRequest, { requestId: id });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([PNG])));
    await expect(
      t.action(internal.crm.travelerFeedbackActions.normalizeAndSavePhoto, {
        category: "food",
        fileName: "synthetic.png",
        mimeType: "image/png",
        responseTokenHash,
        storageId,
        tokenHash,
      })
    ).rejects.toThrow();
    await t.run(async (ctx) => {
      expect(await ctx.db.system.query("_storage").collect()).toEqual([]);
    });
    const live = await issue();
    await t.fetch("/traveler-feedback/submit", submit(live.token, OTHER_RESPONSE_TOKEN));
    const status = await t.action(async (ctx) => {
      const response = await handleTravelerPhoto(
        { ...ctx, runAction: () => Promise.reject(new Error("Node unavailable")) },
        new Request("https://feedback.test/traveler-feedback/photo", {
          ...photo(live.token, OTHER_RESPONSE_TOKEN),
        })
      );
      return response.status;
    });
    expect(status).toBe(400);
    await t.run(async (ctx) => {
      expect(await ctx.db.system.query("_storage").collect()).toEqual([]);
    });
  });

  test("server rate and response caps bound public submissions and form reads", async () => {
    const { issue, t } = await setup();
    const { id, token } = await issue();
    await t.run((ctx) =>
      ctx.db.patch("travelerFeedbackRequests", id, {
        formWindowCount: 240,
        formWindowStartedAt: Date.now(),
        submissionWindowCount: 120,
        submissionWindowStartedAt: Date.now(),
      })
    );
    expect(
      (await t.fetch("/traveler-feedback/form", { headers: headers(token), method: "POST" })).status
    ).toBe(429);
    expect((await t.fetch("/traveler-feedback/submit", submit(token))).status).toBe(429);
    await t.run((ctx) =>
      ctx.db.patch("travelerFeedbackRequests", id, {
        formWindowStartedAt: Date.now() - 60_001,
        responseCount: 300,
        submissionWindowStartedAt: Date.now() - 60_001,
      })
    );
    expect((await t.fetch("/traveler-feedback/submit", submit(token))).status).toBe(410);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("travelerFeedbackResponses").collect()).toEqual([]);
    });
  });

  test("JC cascade deletes requests, responses and both private photo variants", async () => {
    vi.useFakeTimers();
    const { actor, issue, jobCardId, t } = await setup();
    const { token } = await issue();
    await t.fetch("/traveler-feedback/submit", submit(token));
    expect((await t.fetch("/traveler-feedback/photo", photo(token))).status).toBe(201);
    await actor("director").mutation(api.crm.jobCards.remove, { jobCardId });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await t.run(async (ctx) => {
      expect(await ctx.db.query("travelerFeedbackRequests").collect()).toEqual([]);
      expect(await ctx.db.query("travelerFeedbackResponses").collect()).toEqual([]);
      expect(await ctx.db.query("travelerFeedbackPhotos").collect()).toEqual([]);
      expect(await ctx.db.system.query("_storage").collect()).toEqual([]);
    });
  });

  test("public responses inherit request-owner E2E cleanup without an external identity", async () => {
    vi.stubEnv("E2E_PROVISIONING_TARGET", "development");
    vi.stubEnv("E2E_SEED_SECRET", "integration-secret");
    vi.stubEnv("E2E_TARGET_ID", "development-integration");
    const { issue, jobCardId, t } = await setup();
    const reusable = await issue();
    const original = await t.run((ctx) => ctx.db.get("travelerFeedbackRequests", reusable.id));
    const runId = "018fbe7a-62c8-7f35-9d2f-2d3f53f9e122";
    await t.mutation(internal.crm.e2eRunOwnership.begin, {
      authUserIds: ["https://traveler-feedback.test|operator"],
      runId,
      targetId: "development-integration",
    });
    const owned = await issue();
    expect((await t.fetch("/traveler-feedback/submit", submit(owned.token))).status).toBe(201);
    expect((await t.fetch("/traveler-feedback/photo", photo(owned.token))).status).toBe(201);
    expect(
      (await t.fetch("/traveler-feedback/submit", submit(reusable.token, OTHER_RESPONSE_TOKEN)))
        .status
    ).toBe(201);
    const photos = await t.run(async (ctx) => {
      const ledger = await ctx.db.query("e2eOwnedRecords").collect();
      expect(ledger.filter((row) => row.tableName === "travelerFeedbackResponses")).toHaveLength(2);
      expect(ledger.filter((row) => row.tableName === "travelerFeedbackRequests")).toHaveLength(1);
      expect(
        ledger.find((row) => row.tableName === "travelerFeedbackPhotos")?.storageIds
      ).toHaveLength(2);
      return await ctx.db.query("travelerFeedbackPhotos").collect();
    });
    expect(
      await t.mutation(internal.crm.e2eRunOwnership.cleanupPage, {
        pageSize: 50,
        runId,
        targetId: "development-integration",
      })
    ).toMatchObject({ complete: true, residualCount: 0 });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("jobCards", jobCardId)).not.toBeNull();
      expect(await ctx.db.get("travelerFeedbackRequests", reusable.id)).toEqual(original);
      expect(await ctx.db.get("travelerFeedbackRequests", owned.id)).toBeNull();
      expect(await ctx.db.query("travelerFeedbackResponses").collect()).toEqual([]);
      expect(await ctx.db.query("travelerFeedbackPhotos").collect()).toEqual([]);
      for (const stored of photos) {
        expect(await ctx.storage.get(stored.storageId)).toBeNull();
        expect(await ctx.storage.get(stored.thumbnailStorageId)).toBeNull();
      }
    });
  });
});
