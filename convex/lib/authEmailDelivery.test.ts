import { describe, expect, test } from "bun:test";
import type { ActionCtx } from "../_generated/server";
import {
  type AuthEmailDeliveryOutcome,
  authEmailCorrelationDigest,
  deliverTransactionalAuthEmail,
} from "./authEmailDelivery";

const CORRELATION_SECRET = "reset-token-fixture-that-must-never-be-stored";
const RECIPIENT = "private.person@example.com";
const SHA_256_HEX_PATTERN = /^[0-9a-f]{64}$/;

function createReceiptContext() {
  let receipt: AuthEmailDeliveryOutcome | null = null;
  const ctx = {
    runMutation: (_reference: unknown, args: AuthEmailDeliveryOutcome) => {
      const updatedAt = Date.now();
      receipt = {
        ...args,
        ...(args.status === "sent" ? { sentAt: receipt?.sentAt ?? updatedAt } : {}),
        updatedAt,
      };
      return Promise.resolve(receipt);
    },
    runQuery: () => Promise.resolve(receipt),
  } as unknown as ActionCtx;
  return { ctx, getReceipt: () => receipt };
}

function deliver(
  ctx: ActionCtx,
  overrides: Partial<Parameters<typeof deliverTransactionalAuthEmail>[1]> = {}
) {
  return deliverTransactionalAuthEmail(ctx, {
    correlationSecret: CORRELATION_SECRET,
    deliveryConfig: { maxAttempts: 4, minIntervalMs: 0 },
    expiresAt: Date.now() + 60_000,
    html: `<p>Private link for ${RECIPIENT}</p>`,
    purpose: "password_reset",
    recipient: RECIPIENT,
    subject: "Reset your password",
    text: "Use the private reset link.",
    ...overrides,
  });
}

describe("transactional auth email delivery", () => {
  test("retries 429 and 5xx outcomes with one privacy-safe provider identity", async () => {
    const { ctx, getReceipt } = createReceiptContext();
    const identities: string[] = [];
    let attempt = 0;

    const outcome = await deliver(ctx, {
      sendEmail: (input) => {
        attempt += 1;
        identities.push(input.idempotencyKey);
        if (attempt === 1) {
          return Promise.resolve({ error: { statusCode: 429 } });
        }
        if (attempt === 2) {
          return Promise.resolve({ error: { statusCode: 503 } });
        }
        return Promise.resolve({ error: null });
      },
    });

    expect(outcome).toMatchObject({ attempts: 3, purpose: "password_reset", status: "sent" });
    expect(new Set(identities).size).toBe(1);
    expect(identities[0]).toStartWith("auth-transactional/password_reset/");
    expect(identities[0]).not.toContain(RECIPIENT);
    expect(identities[0]).not.toContain(CORRELATION_SECRET);
    expect(JSON.stringify(getReceipt())).not.toContain(RECIPIENT);
    expect(JSON.stringify(getReceipt())).not.toContain(CORRELATION_SECRET);
  });

  test("records a permanent provider rejection without retrying", async () => {
    const { ctx } = createReceiptContext();
    let attempts = 0;
    const outcome = await deliver(ctx, {
      sendEmail: () => {
        attempts += 1;
        return Promise.resolve({ error: { name: "invalid_recipient", statusCode: 400 } });
      },
    });

    expect(attempts).toBe(1);
    expect(outcome).toMatchObject({
      attempts: 1,
      failureCode: "provider_rejected",
      providerStatus: 400,
      status: "exhausted",
    });
  });

  test("fails closed after expiry without calling the provider", async () => {
    const { ctx } = createReceiptContext();
    let providerCalls = 0;
    const outcome = await deliver(ctx, {
      expiresAt: Date.now() - 1,
      sendEmail: () => {
        providerCalls += 1;
        return Promise.resolve({ error: null });
      },
    });

    expect(providerCalls).toBe(0);
    expect(outcome).toMatchObject({
      attempts: 1,
      failureCode: "token_expired",
      status: "exhausted",
    });
  });

  test("deduplicates a repeated callback after the durable terminal receipt", async () => {
    const { ctx } = createReceiptContext();
    let providerCalls = 0;
    const sendEmail = () => {
      providerCalls += 1;
      return Promise.resolve({ error: null });
    };

    const first = await deliver(ctx, { sendEmail });
    const replay = await deliver(ctx, { sendEmail });

    expect(providerCalls).toBe(1);
    expect(replay).toEqual(first);
  });

  test("uses a stable one-way correlation digest", async () => {
    const first = await authEmailCorrelationDigest("password_reset", CORRELATION_SECRET);
    const replay = await authEmailCorrelationDigest("password_reset", CORRELATION_SECRET);
    const verification = await authEmailCorrelationDigest("verification", CORRELATION_SECRET);

    expect(first).toMatch(SHA_256_HEX_PATTERN);
    expect(replay).toBe(first);
    expect(verification).not.toBe(first);
    expect(first).not.toContain(CORRELATION_SECRET);
  });
});
