import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import type { DeliveryStatus } from "./notificationEmailLedger";

const FIXED_NOW = new Date("2026-08-12T16:00:00.000Z");
const STATUSES: DeliveryStatus[] = [
  "queued",
  "sending",
  "retrying",
  "sent",
  "skipped",
  "exhausted",
];

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function seedNotification(t: ReturnType<typeof createHarness>, suffix: string) {
  return await t.run(async (ctx) =>
    ctx.db.insert("notifications", {
      body: `Fixture ${suffix}`,
      createdAt: FIXED_NOW.getTime(),
      title: `Notification ${suffix}`,
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registered notification email summary projection", () => {
  test("reconciles 1,000 legacy deliveries through bounded pages before declaring exact coverage", async () => {
    const t = createHarness();
    const notificationId = await seedNotification(t, "large-event");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const expected = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
      DeliveryStatus,
      number
    >;

    for (let offset = 0; offset < 1000; offset += 100) {
      // Seed in bounded transactions so the fixture exercises the worker,
      // rather than relying on an unrealistic one-transaction import.
      await t.run(async (ctx) => {
        for (let index = offset; index < offset + 100; index += 1) {
          const status = STATUSES[index % STATUSES.length] ?? "queued";
          expected[status] += 1;
          await ctx.db.insert("notificationEmailDeliveries", {
            attempts: status === "queued" ? 0 : 1,
            createdAt: FIXED_NOW.getTime() + index,
            eventId: String(notificationId),
            idempotencyKey: `fixture/${index}`,
            recipientHash: `recipient-${String(index).padStart(8, "0")}`,
            status,
            updatedAt: FIXED_NOW.getTime() + index,
          });
        }
      });
    }

    const started = await t.mutation(
      internal.crm.notificationEmailLedger.startDeliverySummaryReconciliation,
      {}
    );
    expect(started).toEqual({ generation: 1, scheduled: true });
    expect(
      await t.mutation(internal.crm.notificationEmailLedger.startDeliverySummaryReconciliation, {})
    ).toEqual({ generation: 1, scheduled: false });

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await t.run(async (ctx) => {
      const readiness = await ctx.db
        .query("notificationEmailSummaryReadiness")
        .withIndex("by_key", (q) => q.eq("key", "notificationEmailDeliveries"))
        .unique();
      expect(readiness).toMatchObject({
        generation: 1,
        ready: true,
        residuals: 0,
        scanned: 1000,
        stage: "complete",
        status: "complete",
        version: 1,
      });
      const summary = await ctx.db
        .query("notificationEmailEventSummaries")
        .withIndex("by_eventId", (q) => q.eq("eventId", String(notificationId)))
        .unique();
      expect(summary).toMatchObject({ ...expected, total: 1000 });
      const deliveries = await ctx.db
        .query("notificationEmailDeliveries")
        .withIndex("by_eventId", (q) => q.eq("eventId", String(notificationId)))
        .collect();
      expect(deliveries).toHaveLength(1000);
      expect(
        deliveries.every(
          (row) =>
            row.summaryProjectedEventId === row.eventId && row.summaryProjectedStatus === row.status
        )
      ).toBe(true);
    });

    expect(
      await t.mutation(internal.crm.notificationEmailLedger.startDeliverySummaryReconciliation, {})
    ).toEqual({ generation: 1, scheduled: false });
  });

  test("updates an accepted transition once and rejects an idempotency-key event mismatch", async () => {
    const t = createHarness();
    const firstEventId = String(await seedNotification(t, "first"));
    const secondEventId = String(await seedNotification(t, "second"));
    const base = {
      eventId: firstEventId,
      idempotencyKey: "fixture/stable-recipient",
      recipientHash: "recipient-00000001",
    };

    await t.mutation(internal.crm.notificationEmailLedger.recordDeliveryOutcome, {
      ...base,
      attempts: 0,
      status: "queued",
    });
    await expect(
      t.mutation(internal.crm.notificationEmailLedger.recordDeliveryOutcome, {
        ...base,
        attempts: 1,
        eventId: secondEventId,
        status: "sent",
      })
    ).rejects.toThrow("NOTIFICATION_EMAIL_EVENT_ID_MISMATCH");
    await t.mutation(internal.crm.notificationEmailLedger.recordDeliveryOutcome, {
      ...base,
      attempts: 1,
      status: "sent",
    });
    await t.mutation(internal.crm.notificationEmailLedger.recordDeliveryOutcome, {
      ...base,
      attempts: 0,
      status: "queued",
    });

    await t.run(async (ctx) => {
      const summary = await ctx.db
        .query("notificationEmailEventSummaries")
        .withIndex("by_eventId", (q) => q.eq("eventId", firstEventId))
        .unique();
      expect(summary).toMatchObject({ queued: 0, sent: 1, total: 1 });
      expect(
        await ctx.db
          .query("notificationEmailEventSummaries")
          .withIndex("by_eventId", (q) => q.eq("eventId", secondEventId))
          .unique()
      ).toBeNull();
    });
  });

  test("returns counts only to authorized staff for notification origins they can receive", async () => {
    const t = createHarness();
    const actorIds = await t.run(async (ctx) => {
      const insertStaff = async (
        authUserId: string,
        email: string,
        roles: ["Sales"] | ["Sales Head"]
      ) => {
        await ctx.db.insert("authIdentityLinks", {
          canonicalAuthUserId: `https://auth.citius.test|${authUserId}`,
          createdAt: FIXED_NOW.getTime(),
          legacyAuthUserId: authUserId,
          status: "linked",
          updatedAt: FIXED_NOW.getTime(),
        });
        return await ctx.db.insert("staffUsers", {
          active: true,
          authUserId,
          createdAt: FIXED_NOW.getTime(),
          email,
          emailNormalized: email,
          name: authUserId,
          roles,
          updatedAt: FIXED_NOW.getTime(),
        });
      };
      const headId = await insertStaff("summary_head", "summary-head@citius.test", ["Sales Head"]);
      await insertStaff("summary_sales", "summary-sales@citius.test", ["Sales"]);
      const otherHeadId = await insertStaff("summary_other", "summary-other@citius.test", [
        "Sales Head",
      ]);
      const visibleId = await ctx.db.insert("notifications", {
        body: "Visible origin",
        createdAt: FIXED_NOW.getTime(),
        recipientRole: "Sales Head",
        title: "Visible delivery",
      });
      const hiddenId = await ctx.db.insert("notifications", {
        body: "Hidden origin",
        createdAt: FIXED_NOW.getTime(),
        recipientStaffId: otherHeadId,
        title: "Hidden delivery",
      });
      return { headId, hiddenId, visibleId };
    });
    for (const [index, eventId] of [actorIds.visibleId, actorIds.hiddenId].entries()) {
      await t.mutation(internal.crm.notificationEmailLedger.recordDeliveryOutcome, {
        attempts: 1,
        eventId: String(eventId),
        idempotencyKey: `privacy/${index}`,
        recipientHash: `recipient-privacy-${index}`,
        status: "sent",
      });
    }

    const asHead = t.withIdentity({
      email: "summary-head@citius.test",
      issuer: "https://auth.citius.test",
      subject: "summary_head",
      tokenIdentifier: "https://auth.citius.test|summary_head",
    });
    const result = await asHead.query(api.crm.notificationEmailLedger.listDeliverySummary, {
      limit: 25,
    });
    expect(result).toMatchObject({ coverage: "partial", readinessState: "pending" });
    expect(result.summaries).toHaveLength(1);
    expect(result.summaries[0]).toMatchObject({
      eventId: String(actorIds.visibleId),
      origin: { label: "Visible delivery" },
      sent: 1,
      total: 1,
    });
    expect(JSON.stringify(result)).not.toContain("summary-head@citius.test");
    expect(JSON.stringify(result)).not.toContain("recipient-privacy");

    const asSales = t.withIdentity({
      email: "summary-sales@citius.test",
      issuer: "https://auth.citius.test",
      subject: "summary_sales",
      tokenIdentifier: "https://auth.citius.test|summary_sales",
    });
    await expect(
      asSales.query(api.crm.notificationEmailLedger.listDeliverySummary, { limit: 25 })
    ).rejects.toThrow("FORBIDDEN");
  });
});
