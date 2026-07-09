import { describe, expect, test } from "bun:test";
import { deliverNotificationEmailsSequentially } from "./notificationEmailDelivery";

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
      message,
      recipients: ["accounts@example.com"],
      sendEmail: (email) => {
        attempts.push(email.to);
        return Promise.resolve(
          attempts.length === 1 ? { error: { statusCode: 429 } } : { error: null }
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
});
