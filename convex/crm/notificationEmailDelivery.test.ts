import { describe, expect, test } from "bun:test";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import {
  deliverNotificationEmailsSequentially,
  notificationEmailDeliveryProgram,
  notificationEmailIdempotencyKey,
  RESEND_DELIVERY_MAX_ATTEMPTS,
  RESEND_DELIVERY_MIN_INTERVAL_MS,
} from "./notificationEmailDelivery";

const message = {
  from: "Citius <noreply@example.com>",
  html: "<p>Hello</p>",
  subject: "Citius Connect: Test",
  text: "Hello",
};

describe("deliverNotificationEmailsSequentially", () => {
  test("keeps production provider pacing and attempt semantics explicit", () => {
    expect(RESEND_DELIVERY_MAX_ATTEMPTS).toBe(4);
    expect(RESEND_DELIVERY_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(550);
  });

  test("retries rate-limited sends before counting a recipient as delivered", async () => {
    const attempts: string[][] = [];

    const result = await deliverNotificationEmailsSequentially({
      config: { maxAttempts: 3, minIntervalMs: 0 },
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
    });

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(attempts).toEqual([["accounts@example.com"], ["accounts@example.com"]]);
  });

  test("keeps sending later recipients after a terminal delivery failure", async () => {
    const sentTo: string[] = [];

    const result = await deliverNotificationEmailsSequentially({
      config: { maxAttempts: 2, minIntervalMs: 0 },
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
    });

    expect(result).toEqual({ sent: 1, skipped: 1 });
    expect(sentTo).toEqual(["bad@example.com", "good@example.com"]);
  });

  test("reuses one identity after an ambiguous network outcome", async () => {
    const identities: string[] = [];
    let attempts = 0;

    const result = await deliverNotificationEmailsSequentially({
      config: { maxAttempts: 3, minIntervalMs: 0 },
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
    });

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(identities).toHaveLength(2);
    expect(new Set(identities).size).toBe(1);
  });

  test("reports queued, retry, and terminal states without changing pacing", async () => {
    const statuses: string[] = [];
    let attempts = 0;
    const result = await deliverNotificationEmailsSequentially({
      config: { maxAttempts: 2, minIntervalMs: 0 },
      eventId: "notifications_statuses",
      message,
      onStatus: ({ status, attempts: statusAttempts }) => {
        statuses.push(`${status}:${statusAttempts}`);
      },
      recipients: ["sales@example.com"],
      sendEmail: () => {
        attempts += 1;
        return Promise.resolve(attempts === 1 ? { error: { statusCode: 429 } } : { error: null });
      },
    });

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(statuses).toEqual(["queued:0", "sending:1", "retrying:1", "sending:2", "sent:2"]);
  });

  test("scheduler replay keeps event-recipient identities stable and distinct", async () => {
    const identities: string[] = [];
    const deliver = () =>
      deliverNotificationEmailsSequentially({
        config: { maxAttempts: 2, minIntervalMs: 0 },
        eventId: "notifications_replayed",
        message,
        recipients: ["head@example.com", "delegate@example.com"],
        sendEmail: (_email, options) => {
          identities.push(options.idempotencyKey);
          return Promise.resolve({ error: null });
        },
      });

    await deliver();
    await deliver();

    expect(identities[0]).toBe(identities[2]);
    expect(identities[1]).toBe(identities[3]);
    expect(identities[0]).not.toBe(identities[1]);
    expect(identities.every((identity) => !identity.includes("@"))).toBe(true);
    expect(identities.every((identity) => !identity.includes("Citius Connect"))).toBe(true);
  });

  test("uses the Effect TestClock for the full attempt bound and inter-recipient pacing", async () => {
    const recipients: string[] = [];
    const statuses: string[] = [];
    const attemptSignals = Array.from({ length: 4 }, () => {
      let resolve!: () => void;
      const promise = new Promise<void>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    });
    const testProgram = Effect.gen(function* () {
      const delivery = yield* Effect.forkChild(
        notificationEmailDeliveryProgram({
          config: { maxAttempts: 3, minIntervalMs: 10 },
          eventId: "notifications_clock",
          message,
          onStatus: (event) => {
            statuses.push(`${event.recipient}:${event.status}:${event.attempts}`);
          },
          recipients: ["bad@example.com", "good@example.com"],
          sendEmail: (email) => {
            const recipient = email.to[0] ?? "";
            recipients.push(recipient);
            attemptSignals[recipients.length - 1]?.resolve();
            return Promise.resolve(
              recipient === "bad@example.com" ? { error: { statusCode: 429 } } : { error: null }
            );
          },
        })
      );

      yield* Effect.promise(() => attemptSignals[0]?.promise ?? Promise.resolve());
      expect(recipients).toEqual(["bad@example.com"]);
      yield* TestClock.adjust(Duration.millis(9));
      yield* Effect.yieldNow;
      expect(recipients).toEqual(["bad@example.com"]);
      yield* TestClock.adjust(Duration.millis(1));
      yield* Effect.promise(() => attemptSignals[1]?.promise ?? Promise.resolve());
      expect(recipients).toEqual(["bad@example.com", "bad@example.com"]);
      yield* TestClock.adjust(Duration.millis(10));
      yield* Effect.promise(() => attemptSignals[2]?.promise ?? Promise.resolve());
      expect(recipients).toEqual(["bad@example.com", "bad@example.com", "bad@example.com"]);
      yield* TestClock.adjust(Duration.millis(9));
      yield* Effect.yieldNow;
      expect(recipients).toHaveLength(3);
      yield* TestClock.adjust(Duration.millis(1));
      yield* Effect.promise(() => attemptSignals[3]?.promise ?? Promise.resolve());
      const result = yield* Fiber.join(delivery);

      expect(result).toEqual({ sent: 1, skipped: 1 });
      expect(recipients).toEqual([
        "bad@example.com",
        "bad@example.com",
        "bad@example.com",
        "good@example.com",
      ]);
      expect(statuses).toEqual([
        "bad@example.com:queued:0",
        "bad@example.com:sending:1",
        "bad@example.com:retrying:1",
        "bad@example.com:sending:2",
        "bad@example.com:retrying:2",
        "bad@example.com:sending:3",
        "bad@example.com:exhausted:3",
        "good@example.com:queued:0",
        "good@example.com:sending:1",
        "good@example.com:sent:1",
      ]);
    }).pipe(Effect.provide(TestClock.layer()));

    await Effect.runPromise(testProgram);
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
