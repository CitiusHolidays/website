import { describe, expect, test } from "bun:test";
import {
  deliverNotificationEmailsSequentially,
  notificationEmailIdempotencyKey,
} from "./notificationEmailDelivery";

const message = {
  from: "Citius <noreply@example.com>",
  html: "<p>Hello</p>",
  subject: "Citius Connect: Test",
  text: "Hello",
};

describe("deliverNotificationEmailsSequentially", () => {
  test("retries rate-limited sends before counting a recipient as delivered", async () => {
    const sleeps: number[] = [];
    const attempts: string[][] = [];

    const result = await deliverNotificationEmailsSequentially({
      config: { maxRetries: 3, minIntervalMs: 10 },
      eventId: "notifications_123",
      message,
      recipients: ["accounts@example.com"],
      sendEmail: (email, options) => {
        attempts.push(email.to);
        return notificationEmailIdempotencyKey("notifications_123", "accounts@example.com").then(
          (expectedKey) => {
            expect(options.idempotencyKey).toBe(expectedKey);
            return attempts.length === 1 ? { error: { statusCode: 429 } } : { error: null };
          }
        );
      },
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(attempts).toEqual([["accounts@example.com"], ["accounts@example.com"]]);
    expect(sleeps).toEqual([10]);
  });

  test("keeps sending later recipients after a terminal delivery failure", async () => {
    const sentTo: string[] = [];

    const result = await deliverNotificationEmailsSequentially({
      config: { maxRetries: 2, minIntervalMs: 5 },
      eventId: "notifications_456",
      message,
      recipients: ["bad@example.com", "good@example.com"],
      sendEmail: (email) => {
        sentTo.push(email.to[0] ?? "");
        return Promise.resolve(
          email.to[0] === "bad@example.com"
            ? { error: { name: "invalid_recipient" } }
            : { error: null }
        );
      },
      sleep: () => Promise.resolve(),
    });

    expect(result).toEqual({ sent: 1, skipped: 1 });
    expect(sentTo).toEqual(["bad@example.com", "good@example.com"]);
  });

  test("reuses one identity after an ambiguous network outcome", async () => {
    const identities: string[] = [];
    let attempts = 0;

    const result = await deliverNotificationEmailsSequentially({
      config: { maxRetries: 3, minIntervalMs: 10 },
      eventId: "notifications_network",
      message,
      recipients: ["sales@example.com"],
      sendEmail: (_email, options) => {
        identities.push(options.idempotencyKey);
        attempts += 1;
        if (attempts === 1) {
          return Promise.reject(new TypeError("connection reset after request"));
        }
        return Promise.resolve({ error: null });
      },
      sleep: () => Promise.resolve(),
    });

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(identities).toHaveLength(2);
    expect(new Set(identities).size).toBe(1);
  });

  test("scheduler replay keeps event-recipient identities stable and distinct", async () => {
    const identities: string[] = [];
    const deliver = () =>
      deliverNotificationEmailsSequentially({
        config: { maxRetries: 2, minIntervalMs: 0 },
        eventId: "notifications_replayed",
        message,
        recipients: ["head@example.com", "delegate@example.com"],
        sendEmail: (_email, options) => {
          identities.push(options.idempotencyKey);
          return Promise.resolve({ error: null });
        },
        sleep: () => Promise.resolve(),
      });

    await deliver();
    await deliver();

    expect(identities[0]).toBe(identities[2]);
    expect(identities[1]).toBe(identities[3]);
    expect(identities[0]).not.toBe(identities[1]);
    expect(identities.every((identity) => !identity.includes("@"))).toBe(true);
    expect(identities.every((identity) => !identity.includes("Citius Connect"))).toBe(true);
  });

  test("supports a stable product namespace without exposing recipient data", async () => {
    const key = await notificationEmailIdempotencyKey(
      "submission-123",
      "Traveller@Example.com",
      "contact-form"
    );
    expect(key).toStartWith("contact-form/submission-123/");
    expect(key).not.toContain("Traveller");
    expect(key).not.toContain("@");
  });
});
