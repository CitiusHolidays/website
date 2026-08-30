import { describe, expect, mock, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import {
  isVerifiedPhoneE164,
  journeyReminderLogicalKey,
  journeyReminderProviderKey,
  parseSentMessageWebhook,
  sendSentJourneyReminder,
  shouldApplyJourneyReminderStatus,
  verifySentWebhookSignature,
} from "./customerJourneyReminderDelivery";

const FORBIDDEN_MESSAGE_FIELDS =
  /sms|parameters|text|traveller|passport|payment|amount|destination/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const PROVIDER_PII_PATTERN = /15555550123|template_name|outbound_number/;
const PROVIDER_MESSAGE_ID = "8ba7b830-9dad-11d1-80b4-00c04fd430c8";
const TEMPLATE_ID = "7ba7b820-9dad-11d1-80b4-00c04fd430c8";
const OTHER_TEMPLATE_ID = "7ba7b821-9dad-11d1-80b4-00c04fd430c8";

async function signatureFor(input: {
  rawBody: string;
  secretBytes: Uint8Array;
  timestamp: string;
  webhookId: string;
}) {
  const key = await crypto.subtle.importKey(
    "raw",
    input.secretBytes,
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${input.webhookId}.${input.timestamp}.${input.rawBody}`)
    )
  );
  return `v1,${btoa(String.fromCharCode(...bytes))}`;
}

function webhookBody(event = "message.failed", status = "FAILED", channel = "whatsapp") {
  return JSON.stringify({
    event,
    field: "message",
    payload: {
      channel,
      message_id: PROVIDER_MESSAGE_ID,
      message_status: status,
      outbound_number: "+15555550123",
      template_name: "must-not-be-persisted",
      updated_at: "2026-08-30T12:00:00.000Z",
    },
    timestamp: "2026-08-30T12:00:01.000Z",
  });
}

describe("Sent journey reminder delivery boundary", () => {
  test("pins one verified recipient to one WhatsApp template request", async () => {
    const calls: Array<{ body: unknown; headers: Headers; url: string }> = [];
    const fetchImpl = mock((url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        body: JSON.parse(String(init?.body)),
        headers: new Headers(init?.headers),
        url: String(url),
      });
      return Promise.resolve(
        Response.json(
          {
            data: {
              recipients: [
                {
                  channel: "whatsapp",
                  message_id: PROVIDER_MESSAGE_ID,
                  to: "+15555550123",
                },
              ],
              status: "QUEUED",
              template_id: TEMPLATE_ID,
            },
            error: null,
            success: true,
          },
          { status: 202 }
        )
      );
    });

    const logicalKey = await journeyReminderLogicalKey({
      entitlementId: "entitlement-1",
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:1",
    });
    const idempotencyKey = await journeyReminderProviderKey(logicalKey, "whatsapp");
    const result = await sendSentJourneyReminder({
      apiKey: "test-api-key",
      channel: "whatsapp",
      fetchImpl: fromAny(fetchImpl),
      idempotencyKey,
      phoneE164: "+15555550123",
      templateId: TEMPLATE_ID,
    });

    expect(result).toEqual({ kind: "accepted", providerMessageId: PROVIDER_MESSAGE_ID });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      body: {
        channel: ["whatsapp"],
        template: { id: TEMPLATE_ID },
        to: ["+15555550123"],
      },
      headers: expect.any(Headers),
      url: "https://api.sent.dm/v3/messages",
    });
    expect(calls[0].headers.get("idempotency-key")).toBe(idempotencyKey);
    expect(JSON.stringify(calls[0].body)).not.toMatch(FORBIDDEN_MESSAGE_FIELDS);
    expect(
      await journeyReminderProviderKey(
        await journeyReminderLogicalKey({
          entitlementId: "entitlement-1",
          milestone: "arrival_pack_ready",
          sourceEventId: "arrival-pack:1",
        }),
        "whatsapp"
      )
    ).toBe(idempotencyKey);
  });

  test("treats transport and unresolved accepted responses as ambiguous", async () => {
    const transport = mock(() => Promise.reject(new Error("connection timed out")));
    const malformedAccepted = mock(() =>
      Promise.resolve(Response.json({ data: { recipients: [] } }, { status: 202 }))
    );
    const misdirectedAccepted = mock(() =>
      Promise.resolve(
        Response.json(
          {
            data: {
              recipients: [
                {
                  channel: "whatsapp",
                  message_id: PROVIDER_MESSAGE_ID,
                  to: "+15555550124",
                },
              ],
              status: "QUEUED",
              template_id: TEMPLATE_ID,
            },
            error: null,
            success: true,
          },
          { status: 202 }
        )
      )
    );
    const wrongTemplateAccepted = mock(() =>
      Promise.resolve(
        Response.json(
          {
            data: {
              recipients: [
                {
                  channel: "whatsapp",
                  message_id: PROVIDER_MESSAGE_ID,
                  to: "+15555550123",
                },
              ],
              status: "QUEUED",
              template_id: OTHER_TEMPLATE_ID,
            },
            error: null,
            success: true,
          },
          { status: 202 }
        )
      )
    );
    const unresolvedEnvelope = mock(() =>
      Promise.resolve(
        Response.json(
          {
            data: {
              recipients: [
                {
                  channel: "whatsapp",
                  message_id: PROVIDER_MESSAGE_ID,
                  to: "+15555550123",
                },
              ],
              status: "SENT",
              template_id: TEMPLATE_ID,
            },
            error: null,
            success: true,
          },
          { status: 202 }
        )
      )
    );
    const retryableStatuses = [408, 409, 429, 500];
    const retryableResponse = mock(() =>
      Promise.resolve(new Response(null, { status: retryableStatuses.shift() ?? 500 }))
    );
    const definiteRejection = mock(() => Promise.resolve(new Response(null, { status: 400 })));
    const base = {
      apiKey: "test-api-key",
      channel: "whatsapp" as const,
      idempotencyKey: "stable_key",
      phoneE164: "+15555550123",
      templateId: TEMPLATE_ID,
    };

    expect(
      await sendSentJourneyReminder({ ...base, fetchImpl: fromAny(transport), timeoutMs: 1 })
    ).toEqual({ kind: "ambiguous" });
    expect(
      await sendSentJourneyReminder({ ...base, fetchImpl: fromAny(malformedAccepted) })
    ).toEqual({ kind: "ambiguous" });
    expect(
      await sendSentJourneyReminder({ ...base, fetchImpl: fromAny(misdirectedAccepted) })
    ).toEqual({ kind: "ambiguous" });
    expect(
      await sendSentJourneyReminder({ ...base, fetchImpl: fromAny(wrongTemplateAccepted) })
    ).toEqual({ kind: "ambiguous" });
    expect(
      await sendSentJourneyReminder({ ...base, fetchImpl: fromAny(unresolvedEnvelope) })
    ).toEqual({ kind: "ambiguous" });
    const retryableResults = await Promise.all(
      [408, 409, 429, 500].map(() =>
        sendSentJourneyReminder({ ...base, fetchImpl: fromAny(retryableResponse) })
      )
    );
    expect(retryableResults.every((result) => result.kind === "ambiguous")).toBe(true);
    expect(
      await sendSentJourneyReminder({ ...base, fetchImpl: fromAny(definiteRejection) })
    ).toEqual({ kind: "rejected", providerStatus: 400 });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(malformedAccepted).toHaveBeenCalledTimes(1);
    expect(misdirectedAccepted).toHaveBeenCalledTimes(1);
    expect(wrongTemplateAccepted).toHaveBeenCalledTimes(1);
    expect(unresolvedEnvelope).toHaveBeenCalledTimes(1);
    expect(retryableResponse).toHaveBeenCalledTimes(4);
    expect(definiteRejection).toHaveBeenCalledTimes(1);
  });

  test("requires a strict normalized E.164 verification value and template UUID", async () => {
    expect(isVerifiedPhoneE164("+15555550123")).toBe(true);
    for (const value of ["15555550123", "+1 555 555 0123", "+012345678", "+123", null]) {
      expect(isVerifiedPhoneE164(value)).toBe(false);
    }
    const fetchImpl = mock(() => Promise.reject(new Error("must not call provider")));
    expect(
      await sendSentJourneyReminder({
        apiKey: "test-api-key",
        channel: "whatsapp",
        fetchImpl: fromAny(fetchImpl),
        idempotencyKey: "stable_key",
        phoneE164: "+15555550123",
        templateId: "template-name-is-not-an-id",
      })
    ).toEqual({ kind: "rejected", providerStatus: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("verifies the raw-body HMAC and rejects tampering or stale timestamps", async () => {
    const secretBytes = new TextEncoder().encode("test-webhook-secret-bytes");
    const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
    const rawBody = webhookBody();
    const timestamp = "1788091200";
    const webhookId = "550e8400-e29b-41d4-a716-446655440000";
    const signature = await signatureFor({ rawBody, secretBytes, timestamp, webhookId });
    const input = {
      nowMs: Number(timestamp) * 1000,
      rawBody,
      secret,
      signature,
      timestamp,
      webhookId,
    };

    expect(await verifySentWebhookSignature(input)).toBe(true);
    expect(await verifySentWebhookSignature({ ...input, rawBody: `${rawBody} ` })).toBe(false);
    expect(await verifySentWebhookSignature({ ...input, nowMs: input.nowMs + 301_000 })).toBe(
      false
    );
    expect(await verifySentWebhookSignature({ ...input, signature: "v1,invalid" })).toBe(false);
  });

  test("accepts only exact outbound status/channel pairs and drops provider PII", async () => {
    const parsed = await parseSentMessageWebhook(webhookBody(), "message.failed");
    expect(parsed).toEqual({
      channel: "whatsapp",
      eventAt: Date.parse("2026-08-30T12:00:00.000Z"),
      eventKey: expect.stringMatching(HASH_PATTERN),
      eventType: "message.failed",
      messageId: PROVIDER_MESSAGE_ID,
      status: "failed",
    });
    expect(JSON.stringify(parsed)).not.toMatch(PROVIDER_PII_PATTERN);
    expect(await parseSentMessageWebhook(webhookBody(), "message.delivered")).toBeNull();
    expect(
      await parseSentMessageWebhook(webhookBody("message.failed", "FILTERED"), "message.failed")
    ).toBeNull();
    expect(
      await parseSentMessageWebhook(
        webhookBody("message.failed", "FAILED", "sms"),
        "message.failed"
      )
    ).toBeNull();
  });

  test("merges provider events monotonically without reopening terminal states", () => {
    expect(
      shouldApplyJourneyReminderStatus({
        currentEventAt: 100,
        currentStatus: "accepted",
        incomingEventAt: 110,
        incomingStatus: "delivered",
      })
    ).toBe(true);
    expect(
      shouldApplyJourneyReminderStatus({
        currentEventAt: 110,
        currentStatus: "delivered",
        incomingEventAt: 105,
        incomingStatus: "sent",
      })
    ).toBe(false);
    expect(
      shouldApplyJourneyReminderStatus({
        currentEventAt: 110,
        currentStatus: "delivered",
        incomingEventAt: 120,
        incomingStatus: "read",
      })
    ).toBe(true);
    expect(
      shouldApplyJourneyReminderStatus({
        currentEventAt: 120,
        currentStatus: "failed",
        incomingEventAt: 130,
        incomingStatus: "delivered",
      })
    ).toBe(false);
  });
});
