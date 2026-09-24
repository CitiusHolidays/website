import { DAY, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { boothApi } from "../src/lib/eventPhotoBooth/api";
import { type BoothSceneDraft, DEFAULT_BOOTH_SCENES } from "../src/lib/eventPhotoBooth/contracts";
import type { Id } from "./_generated/dataModel";
import { rateLimiterComponent } from "./lib/rateLimiterComponent";
import schema from "./schema";
import { modules } from "./test.setup";

const SECRET = "test-event-booth-secret";
const identity = (role: string) => ({
  email: `${role}@example.test`,
  issuer: "https://test.citius",
  subject: role,
  tokenIdentifier: `https://test.citius|${role}`,
});
async function harness() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  rateLimiterTest.register(t, "rateLimiter");
  const ids = await t.run(async (ctx) => {
    const result: Record<string, Id<"staffUsers">> = {};
    for (const role of ["Admin", "Directors", "Sales", "Operations", "Director Cement"] as const) {
      result[role] = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: identity(role).tokenIdentifier,
        createdAt: Date.now(),
        email: `${role}@example.test`,
        emailNormalized: `${role}@example.test`,
        name: role,
        roles: [role],
        updatedAt: Date.now(),
      });
    }
    result.inactive = await ctx.db.insert("staffUsers", {
      active: false,
      authUserId: identity("inactive").tokenIdentifier,
      createdAt: Date.now(),
      email: "inactive@example.test",
      emailNormalized: "inactive@example.test",
      name: "Inactive",
      roles: ["Admin"],
      updatedAt: Date.now(),
    });
    return result;
  });
  return {
    admin: t.withIdentity(identity("Admin")),
    director: t.withIdentity(identity("Directors")),
    ids,
    operator: t.withIdentity(identity("Operations")),
    t,
  };
}
const scenes = (): BoothSceneDraft[] => structuredClone(DEFAULT_BOOTH_SCENES);
const metricArgs = () => ({
  events: [{ count: 1, event: "visit" as const }],
  gatewaySecret: SECRET,
  rateLimitKeyHash: "a".repeat(64),
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-24T01:00:00Z"));
  process.env.EVENT_PHOTO_BOOTH_GATEWAY_SECRET = SECRET;
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.EVENT_PHOTO_BOOTH_GATEWAY_SECRET;
});

describe("event photo booth boundaries", () => {
  test("only provisioned active exact Admin/Directors bypass Closed; anonymous reads do not initialize", async () => {
    const { t, admin, director } = await harness();
    expect(await t.query(boothApi.getParticipantState, {})).toMatchObject({
      availability: "closed",
      canParticipate: false,
      privilegedAccess: false,
      scenes: [],
    });
    for (const client of [admin, director]) {
      expect(await client.query(boothApi.getParticipantState, {})).toMatchObject({
        canParticipate: true,
        privilegedAccess: true,
      });
      expect(await client.query(boothApi.getMyAccess, {})).toEqual({
        canManage: true,
        canManageAssignments: true,
        canParticipateWhenClosed: true,
      });
    }
    for (const role of ["Sales", "Director Cement", "inactive", "customer"]) {
      const client = t.withIdentity({ ...identity(role), email: "Admin@example.test" });
      expect(await client.query(boothApi.getParticipantState, {})).toMatchObject({
        canParticipate: false,
        scenes: [],
      });
      await expect(client.query(boothApi.getManagementState, {})).rejects.toThrow("FORBIDDEN");
      await expect(
        client.mutation(boothApi.setAvailability, { availability: "open" })
      ).rejects.toThrow("FORBIDDEN");
    }
    expect(await t.run((ctx) => ctx.db.query("eventPhotoBoothConfig").collect())).toEqual([]);
  });
  test("operators can manage Closed but cannot delegate or bypass; revocation is live", async () => {
    const { t, ids, admin, director, operator } = await harness();
    await director.mutation(boothApi.setStaffAssignment, {
      assigned: true,
      staffId: ids.Operations,
    });
    expect(await operator.query(boothApi.getMyAccess, {})).toEqual({
      canManage: true,
      canManageAssignments: false,
      canParticipateWhenClosed: false,
    });
    await operator.query(boothApi.getManagementState, {});
    expect(await operator.query(boothApi.getParticipantState, {})).toMatchObject({
      canParticipate: false,
    });
    await expect(
      operator.mutation(boothApi.setStaffAssignment, { assigned: true, staffId: ids.Sales })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      operator.query(boothApi.listAssignableStaff, {
        paginationOpts: { cursor: null, numItems: 25 },
      })
    ).rejects.toThrow("FORBIDDEN");
    await operator.mutation(boothApi.setAvailability, { availability: "open" });
    expect(await t.query(boothApi.getParticipantState, {})).toMatchObject({
      canParticipate: true,
      privilegedAccess: false,
    });
    await admin.mutation(boothApi.setStaffAssignment, { assigned: false, staffId: ids.Operations });
    await expect(operator.query(boothApi.getManagementState, {})).rejects.toThrow("FORBIDDEN");
    await expect(
      admin.mutation(boothApi.setStaffAssignment, { assigned: true, staffId: ids.inactive })
    ).rejects.toThrow("INVALID_STAFF");
  });
  test("publishes atomically, preserves order, hides scenes and rejects stale edits", async () => {
    const { t, admin } = await harness();
    await admin.mutation(boothApi.setAvailability, { availability: "open" });
    const draft = scenes().reverse();
    draft[0].title.en = "New Kedarnath";
    draft[1].visible = false;
    expect(
      await admin.mutation(boothApi.saveDraftScenes, { expectedRevision: 0, scenes: draft })
    ).toBe(1);
    expect((await t.query(boothApi.getParticipantState, {})).scenes[0].id).toBe("paris");
    await expect(
      admin.mutation(boothApi.saveDraftScenes, { expectedRevision: 0, scenes: draft })
    ).rejects.toThrow("REVISION_CONFLICT");
    await admin.mutation(boothApi.publishScenes, { expectedRevision: 1 });
    const published = await t.query(boothApi.getParticipantState, {});
    expect(published.scenes.map((s) => s.id)).toEqual([
      "kedarnath",
      "kashi",
      "dubai",
      "bali",
      "paris",
    ]);
    expect(published.scenes[0].title.en).toBe("New Kedarnath");
    const hidden = scenes().map((s) => ({ ...s, visible: false }));
    await admin.mutation(boothApi.saveDraftScenes, { expectedRevision: 2, scenes: hidden });
    await expect(admin.mutation(boothApi.publishScenes, { expectedRevision: 3 })).rejects.toThrow(
      "NO_VISIBLE_SCENES"
    );
    await admin.mutation(boothApi.setAvailability, { availability: "closed" });
    await admin.mutation(boothApi.publishScenes, { expectedRevision: 3 });
    await expect(
      admin.mutation(boothApi.setAvailability, { availability: "open" })
    ).rejects.toThrow("NO_VISIBLE_SCENES");
  });
  test("bounds scenes and never turns a private storage id into artwork", async () => {
    const { t, admin } = await harness();
    for (const invalid of [
      [],
      Array.from({ length: 25 }, (_, index) => ({ ...scenes()[0], id: `scene-${index}` })),
      [scenes()[0], scenes()[0]],
      [{ ...scenes()[0], title: { en: " ", hi: "ठीक" } }],
      [{ ...scenes()[0], id: "https://private" }],
    ]) {
      await expect(
        admin.mutation(boothApi.saveDraftScenes, { expectedRevision: 0, scenes: invalid })
      ).rejects.toThrow();
    }
    const privateId = await t.run((ctx) => ctx.storage.store(new Blob(["private CRM document"])));
    const forged = makeFunctionReference<
      "mutation",
      { expectedRevision: number; scenes: unknown[] },
      number
    >("eventPhotoBooth:saveDraftScenes");
    await expect(
      admin.mutation(forged, {
        expectedRevision: 0,
        scenes: [{ ...scenes()[0], artwork: { id: privateId, kind: "upload" } }],
      })
    ).rejects.toThrow();
    expect(await t.run(async (ctx) => Boolean(await ctx.storage.get(privateId)))).toBe(true);
  });
  test("validates, re-encodes and owns staff artwork; rejects unauthenticated and malformed uploads", async () => {
    const { t, admin } = await harness();
    await expect(t.action(boothApi.uploadArtwork, { bytes: new ArrayBuffer(2) })).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(
      admin.action(boothApi.uploadArtwork, {
        bytes: new TextEncoder().encode("<svg></svg>").buffer,
      })
    ).rejects.toThrow("INVALID_ARTWORK");
    await expect(
      admin.action(boothApi.uploadArtwork, { bytes: new ArrayBuffer(900_001) })
    ).rejects.toThrow("ARTWORK_TOO_LARGE");
    const input = await sharp({ create: { background: "red", channels: 3, height: 20, width: 20 } })
      .png()
      .toBuffer();
    const uploaded = await admin.action(boothApi.uploadArtwork, {
      bytes: Uint8Array.from(input).buffer,
    });
    expect(uploaded.artwork.kind).toBe("upload");
    const draft = scenes();
    draft[0].artwork = uploaded.artwork;
    await admin.mutation(boothApi.saveDraftScenes, { expectedRevision: 0, scenes: draft });
    const state = await admin.query(boothApi.getManagementState, {});
    expect(state.draftScenes[0].artworkUrl).toBe(uploaded.artworkUrl);
    expect(state.publishedScenes[0].artwork.kind).toBe("bundled");
    vi.advanceTimersByTime(DAY + 1);
    await t.finishInProgressScheduledFunctions();
    expect(await t.run((ctx) => ctx.db.query("eventPhotoBoothArtwork").collect())).toHaveLength(1);
    await admin.mutation(boothApi.publishScenes, { expectedRevision: 1 });
    await admin.mutation(boothApi.saveDraftScenes, { expectedRevision: 2, scenes: scenes() });
    vi.advanceTimersByTime(DAY + 1);
    await t.finishInProgressScheduledFunctions();
    // The old published snapshot still owns its artwork until the new snapshot commits.
    expect(await t.run((ctx) => ctx.db.query("eventPhotoBoothArtwork").collect())).toHaveLength(1);
    await admin.mutation(boothApi.publishScenes, { expectedRevision: 3 });
    vi.advanceTimersByTime(DAY + 1);
    await t.finishInProgressScheduledFunctions();
    expect(await t.run((ctx) => ctx.db.query("eventPhotoBoothArtwork").collect())).toEqual([]);
  });
  test("accepts aggregate batches only, protects gateway and Closed actions, and keeps config stable", async () => {
    const { t, admin, operator, ids } = await harness();
    await expect(
      t.mutation(boothApi.recordMetricGateway, { ...metricArgs(), gatewaySecret: "wrong" })
    ).rejects.toThrow("FORBIDDEN");
    await t.mutation(boothApi.recordMetricGateway, metricArgs());
    const creation = {
      ...metricArgs(),
      events: [{ count: 2, event: "creation_completed" as const, sceneId: "paris" }],
    };
    await expect(t.mutation(boothApi.recordMetricGateway, creation)).rejects.toThrow(
      "EVENT_CLOSED"
    );
    await admin.mutation(boothApi.setStaffAssignment, { assigned: true, staffId: ids.Operations });
    await expect(operator.mutation(boothApi.recordMetricGateway, creation)).rejects.toThrow(
      "EVENT_CLOSED"
    );
    await admin.mutation(boothApi.recordMetricGateway, creation);
    await expect(
      admin.mutation(boothApi.recordMetricGateway, {
        ...creation,
        events: [{ count: 1, event: "creation_completed", sceneId: "not-published" }],
      })
    ).rejects.toThrow("INVALID_SCENE_ID");
    for (const count of [0, 11, 1.5]) {
      await expect(
        t.mutation(boothApi.recordMetricGateway, {
          ...metricArgs(),
          events: [{ count, event: "visit" }],
        })
      ).rejects.toThrow("INVALID_METRICS");
    }
    const forged = makeFunctionReference<
      "mutation",
      { gatewaySecret: string; rateLimitKeyHash: string; events: unknown[] },
      null
    >("eventPhotoBooth:recordMetricGateway");
    await expect(
      t.mutation(forged, {
        ...metricArgs(),
        events: [{ count: 1, event: "visit", photo: "private" }],
      })
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("eventPhotoBoothConfig").collect())).toEqual([]);
    const rows = await t.run((ctx) => ctx.db.query("eventPhotoBoothMetrics").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].counts).toMatchObject({ creation_completed: 2, visit: 1 });
    expect(Object.keys(rows[0]).sort()).toEqual(["_creationTime", "_id", "counts", "key"]);
  });
  test("durably rate limits and removes transient abuse keys", async () => {
    const { t } = await harness();
    await t.mutation(boothApi.recordMetricGateway, metricArgs());
    const limiter = new RateLimiter(rateLimiterComponent, {
      photoBoothMetrics: { kind: "fixed window", period: 15 * MINUTE, rate: 1200 },
    });
    await t.run((ctx) =>
      limiter.limit(ctx, "photoBoothMetrics", {
        count: 1199,
        key: metricArgs().rateLimitKeyHash,
        throws: true,
      })
    );
    await expect(t.mutation(boothApi.recordMetricGateway, metricArgs())).rejects.toThrow();
    vi.advanceTimersByTime(DAY + 1);
    await t.finishInProgressScheduledFunctions();
    expect(await t.run((ctx) => ctx.db.query("eventPhotoBoothRateKeys").collect())).toEqual([]);
    await t.mutation(boothApi.recordMetricGateway, metricArgs());
  });
});
