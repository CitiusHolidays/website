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

const capturedPayment =
  (overrides = {}) =>
  () =>
    Promise.resolve({
      amount: 25_000,
      currency: "INR",
      id: "pay_1",
      order_id: "order_1",
      status: "captured",
      ...overrides,
    });

async function withPaymentSecret(run) {
  const previous = process.env.PAYMENT_MUTATION_SECRET;
  process.env.PAYMENT_MUTATION_SECRET = "server-secret";
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.PAYMENT_MUTATION_SECRET;
    } else {
      process.env.PAYMENT_MUTATION_SECRET = previous;
    }
  }
}

const signedBody = {
  razorpay_order_id: "order_1",
  razorpay_payment_id: "pay_1",
  razorpay_signature: "good_sig",
};

describe("VerifyPaymentRequest", () => {
  test("Returns 400 before verification when the checkout payload is incomplete", async () => {
    const result = await verifyPaymentRequest({
      body: { razorpay_order_id: "order_1" },
      confirmBooking: () => Promise.reject(new Error("confirmBooking should not be called")),
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

  test("Confirms a valid checkout with a stable recovery event identity", async () => {
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
        confirmBooking: (args) => {
          calls.push(args);
          return Promise.resolve({
            booking: { id: "booking_1", status: "confirmed" },
            success: true,
          });
        },
        fetchPayment: capturedPayment(),
        verifySignature: () => true,
      });

      expect(result.ok).toBe(true);
      expect(calls).toEqual([
        {
          orderId: "order_1",
          paidAmount: 25_000,
          paidCurrency: "INR",
          paymentId: "pay_1",
          providerEventId: "checkout:payment.confirmed:order_1:pay_1",
          reason: "Checkout signature verified",
          serverSecret: "server-secret",
          signature: "good_sig",
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
      confirmBooking: () => Promise.reject(new Error("confirmBooking should not be called")),
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
        confirmBooking: () => Promise.reject(new Error("confirmBooking should not be called")),
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

  test("Returns 500 when booking confirmation fails after signature verification", async () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    process.env.PAYMENT_MUTATION_SECRET = "server-secret";
    try {
      const result = await verifyPaymentRequest({
        body: {
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "good_sig",
        },
        confirmBooking: () => Promise.reject(new Error("Convex mutation unavailable")),
        fetchPayment: capturedPayment(),
        logFailure: () => undefined,
        verifySignature: () => true,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.code).toBe("mutation_unavailable");
      expect(result.error).toBe("Payment confirmation failed. Please contact support.");
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
        confirmBooking: () => Promise.resolve({ success: false }),
        fetchPayment: capturedPayment(),
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
      confirmBooking: () => Promise.reject(new Error("confirmBooking should not be called")),
      logFailure: () => undefined,
      verifySignature: () => {
        throw new Error("Razorpay key secret not configured");
      },
    });

    expect(result).toEqual({
      code: "invalid_configuration",
      error: "Payment confirmation is not configured",
      ok: false,
      status: 500,
    });
  });

  test("Confirms with what Razorpay says was paid, never with amounts the browser sends", async () => {
    const calls = [];
    const lookups = [];
    await withPaymentSecret(() =>
      verifyPaymentRequest({
        body: { ...signedBody, amount: 25_000, currency: "INR", paidAmount: 25_000 },
        confirmBooking: (args) => {
          calls.push(args);
          return Promise.resolve({ paymentMismatch: true, success: false });
        },
        fetchPayment: (paymentId) => {
          lookups.push(paymentId);
          return capturedPayment({ amount: 100 })();
        },
        verifySignature: () => true,
      })
    );

    expect(lookups).toEqual(["pay_1"]);
    expect(calls).toEqual([
      expect.objectContaining({ paidAmount: 100, paidCurrency: "INR", paymentId: "pay_1" }),
    ]);
  });

  for (const [label, payment] of [
    ["underpaid", { amount: 100 }],
    ["wrong-currency", { currency: "USD" }],
  ]) {
    test(`Reports an ${label} payment as a mismatch, not a confirmation`, async () => {
      const result = await withPaymentSecret(() =>
        verifyPaymentRequest({
          body: signedBody,
          confirmBooking: () =>
            Promise.resolve({ ignored: true, paymentMismatch: true, success: false }),
          fetchPayment: capturedPayment(payment),
          verifySignature: () => true,
        })
      );

      expect(result).toEqual({
        code: "payment_mismatch",
        error: "Your payment did not match this booking. Our team will contact you.",
        ok: false,
        status: 409,
      });
    });
  }

  test("Does not confirm a payment that Razorpay attributes to another order", async () => {
    let confirmCalls = 0;
    const result = await withPaymentSecret(() =>
      verifyPaymentRequest({
        body: signedBody,
        confirmBooking: () => {
          confirmCalls += 1;
          return Promise.resolve({ success: true });
        },
        fetchPayment: capturedPayment({ order_id: "order_other" }),
        verifySignature: () => true,
      })
    );

    expect(result).toMatchObject({ code: "invalid_payload", ok: false, status: 400 });
    expect(confirmCalls).toBe(0);
  });

  test("Does not confirm a payment Razorpay has not authorized or captured", async () => {
    let confirmCalls = 0;
    const result = await withPaymentSecret(() =>
      verifyPaymentRequest({
        body: signedBody,
        confirmBooking: () => {
          confirmCalls += 1;
          return Promise.resolve({ success: true });
        },
        fetchPayment: capturedPayment({ status: "failed" }),
        verifySignature: () => true,
      })
    );

    expect(result).toMatchObject({ code: "payment_incomplete", ok: false, status: 409 });
    expect(confirmCalls).toBe(0);
  });

  for (const [label, fetchPayment] of [
    ["unreachable", () => Promise.reject(new Error("Razorpay unavailable"))],
    ["malformed", () => Promise.resolve({ id: "pay_1", status: "captured" })],
  ]) {
    test(`Leaves confirmation to the webhook when the payment lookup is ${label}`, async () => {
      let confirmCalls = 0;
      const result = await withPaymentSecret(() =>
        verifyPaymentRequest({
          body: signedBody,
          confirmBooking: () => {
            confirmCalls += 1;
            return Promise.resolve({ success: true });
          },
          fetchPayment,
          logFailure: () => undefined,
          verifySignature: () => true,
        })
      );

      expect(result).toMatchObject({ code: "provider_unavailable", ok: false, status: 503 });
      expect(confirmCalls).toBe(0);
    });
  }
});
