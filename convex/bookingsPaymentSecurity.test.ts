import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
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

describe("payment mutation authorization", () => {
  test("confirmBookingByOrderId rejects without the expected server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret("wrong-secret")).toThrow(ConvexError);
    });
  });

  test("markPaymentFailedByOrderId rejects without the expected server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret(undefined)).toThrow(ConvexError);
    });
  });

  test("recordPaymentAuthorized rejects without the expected server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret("")).toThrow(ConvexError);
    });
  });

  test("markRefundedByPaymentId rejects without the expected server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret("not-test-secret")).toThrow(ConvexError);
    });
  });

  test("accepts the configured server secret", () => {
    withPaymentSecretEnv(() => {
      expect(() => assertPaymentMutationSecret(TEST_SECRET)).not.toThrow();
    });
  });
});
