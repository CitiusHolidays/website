import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";

interface Outcome {
  attempts: number;
  correlationDigest: string;
  expiresAt: number;
  failureCode?: string;
  providerStatus?: number;
  purpose: "password_reset" | "verification";
  sentAt?: number;
  status: "queued" | "sending" | "retrying" | "sent" | "skipped" | "exhausted";
  updatedAt: number;
}

const recordOutcome = makeFunctionReference<
  "mutation",
  Omit<Outcome, "sentAt" | "updatedAt">,
  Outcome
>("authEmailDeliveries:recordOutcome");
const getOutcome = makeFunctionReference<"query", { correlationDigest: string }, Outcome | null>(
  "authEmailDeliveries:getOutcome"
);
const prepareIntent = makeFunctionReference<
  "mutation",
  {
    controlKey: "email.auth.staff_setup";
    correlationDigest: string;
    expiresAt: number;
    purpose: "password_reset" | "verification";
    recipientDigest: string;
  },
  { prepared: boolean }
>("authEmailDeliveryIntents:prepare");
const resolveIntent = makeFunctionReference<
  "query",
  {
    at: number;
    correlationDigest: string;
    purpose: "password_reset" | "verification";
    recipientDigest: string;
  },
  "email.auth.staff_setup" | null
>("authEmailDeliveryIntents:resolve");
const getDeliveryHealth = makeFunctionReference<
  "query",
  { at: number },
  {
    counts: Record<
      "password_reset" | "verification",
      Record<"exhausted" | "queued" | "retrying" | "sending" | "sent" | "skipped", number>
    >;
    coverage: "complete" | "partial";
    effectsObserved: number;
    intentsObserved: number;
    recent: Array<{
      attempts: number;
      effect: "failed" | "in_progress" | "not_attempted" | "sent";
      expiresAt: number;
      failureCode?: string;
      intent: "recorded";
      providerStatusClass?: "client_error" | "rate_limited" | "server_error";
      purpose: "password_reset" | "verification";
      recoveryAction: string;
      status: Outcome["status"];
      updatedAt: number;
      windowPosition: number;
    }>;
    target: {
      targetDeployment: string;
      targetEnvironment: string;
      targetRevision: string;
    };
    window: { endedAt: number; startedAt: number };
  }
>("authEmailDeliveries:getDeliveryHealth");

const FIXED_NOW = new Date("2026-08-30T16:00:00.000Z");

function staffIdentity(subject: string, email: string) {
  return {
    email,
    issuer: "https://auth.citius.test",
    subject,
    tokenIdentifier: `https://auth.citius.test|${subject}`,
  };
}

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

function authHealthFixtureFailure(index: number) {
  if (index === 0) {
    return "rate_limited";
  }
  if (index === 1) {
    return "private.health-admin@citius.test";
  }
  return index === 2 ? "token_expired" : undefined;
}

function authHealthFixtureRow(index: number) {
  return {
    attempts: index === 0 ? 2 : 1,
    correlationDigest: index.toString(16).padStart(64, "0"),
    createdAt: FIXED_NOW.getTime() - index,
    expiresAt: index === 2 ? FIXED_NOW.getTime() - 1 : FIXED_NOW.getTime() + 60_000,
    failureCode: authHealthFixtureFailure(index),
    providerStatus: index === 0 ? 429 : undefined,
    purpose: index % 2 === 0 ? ("verification" as const) : ("password_reset" as const),
    status: index < 3 ? ("exhausted" as const) : ("sent" as const),
    updatedAt: FIXED_NOW.getTime() - index,
  };
}

async function seedAuthHealthFixture(t: ReturnType<typeof createHarness>) {
  return await t.run(async (ctx) => {
    const insertStaff = async (
      subject: string,
      email: string,
      roles: ["Admin"] | ["Directors"]
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
    const seededAdminId = await insertStaff("health_admin", "health-admin@citius.test", ["Admin"]);
    await insertStaff("health_director", "health-director@citius.test", ["Directors"]);
    await Promise.all(
      Array.from(
        { length: 51 },
        async (_, index) => await ctx.db.insert("authEmailDeliveries", authHealthFixtureRow(index))
      )
    );
    const startedAt = FIXED_NOW.getTime() - 24 * 60 * 60 * 1000;
    await ctx.db.insert("authEmailDeliveries", {
      attempts: 1,
      correlationDigest: "f".repeat(64),
      createdAt: startedAt - 1,
      expiresAt: startedAt,
      failureCode: "old-private-sentinel",
      purpose: "verification",
      status: "exhausted",
      updatedAt: startedAt - 1,
    });
    return seededAdminId;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  process.env.OPERATIONAL_CONTROL_SOURCE_REVISION = "cb17-health-revision";
  process.env.OPERATIONAL_CONTROL_TARGET_ID = "local-convex";
  process.env.VERCEL_ENV = "development";
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.OPERATIONAL_CONTROL_SOURCE_REVISION;
  delete process.env.OPERATIONAL_CONTROL_TARGET_ID;
  delete process.env.VERCEL_ENV;
});

describe("registered auth email delivery receipts", () => {
  test("projects a bounded privacy-safe target window to exact Admin and rechecks revocation", async () => {
    const t = createHarness();
    const adminId = await seedAuthHealthFixture(t);

    const asAdmin = t.withIdentity(staffIdentity("health_admin", "health-admin@citius.test"));
    const health = await asAdmin.query(getDeliveryHealth, { at: FIXED_NOW.getTime() });
    expect(health).toMatchObject({
      coverage: "partial",
      effectsObserved: 50,
      intentsObserved: 50,
      target: {
        targetDeployment: "local-convex",
        targetEnvironment: "development",
        targetRevision: "cb17-health-revision",
      },
    });
    expect(health.window).toEqual({
      endedAt: FIXED_NOW.getTime(),
      startedAt: FIXED_NOW.getTime() - 24 * 60 * 60 * 1000,
    });
    expect(health.recent[0]).toMatchObject({
      effect: "failed",
      failureCode: "rate_limited",
      intent: "recorded",
      providerStatusClass: "rate_limited",
    });
    expect(health.recent[2]?.recoveryAction).toContain("fresh verification link");
    expect(health.recent[2]?.recoveryAction).toContain("never resend the expired token");
    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain("health-admin@citius.test");
    expect(serialized).not.toContain("old-private-sentinel");
    expect(serialized).not.toContain("correlationDigest");
    expect(serialized).not.toContain("0000000000000000");

    const asDirector = t.withIdentity(
      staffIdentity("health_director", "health-director@citius.test")
    );
    await expect(asDirector.query(getDeliveryHealth, { at: FIXED_NOW.getTime() })).rejects.toThrow(
      "FORBIDDEN"
    );
    await t.run(async (ctx) => await ctx.db.patch("staffUsers", adminId, { active: false }));
    await expect(asAdmin.query(getDeliveryHealth, { at: FIXED_NOW.getTime() })).rejects.toThrow(
      "FORBIDDEN"
    );
  });

  test("persists only bounded privacy-safe fields and keeps sent terminal", async () => {
    const t = createHarness();
    const correlationDigest = "a".repeat(64);
    const base = {
      correlationDigest,
      expiresAt: Date.now() + 60_000,
      purpose: "password_reset" as const,
    };

    await t.mutation(recordOutcome, { ...base, attempts: 0, status: "queued" });
    const sent = await t.mutation(recordOutcome, { ...base, attempts: 1, status: "sent" });
    const replay = await t.mutation(recordOutcome, {
      ...base,
      attempts: 0,
      failureCode: "rate_limited",
      providerStatus: 429,
      status: "retrying",
    });

    expect(replay).toEqual(sent);
    expect(await t.query(getOutcome, { correlationDigest })).toEqual(sent);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("authEmailDeliveries")
        .withIndex("by_correlationDigest", (q) => q.eq("correlationDigest", correlationDigest))
        .unique();
      expect(row).not.toBeNull();
      expect(Object.keys(row ?? {}).sort((left, right) => left.localeCompare(right))).toEqual(
        [
          "_creationTime",
          "_id",
          "attempts",
          "correlationDigest",
          "createdAt",
          "expiresAt",
          "failureCode",
          "providerStatus",
          "purpose",
          "sentAt",
          "status",
          "updatedAt",
        ]
          .filter((key) => key in (row ?? {}))
          .sort((left, right) => left.localeCompare(right))
      );
      const serialized = JSON.stringify(row);
      expect(serialized).not.toContain("private.person@example.com");
      expect(serialized).not.toContain("reset-token-fixture");
      expect(serialized).not.toMatch(/https?:|cookie|jwt|<html/i);
    });
  });

  test("rejects malformed digests, attempt bounds, and purpose collisions", async () => {
    const t = createHarness();
    const base = {
      attempts: 0,
      correlationDigest: "b".repeat(64),
      expiresAt: Date.now() + 60_000,
      purpose: "verification" as const,
      status: "queued" as const,
    };
    await expect(
      t.mutation(recordOutcome, { ...base, correlationDigest: "raw-token" })
    ).rejects.toThrow("AUTH_EMAIL_CORRELATION_INVALID");
    await expect(t.mutation(recordOutcome, { ...base, attempts: 11 })).rejects.toThrow(
      "AUTH_EMAIL_ATTEMPTS_INVALID"
    );
    await t.mutation(recordOutcome, base);
    await expect(t.mutation(recordOutcome, { ...base, purpose: "password_reset" })).rejects.toThrow(
      "AUTH_EMAIL_CORRELATION_MISMATCH"
    );
  });

  test("binds privileged staff-email intent to its recipient, purpose, expiry, and replay", async () => {
    const t = createHarness();
    const correlationDigest = "c".repeat(64);
    const recipientDigest = "d".repeat(64);
    const expiresAt = Date.now() + 60_000;
    const input = {
      controlKey: "email.auth.staff_setup" as const,
      correlationDigest,
      expiresAt,
      purpose: "verification" as const,
      recipientDigest,
    };

    await expect(t.mutation(prepareIntent, input)).resolves.toEqual({ prepared: true });
    await expect(t.mutation(prepareIntent, input)).resolves.toEqual({ prepared: false });
    await expect(
      t.mutation(prepareIntent, { ...input, recipientDigest: "e".repeat(64) })
    ).rejects.toThrow("AUTH_EMAIL_INTENT_CONFLICT");
    await expect(
      t.query(resolveIntent, {
        at: expiresAt - 1,
        correlationDigest,
        purpose: "verification",
        recipientDigest,
      })
    ).resolves.toBe("email.auth.staff_setup");
    await expect(
      t.query(resolveIntent, {
        at: expiresAt,
        correlationDigest,
        purpose: "verification",
        recipientDigest,
      })
    ).resolves.toBeNull();
    await expect(
      t.query(resolveIntent, {
        at: expiresAt - 1,
        correlationDigest,
        purpose: "password_reset",
        recipientDigest,
      })
    ).resolves.toBeNull();
    await expect(
      t.query(resolveIntent, {
        at: expiresAt - 1,
        correlationDigest,
        purpose: "verification",
        recipientDigest: "f".repeat(64),
      })
    ).resolves.toBeNull();
  });

  test("rejects malformed or nonfuture privileged intent inputs", async () => {
    const t = createHarness();
    const input = {
      controlKey: "email.auth.staff_setup" as const,
      correlationDigest: "a".repeat(64),
      expiresAt: Date.now() + 60_000,
      purpose: "password_reset" as const,
      recipientDigest: "b".repeat(64),
    };

    await expect(
      t.mutation(prepareIntent, { ...input, correlationDigest: "raw-token" })
    ).rejects.toThrow("AUTH_EMAIL_INTENT_DIGEST_INVALID");
    await expect(
      t.mutation(prepareIntent, { ...input, recipientDigest: "private@example.com" })
    ).rejects.toThrow("AUTH_EMAIL_INTENT_DIGEST_INVALID");
    await expect(
      t.mutation(prepareIntent, { ...input, expiresAt: Date.now() - 1 })
    ).rejects.toThrow("AUTH_EMAIL_INTENT_EXPIRY_INVALID");
    await expect(
      t.query(resolveIntent, {
        at: Date.now(),
        correlationDigest: "raw-token",
        purpose: "password_reset",
        recipientDigest: input.recipientDigest,
      })
    ).resolves.toBeNull();
  });
});
