import { describe, expect, mock, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import { handleSentJourneyReminderWebhook } from "./http";

const NOW_SECONDS = 1_788_091_200;
const WEBHOOK_ID = "550e8400-e29b-41d4-a716-446655440000";
const MESSAGE_ID = "8ba7b830-9dad-11d1-80b4-00c04fd430c8";

async function signedRequest(
  secretBytes: Uint8Array,
  overrides: { body?: string; eventType?: string; signature?: string } = {}
) {
  const body =
    overrides.body ??
    JSON.stringify({
      event: "message.failed",
      field: "message",
      payload: {
        channel: "whatsapp",
        message_id: MESSAGE_ID,
        message_status: "FAILED",
        outbound_number: "+15555550123",
        updated_at: "2026-08-30T12:00:00.000Z",
      },
      timestamp: "2026-08-30T12:00:01.000Z",
    });
  const timestamp = String(NOW_SECONDS);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${WEBHOOK_ID}.${timestamp}.${body}`)
    )
  );
  const signature = `v1,${btoa(String.fromCharCode(...signatureBytes))}`;
  return new Request("https://example.convex.site/sent/journey-reminders/webhook", {
    body,
    headers: {
      "content-type": "application/json",
      "x-webhook-event-type": overrides.eventType ?? "message.failed",
      "x-webhook-id": WEBHOOK_ID,
      "x-webhook-signature": overrides.signature ?? signature,
      "x-webhook-timestamp": timestamp,
    },
    method: "POST",
  });
}

describe("Sent journey reminder webhook route", () => {
  test("authenticates the raw payload before applying its allowlisted event", async () => {
    const secretBytes = new TextEncoder().encode("test-webhook-secret-bytes");
    const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
    const runMutation = mock(() =>
      Promise.resolve({ fallbackQueued: true, outcome: "applied" as const })
    );
    const request = await signedRequest(secretBytes);

    const response = await handleSentJourneyReminderWebhook(
      fromAny({ runMutation }),
      request,
      secret,
      NOW_SECONDS * 1000
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({ outcome: "applied", received: true });
    expect(runMutation).toHaveBeenCalledTimes(1);
    const event = runMutation.mock.calls[0]?.[1];
    expect(event).toMatchObject({
      channel: "whatsapp",
      eventType: "message.failed",
      messageId: MESSAGE_ID,
      status: "failed",
    });
    expect(JSON.stringify(event)).not.toContain("+15555550123");
  });

  test("rejects invalid signatures and event mismatches without a mutation", async () => {
    const secretBytes = new TextEncoder().encode("test-webhook-secret-bytes");
    const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
    const runMutation = mock(() =>
      Promise.resolve({ fallbackQueued: false, outcome: "ignored" as const })
    );
    const invalidSignature = await handleSentJourneyReminderWebhook(
      fromAny({ runMutation }),
      await signedRequest(secretBytes, { signature: "v1,invalid" }),
      secret,
      NOW_SECONDS * 1000
    );
    expect(invalidSignature.status).toBe(401);

    const mismatch = await handleSentJourneyReminderWebhook(
      fromAny({ runMutation }),
      await signedRequest(secretBytes, { eventType: "message.delivered" }),
      secret,
      NOW_SECONDS * 1000
    );
    expect(mismatch.status).toBe(400);
    expect(runMutation).toHaveBeenCalledTimes(0);
  });
});
