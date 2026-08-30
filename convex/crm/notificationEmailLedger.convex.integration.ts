import { fromPartial } from "@total-typescript/shoehorn";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { publishWorkflowNotification } from "./lib/notifications";
import { notificationEmailIdempotencyKey } from "./notificationEmailDelivery";
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
  process.env.OPERATIONAL_CONTROL_SOURCE_REVISION = "cb17-email-revision";
  process.env.OPERATIONAL_CONTROL_TARGET_ID = "local-convex";
  process.env.VERCEL_ENV = "development";
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.OPERATIONAL_CONTROL_SOURCE_REVISION;
  delete process.env.OPERATIONAL_CONTROL_TARGET_ID;
  delete process.env.VERCEL_ENV;
});

describe("registered notification email summary projection", () => {
  test("reconciles 1,000 legacy deliveries through bounded pages before declaring exact coverage", async () => {
    const t = createHarness();
    const notificationId = await seedNotification(t, "large-event");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const expected = fromPartial<Record<DeliveryStatus, number>>(
      Object.fromEntries(STATUSES.map((status) => [status, 0]))
    );

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

  test("keeps an authorized delivery origin when email is on and the bell is off", async () => {
    const t = createHarness();
    const headId = await t.run(async (ctx) => {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: "https://auth.citius.test|email_only_head",
        createdAt: FIXED_NOW.getTime(),
        legacyAuthUserId: "email_only_head",
        status: "linked",
        updatedAt: FIXED_NOW.getTime(),
      });
      const staffId = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: "email_only_head",
        createdAt: FIXED_NOW.getTime(),
        email: "email-only-head@citius.test",
        emailNormalized: "email-only-head@citius.test",
        name: "Email Only Head",
        roles: ["Sales Head"],
        updatedAt: FIXED_NOW.getTime(),
      });
      await ctx.db.insert("operationalControlPlaneState", {
        activatedAt: FIXED_NOW.getTime(),
        activatedBy: "fixture",
        activatedByName: "Fixture",
        key: "global",
        reason: "Exercise independent bell and email controls.",
        revision: 1,
      });
      for (const control of [
        { key: "notifications.crm_bell", state: "disabled" as const },
        { key: "email.crm_workflow", state: "enabled" as const },
      ]) {
        await ctx.db.insert("operationalControlStates", {
          key: control.key,
          reason: "Email-only delivery fixture.",
          revision: 1,
          state: control.state,
          updatedAt: FIXED_NOW.getTime(),
          updatedBy: "fixture",
          updatedByName: "Fixture",
        });
      }
      return staffId;
    });

    const published = await t.run(async (ctx) =>
      publishWorkflowNotification(ctx, {
        bellTargets: { kind: "roles", roles: ["Sales Head"] },
        content: {
          body: "A CRM workflow email without a bell row.",
          entityId: "query_email_only",
          entityType: "query",
          title: "Email-only workflow delivery",
        },
        emailTargets: { kind: "roles", roles: ["Sales Head"] },
        operationalControls: { effectId: "workflow:query_email_only:email-only" },
      })
    );
    expect(published).toMatchObject({
      bell: { disposition: "suppressed", recipientCount: 0 },
      email: { disposition: "queued", recipientCount: 1 },
    });

    await t.mutation(internal.crm.notificationEmailLedger.recordDeliveryOutcome, {
      attempts: 1,
      eventId: published.eventId,
      idempotencyKey: "email-only/stable-recipient",
      recipientHash: "recipient-email-only",
      status: "sent",
    });

    await t.run(async (ctx) => {
      expect(await ctx.db.query("notifications").collect()).toHaveLength(0);
      const origin = await ctx.db
        .query("notificationEmailEventOrigins")
        .withIndex("by_eventId", (query) => query.eq("eventId", published.eventId))
        .unique();
      expect(origin).toMatchObject({
        audienceStaffIds: [headId],
        entityId: "query_email_only",
        entityType: "query",
        label: "Email-only workflow delivery",
      });
    });

    const asHead = t.withIdentity({
      email: "email-only-head@citius.test",
      issuer: "https://auth.citius.test",
      subject: "email_only_head",
      tokenIdentifier: "https://auth.citius.test|email_only_head",
    });
    const result = await asHead.query(api.crm.notificationEmailLedger.listDeliverySummary, {
      eventId: published.eventId,
      limit: 25,
    });
    expect(result.summaries).toEqual([
      expect.objectContaining({
        eventId: published.eventId,
        origin: expect.objectContaining({ label: "Email-only workflow delivery" }),
        sent: 1,
        total: 1,
      }),
    ]);
  });

  test("authorizes one-event triage and deduplicates a target-bound resend at its event revision", async () => {
    const t = createHarness();
    const seeded = await t.run(async (ctx) => {
      const insertStaff = async (
        subject: string,
        email: string,
        roles: ["Sales"] | ["Sales Head"]
      ) => {
        await ctx.db.insert("authIdentityLinks", {
          canonicalAuthUserId: `https://auth.citius.test|${subject}`,
          createdAt: FIXED_NOW.getTime(),
          legacyAuthUserId: subject,
          status: "linked",
          updatedAt: FIXED_NOW.getTime(),
        });
        return await ctx.db.insert("staffUsers", {
          active: true,
          authUserId: subject,
          createdAt: FIXED_NOW.getTime(),
          email,
          emailNormalized: email,
          name: subject,
          roles,
          updatedAt: FIXED_NOW.getTime(),
        });
      };
      const headId = await insertStaff("triage_head", "triage-head@citius.test", ["Sales Head"]);
      await insertStaff("other_head", "other-head@citius.test", ["Sales Head"]);
      await insertStaff("triage_sales", "triage-sales@citius.test", ["Sales"]);
      const eventId = await ctx.db.insert("notifications", {
        body: "Private body sentinel that must not cross the triage boundary.",
        createdAt: FIXED_NOW.getTime(),
        recipientStaffId: headId,
        title: "Authorized delivery event",
      });
      await ctx.db.insert("notificationEmailEventOrigins", {
        audienceStaffIds: [headId],
        audienceUserIds: ["triage_head"],
        createdAt: FIXED_NOW.getTime(),
        entityId: "query-private-sentinel",
        entityType: "query",
        eventId: String(eventId),
        label: "Authorized delivery event",
      });
      await ctx.db.insert("notificationEmailSummaryReadiness", {
        generation: 1,
        key: "notificationEmailDeliveries",
        ready: true,
        residuals: 0,
        scanned: 2,
        stage: "complete",
        startedAt: FIXED_NOW.getTime() - 1000,
        status: "complete",
        updatedAt: FIXED_NOW.getTime(),
        version: 1,
      });
      return { eventId: String(eventId), headId };
    });
    const retryKey = await notificationEmailIdempotencyKey(
      seeded.eventId,
      "triage-head@citius.test"
    );
    await t.mutation(internal.crm.notificationEmailLedger.recordDeliveryOutcome, {
      attempts: 4,
      eventId: seeded.eventId,
      failureCode: "provider_unavailable",
      idempotencyKey: retryKey,
      providerStatus: 503,
      recipientHash: retryKey.split("/").at(-1) ?? "missing-hash",
      status: "exhausted",
    });
    await t.mutation(internal.crm.notificationEmailLedger.recordDeliveryOutcome, {
      attempts: 0,
      eventId: seeded.eventId,
      failureCode: "triage-head@citius.test raw provider body",
      idempotencyKey: "fixture/unknown-safe-failure",
      recipientHash: "recipient-unknown-safe",
      status: "skipped",
    });

    const identity = (subject: string, email: string) => ({
      email,
      issuer: "https://auth.citius.test",
      subject,
      tokenIdentifier: `https://auth.citius.test|${subject}`,
    });
    const asHead = t.withIdentity(identity("triage_head", "triage-head@citius.test"));
    const triage = await asHead.query(api.crm.notificationEmailLedger.getDeliveryTriage, {
      at: FIXED_NOW.getTime(),
      eventId: seeded.eventId,
    });
    expect(triage).toMatchObject({
      attempts: { maximum: 4, minimum: 0 },
      canResend: true,
      coverage: "complete",
      eventId: seeded.eventId,
      needsAttention: 2,
      target: {
        targetDeployment: "local-convex",
        targetEnvironment: "development",
        targetRevision: "cb17-email-revision",
      },
    });
    expect(triage.causes.map(({ code }) => code)).toEqual(["provider_unavailable", "unknown"]);
    expect(JSON.stringify(triage)).not.toContain("triage-head@citius.test");
    expect(JSON.stringify(triage)).not.toContain("Private body sentinel");
    expect(triage.window).toEqual({
      endedAt: FIXED_NOW.getTime(),
      startedAt: FIXED_NOW.getTime() - 24 * 60 * 60 * 1000,
    });

    const asOtherHead = t.withIdentity(identity("other_head", "other-head@citius.test"));
    await expect(
      asOtherHead.query(api.crm.notificationEmailLedger.getDeliveryTriage, {
        at: FIXED_NOW.getTime(),
        eventId: seeded.eventId,
      })
    ).rejects.toThrow("NOTIFICATION_EMAIL_EVENT_NOT_FOUND");
    const asSales = t.withIdentity(identity("triage_sales", "triage-sales@citius.test"));
    await expect(
      asSales.query(api.crm.notificationEmailLedger.getDeliveryTriage, {
        at: FIXED_NOW.getTime(),
        eventId: seeded.eventId,
      })
    ).rejects.toThrow("FORBIDDEN");

    const baseCommand = {
      eventId: seeded.eventId,
      expectedTargetDeployment: triage.target.targetDeployment,
      expectedTargetEnvironment: triage.target.targetEnvironment,
      expectedTargetRevision: triage.target.targetRevision,
      expectedUpdatedAt: triage.eventUpdatedAt,
    };
    await expect(
      asHead.mutation(api.crm.notificationEmailLedger.requestDeliveryResend, {
        ...baseCommand,
        commandId: "00000000-0000-4000-8000-000000000001",
        expectedTargetRevision: "stale-revision",
      })
    ).rejects.toThrow("OPERATIONAL_CONTROL_TARGET_MISMATCH");
    const first = await asHead.mutation(api.crm.notificationEmailLedger.requestDeliveryResend, {
      ...baseCommand,
      commandId: "00000000-0000-4000-8000-000000000002",
    });
    const replay = await asHead.mutation(api.crm.notificationEmailLedger.requestDeliveryResend, {
      ...baseCommand,
      commandId: "00000000-0000-4000-8000-000000000002",
    });
    const doubleSubmit = await asHead.mutation(
      api.crm.notificationEmailLedger.requestDeliveryResend,
      {
        ...baseCommand,
        commandId: "00000000-0000-4000-8000-000000000003",
      }
    );
    expect(first).toEqual({ queuedRecipientCount: 1, replayed: false });
    expect(replay.replayed).toBe(true);
    expect(doubleSubmit).toEqual({ queuedRecipientCount: 1, replayed: true });
    await t.run(async (ctx) => {
      const effects = await ctx.db
        .query("operationalEffectReceipts")
        .withIndex("by_effectId", (query) =>
          query.eq("effectId", `crm-email-resend:${seeded.eventId}:${triage.eventUpdatedAt}`)
        )
        .collect();
      expect(effects).toHaveLength(1);
      expect(effects[0]).toMatchObject({ disposition: "queued", recipientCount: 1 });
      const commands = (await ctx.db.query("commandReceipts").collect()).filter(
        (command) => command.targetId === seeded.eventId
      );
      expect(commands).toHaveLength(2);
      const scheduled = await ctx.db.system.query("_scheduled_functions").collect();
      expect(scheduled).toHaveLength(1);
      expect(JSON.stringify(scheduled)).toContain('"attempts":4');
    });

    await t.run(async (ctx) => await ctx.db.patch("staffUsers", seeded.headId, { active: false }));
    await expect(
      asHead.query(api.crm.notificationEmailLedger.getDeliveryTriage, {
        at: FIXED_NOW.getTime(),
        eventId: seeded.eventId,
      })
    ).rejects.toThrow("FORBIDDEN");
  });
});
