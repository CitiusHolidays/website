import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fromAny } from "@total-typescript/shoehorn";
import { PERMISSIONS } from "./lib";
import { projectPaymentReconciliationRow } from "./paymentReconciliation";

describe("Payment reconciliation projection", () => {
  test("Projects an unmatched signed event without customer or raw-body data", () => {
    const row = projectPaymentReconciliationRow(
      fromAny<never, unknown>({
        _creationTime: 1,
        _id: "bookingPaymentEvents_1",
        amount: 25_000,
        createdAt: 1,
        currency: "INR",
        eventType: "payment.captured",
        orderId: "order_missing",
        outcome: "unmatched",
        paymentId: "pay_missing",
        providerEventId: "razorpay:webhook:evt_missing",
        providerStatus: "captured",
        reason: "Razorpay payment.captured webhook",
        reconciliationReason: "unmatched_order",
        source: "webhook",
        transition: "confirmed",
      }),
      null
    );

    expect(row).toMatchObject({
      booking: null,
      needsReview: true,
      outcome: "unmatched",
      reconciliationReason: "unmatched_order",
    });
    expect(row).not.toHaveProperty("rawBody");
    expect(row).not.toHaveProperty("signature");
    expect(row).not.toHaveProperty("userId");
  });

  test("Keeps partial-refund remainder and distinct payment states visible to Finance", () => {
    const row = projectPaymentReconciliationRow(
      fromAny<never, unknown>({
        _creationTime: 2,
        _id: "bookingPaymentEvents_2",
        amount: 400,
        bookingId: "bookings_1",
        createdAt: 2,
        currency: "INR",
        eventType: "refund.processed",
        outcome: "accepted",
        paymentId: "pay_1",
        providerEventId: "razorpay:webhook:evt_refund",
        providerStatus: "processed",
        reason: "Razorpay refund.processed webhook",
        refundId: "rfnd_1",
        source: "webhook",
        statusAfter: "confirmed",
        statusBefore: "confirmed",
        transition: "refunded",
      }),
      fromAny<never, unknown>({
        _creationTime: 1,
        _id: "bookings_1",
        authorizationStatus: "authorized",
        authorizedAmount: 1000,
        capturedAmount: 1000,
        captureStatus: "captured",
        createdAt: 1,
        currency: "INR",
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        reconciliationStatus: "clear",
        refundedAmount: 400,
        refundStatus: "partial",
        remainingAmount: 600,
        reservationStatus: "reserved",
        status: "confirmed",
        totalAmount: 1000,
        travelers: 1,
        tripId: "trips_1",
        updatedAt: 2,
        userId: "private-owner",
      })
    );

    expect(row.booking).toMatchObject({
      authorizationStatus: "authorized",
      captureStatus: "captured",
      refundedAmount: 400,
      refundStatus: "partial",
      remainingAmount: 600,
      reservationStatus: "reserved",
    });
    expect(row.booking).not.toHaveProperty("userId");
  });

  test("Both read surfaces require the canonical Finance permission", () => {
    const source = readFileSync(new URL("./paymentReconciliation.ts", import.meta.url), "utf8");
    expect(PERMISSIONS.VIEW_FINANCE).toBe("view:finance");
    expect(source.match(/requireStaff\(ctx, PERMISSIONS\.VIEW_FINANCE\)/g)).toHaveLength(2);
    expect(
      source.match(/\.paginate\(boundedPaginationOptions\(args\.paginationOpts\)\)/g)
    ).toHaveLength(2);
    expect(source).toContain("paginationResultValidator(rowValidator)");
    expect(source).not.toContain(".take(");
    expect(source).not.toContain('.withIndex("by_outcome_createdAt"');
    expect(source).not.toContain(".filter((q)");
    expect(source).toContain("row.needsReview ? [row] : []");
    expect(source).not.toContain("mutation({");
  });
});
