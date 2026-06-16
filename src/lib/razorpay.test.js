import { beforeAll, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

let verifyPaymentSignature;
let verifyWebhookSignature;

beforeAll(async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "unit-test-secret";
  ({ verifyPaymentSignature, verifyWebhookSignature } = await import("./razorpay.js"));
});

describe("verifyPaymentSignature", () => {
  test("accepts the Razorpay HMAC and rejects mismatched values", () => {
    const orderId = "order_1";
    const paymentId = "pay_1";
    const signature = crypto
      .createHmac("sha256", "unit-test-secret")
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
    expect(verifyPaymentSignature({ orderId, paymentId, signature: `${signature}00` })).toBe(false);
    expect(verifyPaymentSignature({ orderId, paymentId, signature: "not-a-hex-signature" })).toBe(
      false,
    );
  });
});

describe("verifyWebhookSignature", () => {
  test("accepts the webhook HMAC and rejects mismatched values", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: { id: "pay_1" } });
    const webhookSecret = "webhook-unit-test-secret";
    const signature = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");

    expect(verifyWebhookSignature(body, signature, webhookSecret)).toBe(true);
    expect(verifyWebhookSignature(body, signature.slice(2), webhookSecret)).toBe(false);
  });
});
