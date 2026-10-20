import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { publishWorkflowNotification } from "./lib/notifications";
import {
  enqueueNotificationEmailOutbox,
  NOTIFICATION_IDEMPOTENCY_WINDOW_MS,
  NOTIFICATION_LEASE_MS,
} from "./notificationEmailOutbox";

const claim = makeFunctionReference<
  "mutation",
  { jobId: Id<"notificationEmailOutbox"> },
  Doc<"notificationEmailOutbox"> | null
>("crm/notificationEmailOutbox:claimNotificationEmail");
const freeze = makeFunctionReference<
  "mutation",
  { attempt: number; jobId: Id<"notificationEmailOutbox">; message: typeof message },
  typeof message | null
>("crm/notificationEmailOutbox:freezeNotificationEmail");
const complete = makeFunctionReference<
  "mutation",
  {
    attempt: number;
    jobId: Id<"notificationEmailOutbox">;
    providerEmailId?: string;
    retryable: boolean;
    status: "accepted" | "failed";
  },
  null
>("crm/notificationEmailOutbox:completeNotificationEmail");
const recover = makeFunctionReference<"mutation", { jobId: Id<"notificationEmailOutbox"> }, null>(
  "crm/notificationEmailOutbox:recoverNotificationEmail"
);
const dispatch = makeFunctionReference<"action", { jobId: Id<"notificationEmailOutbox"> }, null>(
  "crm/notificationEmails:dispatchNotificationEmail"
);
const details = makeFunctionReference<
  "query",
  { jobId: Id<"notificationEmailOutbox"> },
  { rows: Array<{ label: string; value: string }>; title: string } | null
>("crm/notificationEmailDetails:getNotificationEmailDetails");
const message = {
  from: "Citius <sender@example.invalid>",
  html: "<p>Original</p>",
  subject: "Original",
  text: "Original",
};

function harness() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  rateLimiterTest.register(t, "rateLimiter");
  return t;
}

async function enqueue(t: ReturnType<typeof harness>, recipients = ["spoc@example.invalid"]) {
  return await t.run((ctx) =>
    enqueueNotificationEmailOutbox(ctx, {
      body: "Original event facts",
      eventId: "event-1",
      recipients,
      title: "Assigned to you",
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
  vi.stubGlobal("fetch", () => {
    throw new Error("Test forbids external requests");
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("durable notification email lifecycle", () => {
  test("queues normalized recipients and the opaque ledger in the same transaction, once", async () => {
    const t = harness();
    const ids = await enqueue(t, [
      " SPOC@example.invalid ",
      "spoc@example.invalid",
      "head@example.invalid",
    ]);
    expect(ids).toHaveLength(2);
    expect(await enqueue(t, ["spoc@example.invalid", "head@example.invalid"])).toEqual(ids);
    const rows = await t.run((ctx) => ctx.db.query("notificationEmailDeliveries").collect());
    expect(rows.map((row) => row.status)).toEqual(["queued", "queued"]);
    expect(JSON.stringify(rows)).not.toContain("@example.invalid");
    await expect(
      t.run((ctx) =>
        enqueueNotificationEmailOutbox(ctx, {
          body: "Changed facts",
          eventId: "event-1",
          recipients: ["spoc@example.invalid"],
          title: "Assigned to you",
        })
      )
    ).rejects.toThrow("PAYLOAD_CONFLICT");
  });

  test("allows one concurrent claimant and freezes one immutable render across recovery", async () => {
    const t = harness();
    const [jobId] = await enqueue(t);
    if (!jobId) {
      throw new Error("Fixture missing job");
    }
    const claims = await Promise.all([t.mutation(claim, { jobId }), t.mutation(claim, { jobId })]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await t.mutation(freeze, { attempt: 1, jobId, message })).toEqual(message);
    expect(
      await t.mutation(freeze, {
        attempt: 1,
        jobId,
        message: { ...message, text: "Later record changes" },
      })
    ).toEqual(message);
    vi.setSystemTime(Date.now() + NOTIFICATION_LEASE_MS);
    await t.mutation(recover, { jobId });
    const recovered = await t.mutation(claim, { jobId });
    expect(recovered).toMatchObject({ attempts: 2, message, status: "sending" });
    await t.mutation(complete, { attempt: 1, jobId, retryable: false, status: "failed" });
    expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
      attempts: 2,
      status: "sending",
    });
  });

  test("terminal acceptance prevents resending beyond the provider's 24-hour retention", async () => {
    const t = harness();
    const [jobId] = await enqueue(t);
    if (!jobId) {
      throw new Error("Fixture missing job");
    }
    await t.mutation(claim, { jobId });
    await t.mutation(freeze, { attempt: 1, jobId, message });
    await t.mutation(complete, {
      attempt: 1,
      jobId,
      providerEmailId: "provider-receipt-1",
      retryable: false,
      status: "accepted",
    });
    vi.setSystemTime(Date.now() + NOTIFICATION_IDEMPOTENCY_WINDOW_MS + 1);
    expect(await enqueue(t)).toEqual([jobId]);
    expect(await t.mutation(claim, { jobId })).toBeNull();
    const row = await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId));
    expect(row).toMatchObject({
      attempts: 1,
      providerEmailId: "provider-receipt-1",
      status: "accepted",
    });
    expect(row?.recipient).toBeUndefined();
    expect(row?.message).toBeUndefined();
  });

  test("stops ambiguous work before a key can expire, without falsely declaring rejection", async () => {
    const t = harness();
    const [jobId] = await enqueue(t);
    if (!jobId) {
      throw new Error("Fixture missing job");
    }
    await t.mutation(claim, { jobId });
    vi.setSystemTime(Date.now() + NOTIFICATION_IDEMPOTENCY_WINDOW_MS);
    expect(await t.mutation(claim, { jobId })).toBeNull();
    expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
      failureCode: "idempotency_window_expired",
      status: "uncertain",
    });
  });

  test("shares CRM pacing across separate events without charging deferred attempts", async () => {
    const t = harness();
    const [first, second] = await enqueue(t, ["one@example.invalid", "two@example.invalid"]);
    if (!(first && second)) {
      throw new Error("Fixture missing jobs");
    }
    expect(await t.mutation(claim, { jobId: first })).not.toBeNull();
    expect(await t.mutation(claim, { jobId: second })).toBeNull();
    expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", second))).toMatchObject({
      attempts: 0,
      status: "pending",
    });
    vi.setSystemTime(Date.now() + 550);
    expect(await t.mutation(claim, { jobId: second })).toMatchObject({ attempts: 1 });
  });

  test.each(["inactive", "changed-address"])(
    "does not send when staff become %s",
    async (change) => {
      const t = harness();
      const staffId = await t.run((ctx) =>
        ctx.db.insert("staffUsers", {
          active: true,
          createdAt: Date.now(),
          email: "spoc@example.invalid",
          emailNormalized: "spoc@example.invalid",
          name: "SPOC",
          roles: ["Contracting"],
          updatedAt: Date.now(),
        })
      );
      const [jobId] = await enqueue(t);
      if (!jobId) {
        throw new Error("Fixture missing job");
      }
      await t.run((ctx) =>
        ctx.db.patch(
          "staffUsers",
          staffId,
          change === "inactive" ? { active: false } : { email: "new@example.invalid" }
        )
      );
      expect(await t.mutation(claim, { jobId })).toBeNull();
      expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
        failureCode: "recipient_no_longer_active",
        status: "skipped",
      });
    }
  );

  test("runs the real dispatcher through a supplied provider and persists acceptance before returning", async () => {
    const t = harness();
    const [jobId] = await enqueue(t);
    if (!jobId) {
      throw new Error("Fixture missing job");
    }
    vi.stubEnv("RESEND_API_KEY", "test-only");
    vi.stubEnv("SITE_URL", "https://fixture.example");
    const requests: RequestInit[] = [];
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      requests.push(init);
      return Promise.resolve(Response.json({ id: "provider-receipt-2" }));
    });
    await t.action(dispatch, { jobId });
    await t.action(dispatch, { jobId });
    expect(requests).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
      providerEmailId: "provider-receipt-2",
      status: "accepted",
    });
  });
});

test("rechecks assignment after a frozen attempt instead of emailing a former SPOC", async () => {
  const t = harness();
  const { queryId, staffId } = await t.run(async (ctx) => {
    const insertedStaffId = await ctx.db.insert("staffUsers", {
      active: true,
      createdAt: Date.now(),
      email: "spoc@example.invalid",
      emailNormalized: "spoc@example.invalid",
      name: "Original SPOC",
      roles: ["Contracting"],
      updatedAt: Date.now(),
    });
    const insertedQueryId = await ctx.db.insert("queries", {
      clientName: "Fictional review client",
      contractingOwnerId: insertedStaffId,
      contractingStatus: "Query Received",
      createdAt: Date.now(),
      createdBy: "other",
      paxCount: 12,
      queryCode: "Q-TEST",
      queryType: "FIT",
      salesStatus: "Proposal in discussion",
      travelType: "Domestic Travel",
      updatedAt: Date.now(),
    });
    return { queryId: insertedQueryId, staffId: insertedStaffId };
  });
  const [jobId] = await t.run((ctx) =>
    enqueueNotificationEmailOutbox(ctx, {
      body: "Review assigned query",
      entityId: queryId,
      entityType: "query",
      eventId: "assignment-1",
      recipients: ["spoc@example.invalid"],
      title: "Assigned to you",
    })
  );
  if (!jobId) {
    throw new Error("Fixture missing job");
  }
  expect(await t.mutation(claim, { jobId })).toMatchObject({ recipientStaffId: staffId });
  expect(await t.query(details, { jobId })).not.toBeNull();
  await t.mutation(freeze, { attempt: 1, jobId, message });
  await t.run((ctx) => ctx.db.patch("queries", queryId, { contractingOwnerId: undefined }));
  await expect(t.query(details, { jobId })).rejects.toThrow(
    "NOTIFICATION_EMAIL_RECIPIENT_ACCESS_CHANGED"
  );
  vi.setSystemTime(Date.now() + NOTIFICATION_LEASE_MS);
  expect(await t.mutation(claim, { jobId })).toBeNull();
  expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
    failureCode: "recipient_access_changed",
    status: "skipped",
  });
});

test("honors an email kill switch changed after enqueue", async () => {
  const t = harness();
  const [jobId] = await enqueue(t);
  if (!jobId) {
    throw new Error("Fixture missing job");
  }
  await t.run(async (ctx) => {
    await ctx.db.insert("operationalControlPlaneState", {
      activatedAt: Date.now(),
      activatedBy: "fixture",
      activatedByName: "Fixture",
      key: "global",
      reason: "Synthetic test activation",
      revision: 1,
    });
    return await ctx.db.insert("operationalControlStates", {
      key: "email.crm_workflow",
      reason: "Synthetic test switch",
      revision: 1,
      state: "disabled",
      updatedAt: Date.now(),
      updatedBy: "fixture",
      updatedByName: "Fixture",
    });
  });
  expect(await t.mutation(claim, { jobId })).toBeNull();
  expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
    failureCode: "delivery_control_disabled",
    status: "skipped",
  });
});

test("keeps the mailbox copy independent of the Sales email switch", async () => {
  const t = harness();
  const [jobId] = await t.run((ctx) =>
    enqueueNotificationEmailOutbox(ctx, {
      body: "Contact enquiry",
      controlKeys: ["inbound.info_mailbox_email"],
      eventId: "mailbox-1",
      recipients: ["info@example.invalid"],
      title: "New enquiry",
    })
  );
  if (!jobId) {
    throw new Error("Fixture missing job");
  }
  await t.run(async (ctx) => {
    await ctx.db.insert("operationalControlPlaneState", {
      activatedAt: Date.now(),
      activatedBy: "fixture",
      activatedByName: "Fixture",
      key: "global",
      reason: "Synthetic test activation",
      revision: 1,
    });
    await ctx.db.insert("operationalControlStates", {
      key: "inbound.info_mailbox_email",
      reason: "Approved mailbox copy",
      revision: 1,
      state: "enabled",
      updatedAt: Date.now(),
      updatedBy: "fixture",
      updatedByName: "Fixture",
    });
    await ctx.db.insert("operationalControlStates", {
      key: "email.crm_workflow",
      reason: "Approved CRM email",
      revision: 1,
      state: "enabled",
      updatedAt: Date.now(),
      updatedBy: "fixture",
      updatedByName: "Fixture",
    });
    return await ctx.db.insert("operationalControlStates", {
      key: "inbound.sales_email",
      reason: "Synthetic test switch",
      revision: 1,
      state: "disabled",
      updatedAt: Date.now(),
      updatedBy: "fixture",
      updatedByName: "Fixture",
    });
  });
  expect(await t.mutation(claim, { jobId })).toMatchObject({ attempts: 1, status: "sending" });
});

test("rolls back the provider receipt if the matching ledger write fails", async () => {
  const t = harness();
  const [jobId] = await enqueue(t);
  if (!jobId) {
    throw new Error("Fixture missing job");
  }
  await t.mutation(claim, { jobId });
  await t.run(async (ctx) => {
    const [row] = await ctx.db.query("notificationEmailDeliveries").collect();
    if (!row) {
      throw new Error("Fixture missing ledger");
    }
    const { _creationTime, _id, ...duplicate } = row;
    await ctx.db.insert("notificationEmailDeliveries", duplicate);
  });
  await expect(
    t.mutation(complete, {
      attempt: 1,
      jobId,
      providerEmailId: "accepted-before-ledger-failure",
      retryable: false,
      status: "accepted",
    })
  ).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
    status: "sending",
  });
  expect(
    (await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId)))?.providerEmailId
  ).toBeUndefined();
});

test("keeps the lease exclusive even after the provider pacing slot refills", async () => {
  const t = harness();
  const [jobId] = await enqueue(t);
  if (!jobId) {
    throw new Error("Fixture missing job");
  }
  expect(await t.mutation(claim, { jobId })).toMatchObject({ attempts: 1 });
  vi.setSystemTime(Date.now() + 550);
  expect(await t.mutation(claim, { jobId })).toBeNull();
  expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
    attempts: 1,
    status: "sending",
  });
});

test("does not revive an old attempted delivery without its immutable message or first-attempt time", async () => {
  const t = harness();
  const recipientHash = "0b781e0947474203d6b22871b0182fbe";
  await t.run((ctx) =>
    ctx.db.insert("notificationEmailDeliveries", {
      attempts: 1,
      createdAt: Date.now() - 48 * 60 * 60 * 1000,
      eventId: "event-1",
      idempotencyKey: `crm-notification/event-1/${recipientHash}`,
      recipientHash,
      status: "retrying",
      updatedAt: Date.now(),
    })
  );
  const [jobId] = await enqueue(t);
  if (!jobId) {
    throw new Error("Fixture missing job");
  }
  expect(await t.mutation(claim, { jobId })).toBeNull();
  expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
    status: "uncertain",
  });
  expect(
    (await t.run((ctx) => ctx.db.query("notificationEmailDeliveries").collect()))[0]
  ).toMatchObject({ failureCode: "legacy_attempt_outcome_unknown", status: "exhausted" });
});

test("keeps a late provider receipt from an earlier fixed-message attempt and ignores later failures", async () => {
  const t = harness();
  const [jobId] = await enqueue(t);
  if (!jobId) {
    throw new Error("Fixture missing job");
  }
  await t.mutation(claim, { jobId });
  await t.mutation(freeze, { attempt: 1, jobId, message });
  vi.setSystemTime(Date.now() + NOTIFICATION_LEASE_MS);
  expect(await t.mutation(claim, { jobId })).toMatchObject({ attempts: 2 });
  await t.mutation(complete, {
    attempt: 1,
    jobId,
    providerEmailId: "late-receipt",
    retryable: false,
    status: "accepted",
  });
  await t.mutation(complete, { attempt: 2, jobId, retryable: true, status: "failed" });
  expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
    attempts: 2,
    providerEmailId: "late-receipt",
    status: "accepted",
  });
  expect(
    (await t.run((ctx) => ctx.db.query("notificationEmailDeliveries").collect()))[0]
  ).toMatchObject({ attempts: 2, status: "sent" });
});

test("does not email a vanished staff address from a legacy entity envelope", async () => {
  const t = harness();
  const [jobId] = await t.run((ctx) =>
    enqueueNotificationEmailOutbox(ctx, {
      body: "Old assignment",
      entityId: "old-query",
      entityType: "query",
      eventId: "old-staff",
      recipients: ["removed@example.invalid"],
      title: "Assigned to you",
    })
  );
  if (!jobId) {
    throw new Error("Fixture missing job");
  }
  expect(await t.mutation(claim, { jobId })).toBeNull();
  expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
    failureCode: "recipient_no_longer_identified",
    status: "skipped",
  });
});

async function pendingPurposeFixture(purpose: "assignment" | "head" | "historical") {
  const t = harness();
  const fixture = await t.run(async (ctx) => {
    const staffId = await ctx.db.insert("staffUsers", {
      active: true,
      createdAt: Date.now(),
      email: "spoc@example.invalid",
      emailNormalized: "spoc@example.invalid",
      name: "Original recipient",
      roles:
        purpose === "head"
          ? ["Contracting Head", "Operations Head"]
          : ["Contracting", "Operations Head"],
      updatedAt: Date.now(),
    });
    const queryId = await ctx.db.insert("queries", {
      clientName: "Fictional client",
      contractingOwnerId: staffId,
      contractingStatus: "Query Received",
      createdAt: Date.now(),
      createdBy: "other",
      paxCount: 12,
      queryCode: "Q-PURPOSE",
      queryType: "FIT",
      salesStatus: "Proposal in discussion",
      travelType: "Domestic Travel",
      updatedAt: Date.now(),
    });
    await publishWorkflowNotification(ctx, {
      bellTargets: { kind: "staff", staffIds: [staffId] },
      content: {
        body: purpose === "historical" ? "The order was marked lost." : "Review this query.",
        entityId: queryId,
        entityType: "query",
        title: purpose === "historical" ? "Order lost on your query" : "Contracting assignment",
      },
      emailRecipientPurpose:
        purpose === "assignment" ? { field: "contractingOwnerId", kind: "assignment" } : undefined,
      emailTargets:
        purpose === "head"
          ? { kind: "roles", roles: ["Contracting Head"] }
          : { kind: "staff", staffIds: [staffId] },
    });
    const job = await ctx.db.query("notificationEmailOutbox").unique();
    if (!job) {
      throw new Error("Fixture did not queue its email");
    }
    return { jobId: job._id, queryId, staffId };
  });
  return { t, ...fixture };
}

test.each([
  ["assignment", "initial"],
  ["assignment", "retry"],
  ["head", "initial"],
  ["head", "retry"],
] as const)(
  "stops a removed %s purpose before %s delivery despite continued broad record access",
  async (purpose, stage) => {
    const { t, jobId, queryId, staffId } = await pendingPurposeFixture(purpose);
    if (stage === "retry") {
      expect(await t.mutation(claim, { jobId })).not.toBeNull();
      await t.mutation(freeze, { attempt: 1, jobId, message });
    }
    await t.run(async (ctx) => {
      await ctx.db.patch("queries", queryId, { contractingOwnerId: undefined });
      await ctx.db.patch("staffUsers", staffId, { roles: ["Operations Head"] });
    });
    await expect(t.query(details, { jobId })).rejects.toThrow(
      "NOTIFICATION_EMAIL_RECIPIENT_ACCESS_CHANGED"
    );
    vi.setSystemTime(Date.now() + NOTIFICATION_LEASE_MS);
    expect(await t.mutation(claim, { jobId })).toBeNull();
    expect(await t.run((ctx) => ctx.db.get("notificationEmailOutbox", jobId))).toMatchObject({
      attempts: stage === "retry" ? 1 : 0,
      failureCode: "recipient_access_changed",
      status: "skipped",
    });
  }
);

test("retains an informational event for its original recipient after reassignment when access remains", async () => {
  const { t, jobId, queryId } = await pendingPurposeFixture("historical");
  await t.run((ctx) => ctx.db.patch("queries", queryId, { contractingOwnerId: undefined }));
  expect(await t.query(details, { jobId })).not.toBeNull();
  expect(await t.mutation(claim, { jobId })).toMatchObject({ attempts: 1, status: "sending" });
});

test("keeps an unchanged assignment eligible for delayed delivery", async () => {
  const { t, jobId } = await pendingPurposeFixture("assignment");
  vi.setSystemTime(Date.now() + NOTIFICATION_LEASE_MS);
  expect(await t.mutation(claim, { jobId })).toMatchObject({ attempts: 1, status: "sending" });
});

test("does not replay an event under a different recipient purpose even when addresses match", async () => {
  const t = harness();
  const staffId = await t.run((ctx) =>
    ctx.db.insert("staffUsers", {
      active: true,
      createdAt: Date.now(),
      email: "head@example.invalid",
      emailNormalized: "head@example.invalid",
      name: "Fictional head",
      roles: ["Contracting Head", "Operations Head"],
      updatedAt: Date.now(),
    })
  );
  const plan = {
    bellTargets: { kind: "staff" as const, staffIds: [staffId] },
    content: { body: "Review pending work.", title: "Head review" },
    operationalControls: { effectId: "purpose-fixed-event" },
  };
  await t.run((ctx) =>
    publishWorkflowNotification(ctx, {
      ...plan,
      emailTargets: { kind: "roles", roles: ["Contracting Head"] },
    })
  );
  await expect(
    t.run((ctx) =>
      publishWorkflowNotification(ctx, {
        ...plan,
        emailTargets: { kind: "roles", roles: ["Operations Head"] },
      })
    )
  ).rejects.toThrow("OPERATIONAL_EFFECT_RECEIPT_CONFLICT");
  const jobs = await t.run((ctx) => ctx.db.query("notificationEmailOutbox").collect());
  expect(jobs).toHaveLength(1);
  expect(jobs[0]?.recipientPurposes).toEqual([{ kind: "roles", roles: ["Contracting Head"] }]);
});
