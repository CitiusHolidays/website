import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { sendNotificationEmailWithResend } from "./notificationEmailProvider";

const message = {
  from: "Citius <sender@example.invalid>",
  html: "<p>Private</p>",
  replyTo: "reply@example.invalid",
  subject: "Assigned to you",
  text: "Private",
  to: ["spoc@example.invalid"],
};
afterEach(() => {
  spyOn(globalThis, "fetch").mockRestore();
});

describe("Resend HTTP contract", () => {
  test("passes the cancellation signal and stable key, and requires a receipt", async () => {
    const request = spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ id: "receipt-123" })
    );
    const { signal } = new AbortController();
    expect(
      await sendNotificationEmailWithResend("test-only", message, {
        idempotencyKey: "stable-key",
        signal,
      })
    ).toEqual({ data: { id: "receipt-123" }, error: null });
    expect(request).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        body: JSON.stringify({
          from: message.from,
          html: message.html,
          reply_to: message.replyTo,
          subject: message.subject,
          text: message.text,
          to: message.to,
        }),
        headers: {
          Authorization: "Bearer test-only",
          "Content-Type": "application/json",
          "Idempotency-Key": "stable-key",
        },
        method: "POST",
        signal,
      })
    );
  });
  test.each(["concurrent_idempotent_requests", "invalid_idempotent_request"])(
    "preserves the provider's 409 category %s",
    async (name) => {
      spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json({ message: "Private provider details", name }, { status: 409 })
      );
      expect(
        await sendNotificationEmailWithResend("test-only", message, {
          idempotencyKey: "stable-key",
        })
      ).toEqual({ error: { name, statusCode: 409 } });
    }
  );
  test.each([null, {}, { id: "" }])(
    "does not call an empty 2xx response accepted",
    async (payload) => {
      spyOn(globalThis, "fetch").mockResolvedValue(Response.json(payload));
      expect(
        await sendNotificationEmailWithResend("test-only", message, {
          idempotencyKey: "stable-key",
        })
      ).toEqual({ error: { name: "invalid_provider_response", statusCode: 502 } });
    }
  );
});
