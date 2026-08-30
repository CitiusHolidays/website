import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import {
  applyBookingPaymentTransition,
  confirmBookingByOrderIdHandler,
  markPaymentFailedByOrderId,
  markPaymentFailedByOrderIdHandler,
  markRefundedByPaymentIdHandler,
  recordPaymentAuthorizedHandler,
} from "./bookings";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import type { TestIndexQuery } from "./testSupport/runtimeContracts";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}
type Tables = Record<string, Row[]>;

function makeBookingsCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  );

  const ctx = {
    db: {
      get: (tableOrId: string, maybeId?: string) => {
        const id = maybeId ?? tableOrId;
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return Promise.resolve(row);
          }
        }
        return Promise.resolve(null);
      },
      insert: (tableName: string, value: RuntimeObject) => {
        const rows = tables[tableName] ?? [];
        tables[tableName] = rows;
        const id = `${tableName}_${rows.length + 1}`;
        rows.push({ _id: id, ...value });
        return Promise.resolve(id);
      },
      patch: (_table: string, id: string, patch: RuntimeObject) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          take: (limit: number) => Promise.resolve(rows.slice(0, limit)),
          unique: () => Promise.resolve(rows[0] ?? null),
          withIndex(_indexName: string, callback: (q: TestIndexQuery) => TestIndexQuery) {
            const filters: Array<{ field: string; value: RuntimeValue }> = [];
            const q: TestIndexQuery = {
              eq(field: string, value: RuntimeValue) {
                filters.push({ field, value });
                return q;
              },
            };
            callback(q);
            rows = rows.filter((row) =>
              filters.every((filter) => row[filter.field] === filter.value)
            );
            return this;
          },
        };
      },
    },
  };

  return { ctx, tables };
}

const tripId = "trips_1";
const bookingId = "bookings_1";
const orderId = "order_test_1";

function paymentEventArgs(paymentId: string, event: string) {
  return {
    amount: 1000,
    currency: "INR",
    eventType: event,
    orderId,
    paymentId,
    providerEventId: `razorpay:${event}:${paymentId}`,
    providerStatus: event.split(".").at(-1) ?? event,
    reason: `${event} test event`,
    source: "webhook" as const,
  };
}

function baseBooking(overrides: RuntimeObject = {}) {
  return {
    _id: bookingId,
    createdAt: 1,
    currency: "INR",
    razorpayOrderId: orderId,
    razorpayPaymentId: "",
    status: "pending",
    totalAmount: 1000,
    travelers: 2,
    tripId,
    updatedAt: 1,
    userId: "user_1",
    ...overrides,
  };
}

function baseTrip(overrides: RuntimeObject = {}) {
  return {
    _id: tripId,
    availableSeats: 8,
    createdAt: 1,
    endDate: "2026-07-10",
    isActive: true,
    name: "Test Trip",
    priceInr: 500,
    priceUsd: 10,
    slug: "test-trip",
    startDate: "2026-07-01",
    totalSeats: 10,
    updatedAt: 1,
    ...overrides,
  };
}

describe("MarkPaymentFailedByOrderId transitions", () => {
  test("Ignores failure for confirmed bookings", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking({ razorpayPaymentId: "pay_ok", status: "confirmed" })],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_fail", "payment.failed")
    );

    expect(result).toEqual({
      id: bookingId,
      ignored: true,
      status: "confirmed",
    });
    expect(tables.bookings[0]?.status).toBe("confirmed");
  });

  test("Ignores failure for refunded bookings", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking({ razorpayPaymentId: "pay_refunded", status: "refunded" })],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_fail", "payment.failed")
    );

    expect(result).toEqual({
      id: bookingId,
      ignored: true,
      status: "refunded",
    });
    expect(tables.bookings[0]?.status).toBe("refunded");
  });

  test("Marks pending bookings as failed", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking()],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_fail", "payment.failed")
    );

    expect(result).toEqual({ id: bookingId, status: "failed" });
    expect(tables.bookings[0]?.status).toBe("failed");
    expect(tables.bookings[0]?.razorpayPaymentId).toBe("pay_fail");
  });

  test("Records one auditable provider event and replays it without changing booking state", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking()],
      trips: [baseTrip()],
    });
    const args = {
      orderId,
      paymentId: "pay_fail",
      providerEventId: "razorpay:payment.failed:pay_fail",
      reason: "payment.failed webhook",
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const first = await markPaymentFailedByOrderIdHandler(fromAny<never, unknown>(ctx), args);
    const updatedAt = tables.bookings[0]?.updatedAt;
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const replay = await markPaymentFailedByOrderIdHandler(fromAny<never, unknown>(ctx), args);

    expect(first).toMatchObject({ status: "failed" });
    expect(replay).toMatchObject({ duplicateEvent: true, status: "failed" });
    expect(tables.bookings[0]?.updatedAt).toBe(updatedAt);
    expect(tables.bookingPaymentEvents).toHaveLength(1);
    expect(tables.bookingPaymentEvents[0]).toMatchObject({
      providerEventId: args.providerEventId,
      reason: args.reason,
      transition: "failed",
    });
  });

  test("A new failure retry cannot rewrite an already failed booking", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking({ status: "failed", updatedAt: 42 })],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_retry", "payment.failed.retry")
    );

    expect(result).toMatchObject({ ignored: true, status: "failed" });
    expect(tables.bookings[0]?.updatedAt).toBe(42);
    expect(tables.bookingPaymentEvents).toHaveLength(1);
  });
});

describe("ConfirmBookingByOrderId transitions", () => {
  test("checkout authorization alone cannot confirm or debit inventory", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking()],
      trips: [baseTrip({ availableSeats: 8 })],
    });

    const authorization = await recordPaymentAuthorizedHandler(fromAny<never, unknown>(ctx), {
      ...paymentEventArgs("pay_authorized", "checkout.payment.authorized"),
      providerEventId: "checkout:payment.authorized:order_test_1:pay_authorized",
      source: "checkout",
    });

    expect(authorization).toMatchObject({ status: "pending", success: true });
    expect(tables.bookings[0]).toMatchObject({
      authorizationStatus: "authorized",
      status: "pending",
    });
    expect(tables.bookings[0]?.captureStatus).toBeUndefined();
    expect(tables.trips[0]?.availableSeats).toBe(8);

    const capture = await confirmBookingByOrderIdHandler(
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_authorized", "payment.captured")
    );
    expect(capture).toMatchObject({ status: "confirmed", success: true });
    expect(tables.trips[0]?.availableSeats).toBe(6);
  });

  test("Returns alreadyConfirmed for duplicate capture", async () => {
    const { ctx } = makeBookingsCtx({
      bookings: [
        baseBooking({
          confirmedAt: 123,
          razorpayPaymentId: "pay_ok",
          status: "confirmed",
        }),
      ],
      trips: [baseTrip({ availableSeats: 6 })],
    });

    const result = await confirmBookingByOrderIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_ok", "payment.captured")
    );

    expect(result.success).toBe(true);
    expect(result.alreadyConfirmed).toBe(true);
  });

  test("Confirms a booking after a prior failure event", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking({ razorpayPaymentId: "pay_fail", status: "failed" })],
      trips: [baseTrip({ availableSeats: 8 })],
    });

    const result = await confirmBookingByOrderIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_ok", "payment.captured")
    );

    expect(result.success).toBe(true);
    expect(result.alreadyConfirmed).toBe(false);
    expect(tables.bookings[0]?.status).toBe("confirmed");
    expect(tables.trips[0]?.availableSeats).toBe(6);
  });

  test("Does not confirm or debit inventory for a refunded booking", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking({ razorpayPaymentId: "pay_refunded", status: "refunded" })],
      trips: [baseTrip({ availableSeats: 6 })],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await confirmBookingByOrderIdHandler(fromAny<never, unknown>(ctx), {
      orderId,
      paymentId: "pay_retry",
      providerEventId: "razorpay:payment.captured:pay_retry",
      reason: "late capture retry",
    });

    expect(result).toMatchObject({ ignored: true, status: "refunded" });
    expect(tables.bookings[0]?.status).toBe("refunded");
    expect(tables.trips[0]?.availableSeats).toBe(6);
  });

  test("Records capture without resurrecting inventory when availability has expired", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking({ razorpayPaymentId: "pay_fail", status: "failed" })],
      trips: [baseTrip({ availableSeats: 1 })],
    });

    const result =
      await // SAFETY: This test controls the asserted value at the framework boundary below.
      confirmBookingByOrderIdHandler(
        fromAny<never, unknown>(ctx),
        paymentEventArgs("pay_late", "payment.captured")
      );

    expect(result).toMatchObject({ status: "failed", success: false });
    expect(tables.bookings[0]?.status).toBe("failed");
    expect(tables.bookings[0]?.captureStatus).toBe("captured");
    expect(tables.bookings[0]?.reservationStatus).toBe("unavailable");
    expect(tables.bookings[0]?.reconciliationStatus).toBe("review_required");
    expect(tables.trips[0]?.availableSeats).toBe(1);
    expect(tables.bookingPaymentEvents).toHaveLength(1);
    expect(tables.bookingPaymentEvents[0]).toMatchObject({
      outcome: "review_required",
      reconciliationReason: "inventory_unavailable_after_capture",
    });

    const authorization = await recordPaymentAuthorizedHandler(fromAny<never, unknown>(ctx), {
      ...paymentEventArgs("pay_late", "checkout.payment.authorized"),
      providerEventId: "checkout:payment.authorized:order_test_1:pay_late",
      source: "checkout",
    });
    expect(authorization).toMatchObject({ ignored: true, success: true });
    expect(tables.bookings[0]).toMatchObject({
      captureStatus: "captured",
      reconciliationStatus: "review_required",
      reservationStatus: "unavailable",
      status: "failed",
    });
  });

  test("Serialized concurrent capture retries debit inventory once", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking()],
      trips: [baseTrip({ availableSeats: 8 })],
    });
    const args = paymentEventArgs("pay_race", "payment.captured");
    let transactionLane = Promise.resolve<unknown>(undefined);
    const runAsConvexTransaction = () => {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = transactionLane.then(() =>
        confirmBookingByOrderIdHandler(fromAny<never, unknown>(ctx), args)
      );
      transactionLane = result;
      return result;
    };

    const results = await Promise.all([runAsConvexTransaction(), runAsConvexTransaction()]);

    expect(results.filter((result) => result.alreadyConfirmed === false)).toHaveLength(1);
    expect(results.filter((result) => result.duplicateEvent === true)).toHaveLength(1);
    expect(tables.trips[0]?.availableSeats).toBe(6);
    expect(tables.bookingPaymentEvents).toHaveLength(1);
  });

  test("A late capture records provider money but cannot resurrect a cancelled reservation", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [
        baseBooking({
          reservationStatus: "cancelled",
          status: "cancelled",
        }),
      ],
      trips: [baseTrip({ availableSeats: 8 })],
    });

    const result = await confirmBookingByOrderIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_late_cancelled", "payment.captured")
    );

    expect(result).toMatchObject({ ignored: true, status: "cancelled", success: false });
    expect(tables.bookings[0]).toMatchObject({
      captureStatus: "captured",
      reconciliationStatus: "review_required",
      reservationStatus: "cancelled",
      status: "cancelled",
    });
    expect(tables.trips[0]?.availableSeats).toBe(8);
    expect(tables.bookingPaymentEvents[0]).toMatchObject({
      outcome: "review_required",
      reconciliationReason: "late_capture_after_terminal_booking",
    });
  });
});

describe("Signed payment receipts and refunds", () => {
  test("Persists and deduplicates an unmatched signed provider event", async () => {
    const { ctx, tables } = makeBookingsCtx({ bookingPaymentEvents: [], bookings: [], trips: [] });
    const args = {
      ...paymentEventArgs("pay_unmatched", "payment.captured"),
      orderId: "order_missing",
      providerEventId: "razorpay:webhook:evt_unmatched",
    };

    const first = await applyBookingPaymentTransition(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      { ...args, transition: "confirmed" }
    );
    const duplicate = await applyBookingPaymentTransition(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      { ...args, transition: "confirmed" }
    );

    expect(first).toEqual({
      message: "Booking not found for this payment event",
      success: false,
    });
    expect(duplicate).toMatchObject({ duplicateEvent: true, success: false });
    expect(tables.bookingPaymentEvents).toHaveLength(1);
    expect(tables.bookingPaymentEvents[0]).toMatchObject({
      amount: 1000,
      currency: "INR",
      outcome: "unmatched",
      providerEventId: "razorpay:webhook:evt_unmatched",
      reconciliationReason: "unmatched_order",
    });
  });

  test("Rejects reuse of one signed event identity for different money facts", async () => {
    const { ctx } = makeBookingsCtx({ bookingPaymentEvents: [], bookings: [], trips: [] });
    const args = {
      ...paymentEventArgs("pay_unmatched", "payment.captured"),
      orderId: "order_missing",
      providerEventId: "razorpay:webhook:evt_reused",
    };
    await applyBookingPaymentTransition(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      { ...args, transition: "confirmed" }
    );

    await expect(
      applyBookingPaymentTransition(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        fromAny<never, unknown>(ctx),
        { ...args, amount: 999, transition: "confirmed" }
      )
    ).rejects.toThrow("Provider event identity was already used for different payment facts");
  });

  test("Processed partial refunds retain the remainder until cumulative completion", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookingRefunds: [],
      bookings: [
        baseBooking({
          authorizationStatus: "authorized",
          authorizedAmount: 1000,
          capturedAmount: 1000,
          captureStatus: "captured",
          razorpayPaymentId: "pay_refund",
          reconciliationStatus: "clear",
          refundedAmount: 0,
          refundStatus: "none",
          remainingAmount: 1000,
          reservationStatus: "reserved",
          status: "confirmed",
        }),
      ],
      trips: [baseTrip({ availableSeats: 6 })],
    });
    const refundArgs = (
      refundId: string,
      amount: number,
      refundStatus: "pending" | "processed",
      providerEventId: string
    ) => ({
      amount,
      currency: "INR",
      eventType: `refund.${refundStatus}`,
      paymentId: "pay_refund",
      providerEventId,
      providerStatus: refundStatus,
      reason: `refund ${refundStatus} test event`,
      refundId,
      refundStatus,
      source: "webhook" as const,
    });

    await markRefundedByPaymentIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      refundArgs("rfnd_partial", 400, "processed", "evt_refund_partial")
    );
    expect(tables.bookings[0]).toMatchObject({
      refundedAmount: 400,
      refundStatus: "partial",
      remainingAmount: 600,
      status: "confirmed",
    });

    await markRefundedByPaymentIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      refundArgs("rfnd_remainder", 600, "pending", "evt_refund_pending")
    );
    expect(tables.bookings[0]).toMatchObject({
      refundedAmount: 400,
      remainingAmount: 600,
      status: "confirmed",
    });

    await markRefundedByPaymentIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      refundArgs("rfnd_remainder", 600, "processed", "evt_refund_processed")
    );
    expect(tables.bookings[0]).toMatchObject({
      refundedAmount: 1000,
      refundStatus: "refunded",
      remainingAmount: 0,
      status: "refunded",
    });
    expect(tables.bookingRefunds).toHaveLength(2);
    expect(tables.trips[0]?.availableSeats).toBe(6);
  });

  test("keeps invalid signed refund evidence out of applicable totals", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookingRefunds: [],
      bookings: [
        baseBooking({
          authorizationStatus: "authorized",
          authorizedAmount: 1000,
          capturedAmount: 1000,
          captureStatus: "captured",
          razorpayPaymentId: "pay_refund",
          reconciliationStatus: "clear",
          refundedAmount: 0,
          refundStatus: "none",
          remainingAmount: 1000,
          reservationStatus: "reserved",
          status: "confirmed",
        }),
      ],
      trips: [baseTrip()],
    });

    await markRefundedByPaymentIdHandler(fromAny<never, unknown>(ctx), {
      amount: 400,
      currency: "USD",
      eventType: "refund.processed",
      paymentId: "pay_refund",
      providerEventId: "evt_refund_wrong_currency",
      reason: "signed wrong-currency evidence",
      refundId: "rfnd_wrong_currency",
      refundStatus: "processed",
      source: "webhook",
    });
    expect(tables.bookingRefunds).toHaveLength(0);
    expect(tables.bookings[0]).toMatchObject({
      reconciliationStatus: "review_required",
      refundedAmount: 0,
      remainingAmount: 1000,
    });

    await markRefundedByPaymentIdHandler(fromAny<never, unknown>(ctx), {
      amount: 600,
      currency: "INR",
      eventType: "refund.processed",
      paymentId: "pay_refund",
      providerEventId: "evt_refund_valid",
      reason: "signed applicable refund",
      refundId: "rfnd_valid",
      refundStatus: "processed",
      source: "webhook",
    });
    expect(tables.bookingRefunds).toHaveLength(1);
    expect(tables.bookings[0]).toMatchObject({
      reconciliationStatus: "review_required",
      refundedAmount: 600,
      refundStatus: "partial",
      remainingAmount: 400,
      status: "confirmed",
    });

    await markRefundedByPaymentIdHandler(fromAny<never, unknown>(ctx), {
      amount: 500,
      currency: "INR",
      eventType: "refund.processed",
      paymentId: "pay_refund",
      providerEventId: "evt_refund_identity_conflict",
      reason: "signed conflicting refund evidence",
      refundId: "rfnd_valid",
      refundStatus: "processed",
      source: "webhook",
    });
    expect(tables.bookingRefunds).toHaveLength(1);
    expect(tables.bookings[0]).toMatchObject({ refundedAmount: 600, remainingAmount: 400 });
    expect(tables.bookingPaymentEvents.at(-1)).toMatchObject({
      outcome: "review_required",
      reconciliationReason: "refund_identity_conflict",
    });
  });

  test("recomputes applicable refund evidence when capture arrives later", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookingRefunds: [],
      bookings: [
        baseBooking({
          authorizationStatus: "authorized",
          authorizedAmount: 1000,
          captureStatus: "pending",
          razorpayPaymentId: "pay_refund_first",
          reconciliationStatus: "clear",
          refundedAmount: 0,
          refundStatus: "none",
          remainingAmount: 1000,
          reservationStatus: "not_reserved",
        }),
      ],
      trips: [baseTrip({ availableSeats: 8 })],
    });

    await markRefundedByPaymentIdHandler(fromAny<never, unknown>(ctx), {
      amount: 400,
      currency: "INR",
      eventType: "refund.processed",
      paymentId: "pay_refund_first",
      providerEventId: "evt_refund_before_capture",
      reason: "refund arrived before capture",
      refundId: "rfnd_before_capture",
      refundStatus: "processed",
      source: "webhook",
    });
    const capture = await confirmBookingByOrderIdHandler(
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_refund_first", "payment.captured")
    );

    expect(capture).toMatchObject({ ignored: true, success: false });
    expect(tables.bookings[0]).toMatchObject({
      capturedAmount: 1000,
      captureStatus: "captured",
      reconciliationStatus: "review_required",
      refundedAmount: 400,
      refundStatus: "partial",
      remainingAmount: 600,
      reservationStatus: "not_reserved",
    });
    expect(tables.trips[0]?.availableSeats).toBe(8);
  });
});

describe("Captured-then-failed ordering", () => {
  test("Does not downgrade a confirmed booking on a late failure webhook", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking()],
      trips: [baseTrip({ availableSeats: 8 })],
    });

    await confirmBookingByOrderIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_ok", "payment.captured")
    );
    expect(tables.bookings[0]?.status).toBe("confirmed");
    expect(tables.trips[0]?.availableSeats).toBe(6);

    const failureResult = await markPaymentFailedByOrderIdHandler(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      paymentEventArgs("pay_fail_alt", "payment.failed")
    );

    expect(failureResult).toEqual({
      id: bookingId,
      ignored: true,
      status: "confirmed",
    });
    expect(tables.bookings[0]?.status).toBe("confirmed");
    expect(tables.trips[0]?.availableSeats).toBe(6);
  });
});

describe("Booking transition capability", () => {
  test("The remaining payment failure mutation rejects an unauthenticated secret", async () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    process.env.PAYMENT_MUTATION_SECRET = "expected-secret";
    try {
      await expect(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        fromAny<any, unknown>(markPaymentFailedByOrderId)._handler(
          {},
          {
            orderId,
            paymentId: "pay_opaque",
            providerEventId: "opaque-reuse",
            reason: "anonymous opaque id attempt",
            serverSecret: "wrong-secret",
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
});
