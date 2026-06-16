import { describe, expect, test } from "bun:test";
import {
  getPaymentMutationSecret,
  validateVerifyPaymentPayload,
  verifyPaymentRequest,
} from "./paymentVerification";

describe("validateVerifyPaymentPayload", () => {
  test("returns 400 when Razorpay fields are missing", () => {
    const result = validateVerifyPaymentPayload({ razorpay_order_id: "order_1" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });
});

describe("verifyPaymentRequest", () => {
  test("returns 400 for invalid Razorpay signature before confirming", async () => {
    const result = await verifyPaymentRequest({
      body: {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "bad_sig",
      },
      verifySignature: () => false,
      confirmBooking: async () => {
        throw new Error("confirmBooking should not be called");
      },
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  test("returns 500 when PAYMENT_MUTATION_SECRET is missing", async () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    delete process.env.PAYMENT_MUTATION_SECRET;
    try {
      const result = await verifyPaymentRequest({
        body: {
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "good_sig",
        },
        verifySignature: () => true,
        confirmBooking: async () => {
          throw new Error("confirmBooking should not be called");
        },
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(getPaymentMutationSecret()).toBeNull();
    } finally {
      if (previous === undefined) {
        delete process.env.PAYMENT_MUTATION_SECRET;
      } else {
        process.env.PAYMENT_MUTATION_SECRET = previous;
      }
    }
  });
});
