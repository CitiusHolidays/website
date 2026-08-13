import { describe, expect, test } from "bun:test";
import {
  mapRazorpayWebhookProcessingError,
  processRazorpayWebhookEvent,
  RazorpayWebhookConfigurationError,
  RazorpayWebhookMutationError,
  RazorpayWebhookPayloadError,
} from "./razorpayWebhook";

describe("processRazorpayWebhookEvent", () => {
  test("confirms captured payments with the configured server secret", async () => {
    const calls: unknown[] = [];

    const result = await processRazorpayWebhookEvent(
      {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_1",
              order_id: "order_1",
            },
          },
        },
      },
      {
        confirmBookingByOrderId: (args) => {
          calls.push(args);
          return Promise.resolve({ booking: { id: "booking_1" }, success: true });
        },
        getServerSecret: () => "server-secret",
        markPaymentFailedByOrderId: () => Promise.resolve({ id: "booking_1" }),
        markRefundedByPaymentId: () => Promise.resolve({}),
        recordPaymentAuthorized: () => Promise.resolve({}),
      }
    );

    expect(result).toEqual({ action: "payment.captured", received: true });
    expect(calls).toEqual([
      {
        orderId: "order_1",
        paymentId: "pay_1",
        providerEventId: "razorpay:payment.captured:pay_1",
        reason: "Razorpay payment.captured webhook",
        serverSecret: "server-secret",
      },
    ]);
  });

  test("fails closed when the server secret is missing", async () => {
    let called = false;

    await expect(
      processRazorpayWebhookEvent(
        {
          event: "payment.failed",
          payload: {
            payment: {
              entity: {
                id: "pay_1",
                order_id: "order_1",
              },
            },
          },
        },
        {
          confirmBookingByOrderId: () => Promise.resolve({ success: true }),
          getServerSecret: () => null,
          markPaymentFailedByOrderId: () => {
            called = true;
            return Promise.resolve({ id: "booking_1" });
          },
          markRefundedByPaymentId: () => Promise.resolve({}),
          recordPaymentAuthorized: () => Promise.resolve({}),
        }
      )
    ).rejects.toBeInstanceOf(RazorpayWebhookConfigurationError);

    expect(called).toBe(false);
  });

  test("acknowledges unknown provider events without calling payment mutations or reading secrets", async () => {
    let called = false;
    let secretReads = 0;

    const result = await processRazorpayWebhookEvent(
      { event: "subscription.charged", payload: {} },
      {
        confirmBookingByOrderId: () => {
          called = true;
          return Promise.resolve({ success: true });
        },
        getServerSecret: () => {
          secretReads += 1;
          return null;
        },
        markPaymentFailedByOrderId: () => Promise.resolve({ id: "booking_1" }),
        markRefundedByPaymentId: () => Promise.resolve({}),
        recordPaymentAuthorized: () => Promise.resolve({}),
      }
    );

    expect(result).toEqual({ action: "ignored", event: "subscription.charged", received: true });
    expect(called).toBe(false);
    expect(secretReads).toBe(0);
  });

  test("rejects incomplete provider payloads without attempting a mutation", async () => {
    let called = false;

    await expect(
      processRazorpayWebhookEvent(
        { event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } },
        {
          confirmBookingByOrderId: () => {
            called = true;
            return Promise.resolve({ success: true });
          },
          getServerSecret: () => "server-secret",
          markPaymentFailedByOrderId: () => Promise.resolve({ id: "booking_1" }),
          markRefundedByPaymentId: () => Promise.resolve({}),
          recordPaymentAuthorized: () => Promise.resolve({}),
        }
      )
    ).rejects.toThrow("payment.captured requires payment.entity.order_id");

    expect(called).toBe(false);
  });

  test("rejects a missing event name before inspecting provider entities", async () => {
    await expect(
      processRazorpayWebhookEvent(
        { payload: {} },
        {
          confirmBookingByOrderId: () => Promise.resolve({ success: true }),
          getServerSecret: () => "server-secret",
          markPaymentFailedByOrderId: () => Promise.resolve({ id: "booking_1" }),
          markRefundedByPaymentId: () => Promise.resolve({}),
          recordPaymentAuthorized: () => Promise.resolve({}),
        }
      )
    ).rejects.toThrow("event is required");
  });

  test("rejects a null webhook body as an invalid provider payload", async () => {
    await expect(
      processRazorpayWebhookEvent(null, {
        confirmBookingByOrderId: () => Promise.resolve({ success: true }),
        getServerSecret: () => "server-secret",
        markPaymentFailedByOrderId: () => Promise.resolve({ id: "booking_1" }),
        markRefundedByPaymentId: () => Promise.resolve({}),
        recordPaymentAuthorized: () => Promise.resolve({}),
      })
    ).rejects.toThrow("event is required");
  });
});

describe("mapRazorpayWebhookProcessingError", () => {
  test("returns 400 for malformed JSON after signature verification", () => {
    const result = mapRazorpayWebhookProcessingError(new SyntaxError("Unexpected token"));

    expect(result).toEqual({
      body: { error: "Invalid webhook payload" },
      status: 400,
    });
  });

  test("returns retryable 500 for unhandled processing failures", () => {
    const result = mapRazorpayWebhookProcessingError(new Error("Convex unavailable"));

    expect(result).toEqual({
      body: { error: "Webhook processing failed" },
      status: 500,
    });
  });

  test("maps missing webhook configuration to a non-success response", () => {
    const result = mapRazorpayWebhookProcessingError(new RazorpayWebhookConfigurationError());

    expect(result).toEqual({
      body: { error: "Webhook not configured" },
      status: 500,
    });
  });

  test("maps malformed supported provider payloads to a non-success response", () => {
    const result = mapRazorpayWebhookProcessingError(
      new RazorpayWebhookPayloadError(
        "Invalid Razorpay webhook payload: payment.captured requires payment.entity.id"
      )
    );

    expect(result).toEqual({
      body: {
        error: "Invalid Razorpay webhook payload: payment.captured requires payment.entity.id",
      },
      status: 400,
    });
  });

  test("maps a structured Convex payment-secret rejection to a configuration response", async () => {
    const payload = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } },
    };
    const promise = processRazorpayWebhookEvent(payload, {
      confirmBookingByOrderId: () => Promise.reject({ data: "Invalid payment mutation secret" }),
      getServerSecret: () => "configured-but-mismatched",
      markPaymentFailedByOrderId: () => Promise.resolve({ id: "booking_1" }),
      markRefundedByPaymentId: () => Promise.resolve({}),
      recordPaymentAuthorized: () => Promise.resolve({}),
    });

    await expect(promise).rejects.toBeInstanceOf(RazorpayWebhookConfigurationError);
    let failure: unknown;
    try {
      await promise;
    } catch (error) {
      failure = error;
    }
    const result = mapRazorpayWebhookProcessingError(failure);

    expect(result).toEqual({
      body: { error: "Webhook not configured" },
      status: 500,
    });
  });

  test("keeps ordinary mutation transport failures distinct from configuration", () => {
    const result = mapRazorpayWebhookProcessingError(
      new RazorpayWebhookMutationError("confirm Razorpay booking", new Error("unavailable"))
    );

    expect(result).toEqual({
      body: { error: "Webhook processing failed" },
      status: 500,
    });
  });
});
