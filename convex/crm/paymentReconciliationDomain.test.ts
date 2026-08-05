import { describe, expect, test } from "bun:test";
import { canAccessPaymentReconciliation } from "./paymentReconciliation";
import {
  classifyPaymentMismatch,
  expectedStatusForEvent,
  fixtureModeAllowed,
  paymentReconciliationFixtures,
} from "./paymentReconciliationDomain";

const booking = {
  createdAt: Date.now(),
  currency: "INR",
  status: "pending" as const,
  totalAmount: 1000,
};

describe("payment reconciliation domain", () => {
  test("maps provider events to the existing booking transition statuses", () => {
    expect(expectedStatusForEvent("payment.authorized")).toBe("pending");
    expect(expectedStatusForEvent("payment.captured")).toBe("confirmed");
    expect(expectedStatusForEvent("payment.failed")).toBe("failed");
    expect(expectedStatusForEvent("refund.created")).toBe("refunded");
    expect(expectedStatusForEvent("future.event")).toBeUndefined();
  });

  test("explains mismatches without inventing a second payment status", () => {
    expect(
      classifyPaymentMismatch({
        booking,
        eventType: "payment.captured",
        outcome: "processed",
        statusAfter: "confirmed",
      })
    ).toBe("none");
    expect(
      classifyPaymentMismatch({
        amount: 999,
        booking,
        currency: "INR",
        eventType: "payment.captured",
        outcome: "processed",
        statusAfter: "confirmed",
      })
    ).toBe("amount_currency_mismatch");
    expect(
      classifyPaymentMismatch({
        booking: { ...booking, status: "confirmed" },
        eventType: "payment.failed",
        outcome: "ignored",
        statusAfter: "confirmed",
      })
    ).toBe("status_mismatch");
    expect(
      classifyPaymentMismatch({
        eventType: "payment.captured",
        outcome: "unmatched",
      })
    ).toBe("unmatched_provider_event");
  });

  test("fixtures are deterministic, labelled, and never production rows", () => {
    const first = paymentReconciliationFixtures();
    const second = paymentReconciliationFixtures();
    expect(first).toEqual(second);
    expect(first).toHaveLength(7);
    expect(first.every((row) => row.isFixture && row.source === "fixture")).toBe(true);
    expect(first.map((row) => row.mismatchCategory)).toEqual(
      expect.arrayContaining([
        "unmatched_provider_event",
        "amount_currency_mismatch",
        "processing_failure",
        "stale_pending_state",
      ])
    );
  });

  test("only finance and director oversight roles can access reconciliation", () => {
    expect(canAccessPaymentReconciliation({ roles: ["Accounts"] })).toBe(true);
    expect(canAccessPaymentReconciliation({ roles: ["Accounts Head"] })).toBe(true);
    expect(canAccessPaymentReconciliation({ roles: ["Admin"] })).toBe(true);
    expect(canAccessPaymentReconciliation({ roles: ["Directors"] })).toBe(true);
    expect(canAccessPaymentReconciliation({ roles: ["Director Cement"] })).toBe(true);
    expect(canAccessPaymentReconciliation({ roles: ["Finance"] })).toBe(false);
    expect(canAccessPaymentReconciliation({ roles: ["Operations Head"] })).toBe(false);
  });

  test("fixture mode requires an explicit non-production opt-in", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousFixtureFlag = process.env.PAYMENT_RECONCILIATION_FIXTURES;
    try {
      process.env.NODE_ENV = "production";
      process.env.PAYMENT_RECONCILIATION_FIXTURES = "true";
      expect(fixtureModeAllowed()).toBe(false);
      process.env.NODE_ENV = "development";
      expect(fixtureModeAllowed()).toBe(true);
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousFixtureFlag === undefined) {
        delete process.env.PAYMENT_RECONCILIATION_FIXTURES;
      } else {
        process.env.PAYMENT_RECONCILIATION_FIXTURES = previousFixtureFlag;
      }
    }
  });
});
