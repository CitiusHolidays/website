import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import { ConvexError } from "convex/values";
import { createPendingBooking } from "./bookings";
import { assertPaymentMutationSecret } from "./lib/paymentMutationAuth";

const TEST_SECRET = "test-secret";

function withPaymentSecretEnv<T>(fn: () => T): T {
  const previous = process.env.PAYMENT_MUTATION_SECRET;
  process.env.PAYMENT_MUTATION_SECRET = TEST_SECRET;
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.PAYMENT_MUTATION_SECRET;
    } else {
      process.env.PAYMENT_MUTATION_SECRET = previous;
    }
  }
}

describe("Payment mutation authorization", () => {
  test("ConfirmBookingByOrderId rejects without the expected server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret("wrong-secret")).toThrow(ConvexError);
    });
  });

  test("MarkPaymentFailedByOrderId rejects without the expected server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret(undefined)).toThrow(ConvexError);
    });
  });

  test("RecordPaymentAuthorized rejects without the expected server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret("")).toThrow(ConvexError);
    });
  });

  test("MarkRefundedByPaymentId rejects without the expected server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret("not-test-secret")).toThrow(ConvexError);
    });
  });

  test("CreatePendingBooking rejects client authority without the server capability", async () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    process.env.PAYMENT_MUTATION_SECRET = TEST_SECRET;
    try {
      await expect(
        fromAny<any, unknown>(createPendingBooking)._handler(
          {},
          {
            checkoutIntentId: "bookingCheckoutIntents_1",
            providerOrder: {
              amount: 1000,
              currency: "INR",
              id: "order_1",
              receipt: "rcpt_intent0001",
            },
            serverSecret: "browser-supplied-value",
          }
        )
      ).rejects.toThrow("Invalid payment mutation secret");
    } finally {
      if (previous === undefined) {
        delete process.env.PAYMENT_MUTATION_SECRET;
      } else {
        process.env.PAYMENT_MUTATION_SECRET = previous;
      }
    }
  });

  test("Accepts the configured server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret(TEST_SECRET)).not.toThrow();
    });
  });

  test("Rejects a whitespace-only configured server secret", () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    process.env.PAYMENT_MUTATION_SECRET = "   ";
    try {
      expect(() => assertPaymentMutationSecret("   ")).toThrow("Invalid payment mutation secret");
    } finally {
      if (previous === undefined) {
        delete process.env.PAYMENT_MUTATION_SECRET;
      } else {
        process.env.PAYMENT_MUTATION_SECRET = previous;
      }
    }
  });
});
