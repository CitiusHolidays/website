import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
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

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

describe("registered auth email delivery receipts", () => {
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
