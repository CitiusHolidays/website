import { afterEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import type { JsonValue } from "@/lib/jsonValue";
import type { RazorpayWebhookDeps } from "@/lib/razorpayWebhook";
import { isRuntimeString } from "../../../../lib/runtimeValues";
import { handleRazorpayWebhook } from "./route";

const WEBHOOK_SECRET = "razorpay-route-test-secret";
const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

afterEach(() => {
  if (originalWebhookSecret === undefined) {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  } else {
    process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

function signedRequest(
  payload: JsonValue,
  signatureOverride?: string,
  providerEventId = "evt_route_1"
) {
  const rawBody = isRuntimeString(payload) ? payload : JSON.stringify(payload);
  const signature =
    signatureOverride ?? createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return new Request("http://localhost/api/webhooks/razorpay", {
    body: rawBody,
    headers: {
      "content-type": "application/json",
      "x-razorpay-event-id": providerEventId,
      "x-razorpay-signature": signature,
    },
    method: "POST",
  });
}

function routeDeps(overrides: Partial<RazorpayWebhookDeps> = {}) {
  const calls: Array<{ operation: string; value: unknown }> = [];
  const deps: RazorpayWebhookDeps = {
    confirmBookingByOrderId: (args) => {
      calls.push({ operation: "confirm", value: args });
      return Promise.resolve({ booking: { id: "booking_1" }, success: true });
    },
    getServerSecret: () => "payment-mutation-secret",
    markPaymentFailedByOrderId: (args) => {
      calls.push({ operation: "fail", value: args });
      return Promise.resolve({ id: "booking_1" });
    },
    markRefundedByPaymentId: (args) => {
      calls.push({ operation: "refund", value: args });
      return Promise.resolve({});
    },
    recordPaymentAuthorized: (args) => {
      calls.push({ operation: "authorize", value: args });
      return Promise.resolve({});
    },
    ...overrides,
  };
  return { calls, deps };
}

describe("Signed Razorpay webhook route", () => {
  test("Returns an explicit successful ignored acknowledgement without any payment mutation", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const { calls, deps } = routeDeps({ getServerSecret: () => null });

    const response = await handleRazorpayWebhook(
      signedRequest({ event: "subscription.charged", payload: {} }),
      { deps }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      action: "ignored",
      event: "subscription.charged",
      received: true,
    });
    expect(calls).toEqual([]);
  });

  test("Rejects an invalid signature before dispatch", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const { calls, deps } = routeDeps();

    const response = await handleRazorpayWebhook(
      signedRequest({ event: "payment.captured", payload: {} }, "invalid-signature"),
      { deps }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid signature" });
    expect(calls).toEqual([]);
  });

  test("Rejects a signed request without the provider event identity", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const { calls, deps } = routeDeps();
    const signed = signedRequest({ event: "subscription.charged", payload: {} });
    signed.headers.delete("x-razorpay-event-id");

    const response = await handleRazorpayWebhook(signed, { deps });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing event identity" });
    expect(calls).toEqual([]);
  });

  test("Returns a client error for a signed malformed supported event", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const { calls, deps } = routeDeps();

    const response = await handleRazorpayWebhook(
      signedRequest({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_1" } } },
      }),
      { deps }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid Razorpay webhook payload: payment.captured requires payment.entity.order_id",
    });
    expect(calls).toEqual([]);
  });

  test("Keeps supported processing failures retryable", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const { deps } = routeDeps({
      confirmBookingByOrderId: () => Promise.reject(new Error("Convex unavailable")),
    });

    const response = await handleRazorpayWebhook(
      signedRequest({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              amount: 25_000,
              currency: "INR",
              id: "pay_1",
              order_id: "order_1",
              status: "captured",
            },
          },
        },
      }),
      { deps }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Webhook processing failed" });
  });

  test("Preserves idempotent supported dispatch and refund identity", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const appliedProviderEvents = new Set<string>();
    let bookingEffects = 0;
    const { calls, deps } = routeDeps({
      confirmBookingByOrderId: (args) => {
        if (!appliedProviderEvents.has(args.providerEventId)) {
          appliedProviderEvents.add(args.providerEventId);
          bookingEffects += 1;
        }
        return Promise.resolve({ alreadyConfirmed: bookingEffects === 1, success: true });
      },
    });
    const capturedPayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            amount: 25_000,
            currency: "INR",
            id: "pay_1",
            order_id: "order_1",
            status: "captured",
          },
        },
      },
    };

    const first = await handleRazorpayWebhook(signedRequest(capturedPayload), { deps });
    const duplicate = await handleRazorpayWebhook(signedRequest(capturedPayload), { deps });
    const refund = await handleRazorpayWebhook(
      signedRequest(
        {
          event: "refund.created",
          payload: {
            refund: {
              entity: {
                amount: 10_000,
                currency: "INR",
                id: "rfnd_1",
                payment_id: "pay_1",
                status: "pending",
              },
            },
          },
        },
        undefined,
        "evt_refund_1"
      ),
      { deps }
    );

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect(refund.status).toBe(200);
    expect(bookingEffects).toBe(1);
    expect(calls).toEqual([
      {
        operation: "refund",
        value: {
          amount: 10_000,
          currency: "INR",
          eventType: "refund.created",
          paymentId: "pay_1",
          providerEventId: "razorpay:webhook:evt_refund_1",
          providerStatus: "pending",
          reason: "Razorpay refund.created webhook",
          refundId: "rfnd_1",
          refundStatus: "pending",
          serverSecret: "payment-mutation-secret",
          source: "webhook",
        },
      },
    ]);
  });
});
