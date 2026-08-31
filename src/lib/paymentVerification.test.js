import { describe, expect, test } from "bun:test";
import {
  getPaymentMutationSecret,
  validateVerifyPaymentPayload,
  verifyPaymentRequest,
} from "./paymentVerification";

describe("ValidateVerifyPaymentPayload", () => {
  test("Returns 400 when Razorpay fields are missing", () => {
    const result = validateVerifyPaymentPayload({ razorpay_order_id: "order_1" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });
});

describe("VerifyPaymentRequest", () => {
  test("Returns 400 before verification when the checkout payload is incomplete", async () => {
    const result = await verifyPaymentRequest({
      body: { razorpay_order_id: "order_1" },
      recordAuthorization: () =>
        Promise.reject(new Error("recordAuthorization should not be called")),
      verifySignature: () => {
        throw new Error("verifySignature should not be called");
      },
    });

    expect(result).toEqual({
      code: "invalid_payload",
      error: "Missing payment verification parameters",
      ok: false,
      status: 400,
    });
  });

  test("Records authorization without confirming fulfillment for a valid checkout", async () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    process.env.PAYMENT_MUTATION_SECRET = "server-secret";
    const calls = [];
    try {
      const result = await verifyPaymentRequest({
        body: {
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "good_sig",
        },
        recordAuthorization: (args) => {
          calls.push(args);
          return Promise.resolve({
            id: "booking_1",
            status: "pending",
            success: true,
          });
        },
        verifySignature: () => true,
      });

      expect(result.ok).toBe(true);
      expect(calls).toEqual([
        {
          eventType: "checkout.payment.authorized",
          orderId: "order_1",
          paymentId: "pay_1",
          providerEventId: "checkout:payment.authorized:order_1:pay_1",
          reason: "Checkout signature verified",
          serverSecret: "server-secret",
          source: "checkout",
        },
      ]);
    } finally {
      if (previous === undefined) {
        delete process.env.PAYMENT_MUTATION_SECRET;
      } else {
        process.env.PAYMENT_MUTATION_SECRET = previous;
      }
    }
  });

  test("Returns 400 for invalid Razorpay signature before confirming", async () => {
    const result = await verifyPaymentRequest({
      body: {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "bad_sig",
      },
      recordAuthorization: () =>
        Promise.reject(new Error("recordAuthorization should not be called")),
      verifySignature: () => false,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  test("Returns 500 when PAYMENT_MUTATION_SECRET is missing", async () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    delete process.env.PAYMENT_MUTATION_SECRET;
    try {
      const result = await verifyPaymentRequest({
        body: {
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "good_sig",
        },
        recordAuthorization: () =>
          Promise.reject(new Error("recordAuthorization should not be called")),
        verifySignature: () => true,
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

  test("Treats a whitespace-only PAYMENT_MUTATION_SECRET as missing", () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    process.env.PAYMENT_MUTATION_SECRET = "   ";
    try {
      expect(getPaymentMutationSecret()).toBeNull();
    } finally {
      if (previous === undefined) {
        delete process.env.PAYMENT_MUTATION_SECRET;
      } else {
        process.env.PAYMENT_MUTATION_SECRET = previous;
      }
    }
  });

  test("Returns 500 when authorization recording fails after signature verification", async () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    process.env.PAYMENT_MUTATION_SECRET = "server-secret";
    try {
      const result = await verifyPaymentRequest({
        body: {
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "good_sig",
        },
        recordAuthorization: () => Promise.reject(new Error("Convex mutation unavailable")),
        verifySignature: () => true,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.code).toBe("mutation_unavailable");
      expect(result.error).toBe("Payment authorization failed. Please contact support.");
    } finally {
      if (previous === undefined) {
        delete process.env.PAYMENT_MUTATION_SECRET;
      } else {
        process.env.PAYMENT_MUTATION_SECRET = previous;
      }
    }
  });

  test("Returns 404 when no booking matches the verified order", async () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    process.env.PAYMENT_MUTATION_SECRET = "server-secret";
    try {
      const result = await verifyPaymentRequest({
        body: {
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "good_sig",
        },
        recordAuthorization: () => Promise.resolve({ success: false }),
        verifySignature: () => true,
      });

      expect(result).toEqual({
        code: "not_found",
        error: "Booking not found for this order",
        ok: false,
        status: 404,
      });
    } finally {
      if (previous === undefined) {
        delete process.env.PAYMENT_MUTATION_SECRET;
      } else {
        process.env.PAYMENT_MUTATION_SECRET = previous;
      }
    }
  });

  test("Maps a missing Razorpay verification key to configuration without confirming", async () => {
    const result = await verifyPaymentRequest({
      body: {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "good_sig",
      },
      recordAuthorization: () =>
        Promise.reject(new Error("recordAuthorization should not be called")),
      verifySignature: () => {
        throw new Error("Razorpay key secret not configured");
      },
    });

    expect(result).toEqual({
      code: "invalid_configuration",
      error: "Payment verification is not configured",
      ok: false,
      status: 500,
    });
  });
});
