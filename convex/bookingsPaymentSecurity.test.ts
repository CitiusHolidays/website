import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import {
  assertPaymentMutationSecret,
  assertPaymentMutationSourceAllowed,
} from "./lib/paymentMutationAuth";

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

describe("payment fixture source", () => {
  test("rejects fixture events in production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(() => assertPaymentMutationSourceAllowed("fixture", true)).toThrow(ConvexError);
    } finally {
      if (previous === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previous;
      }
    }
  });

  test("allows fixture events outside production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      expect(() => assertPaymentMutationSourceAllowed("fixture", true)).not.toThrow();
    } finally {
      if (previous === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previous;
      }
    }
  });
});
