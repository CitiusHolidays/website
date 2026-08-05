import { describe, expect, test } from "bun:test";
import { mapRazorpayWebhookProcessingError, processRazorpayWebhookEvent } from "./razorpayWebhook";

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

  test("skips payment mutations when the server secret is missing", async () => {
    let called = false;

    const result = await processRazorpayWebhookEvent(
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
    );

    expect(result).toEqual({ action: "payment.failed.skipped-missing-secret", received: true });
    expect(called).toBe(false);
  });

  test("acknowledges unhandled events without calling payment mutations", async () => {
    let called = false;

    const result = await processRazorpayWebhookEvent(
      { event: "subscription.charged", payload: {} },
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
    );

    expect(result).toEqual({ action: "unhandled", received: true });
    expect(called).toBe(false);
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
});
