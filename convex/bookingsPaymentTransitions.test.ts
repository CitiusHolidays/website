import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  confirmBookingByOrderIdHandler,
  markPaymentFailedByOrderId,
  markPaymentFailedByOrderIdHandler,
} from "./bookings";

interface Row {
  _id: string;
  [key: string]: unknown;
}
type Tables = Record<string, Row[]>;

function makeBookingsCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  ) as Tables;

  const ctx = {
    db: {
      get: (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return Promise.resolve(row);
          }
        }
        return Promise.resolve(null);
      },
      insert: (tableName: string, value: Record<string, unknown>) => {
        const rows = tables[tableName] ?? [];
        tables[tableName] = rows;
        const id = `${tableName}_${rows.length + 1}`;
        rows.push({ _id: id, ...value });
        return Promise.resolve(id);
      },
      patch: (id: string, patch: Record<string, unknown>) => {
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
          withIndex(_indexName: string, callback: (q: unknown) => unknown) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const q = {
              eq(field: string, value: unknown) {
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
    orderId,
    paymentId,
    providerEventId: `razorpay:${event}:${paymentId}`,
    reason: `${event} test event`,
  };
}

function baseBooking(overrides: Record<string, unknown> = {}) {
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

function baseTrip(overrides: Record<string, unknown> = {}) {
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

describe("markPaymentFailedByOrderId transitions", () => {
  test("ignores failure for confirmed bookings", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking({ razorpayPaymentId: "pay_ok", status: "confirmed" })],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(
      ctx as never,
      paymentEventArgs("pay_fail", "payment.failed")
    );

    expect(result).toEqual({
      id: bookingId,
      ignored: true,
      status: "confirmed",
    });
    expect(tables.bookings[0]?.status).toBe("confirmed");
  });

  test("ignores failure for refunded bookings", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking({ razorpayPaymentId: "pay_refunded", status: "refunded" })],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(
      ctx as never,
      paymentEventArgs("pay_fail", "payment.failed")
    );

    expect(result).toEqual({
      id: bookingId,
      ignored: true,
      status: "refunded",
    });
    expect(tables.bookings[0]?.status).toBe("refunded");
  });

  test("marks pending bookings as failed", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking()],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(
      ctx as never,
      paymentEventArgs("pay_fail", "payment.failed")
    );

    expect(result).toEqual({ id: bookingId, status: "failed" });
    expect(tables.bookings[0]?.status).toBe("failed");
    expect(tables.bookings[0]?.razorpayPaymentId).toBe("pay_fail");
  });

  test("records one auditable provider event and replays it without changing booking state", async () => {
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

    const first = await markPaymentFailedByOrderIdHandler(ctx as never, args);
    const updatedAt = tables.bookings[0]?.updatedAt;
    const replay = await markPaymentFailedByOrderIdHandler(ctx as never, args);

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

  test("a new failure retry cannot rewrite an already failed booking", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking({ status: "failed", updatedAt: 42 })],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(
      ctx as never,
      paymentEventArgs("pay_retry", "payment.failed.retry")
    );

    expect(result).toMatchObject({ ignored: true, status: "failed" });
    expect(tables.bookings[0]?.updatedAt).toBe(42);
    expect(tables.bookingPaymentEvents).toHaveLength(1);
  });
});

describe("confirmBookingByOrderId transitions", () => {
  test("returns alreadyConfirmed for duplicate capture", async () => {
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
      ctx as never,
      paymentEventArgs("pay_ok", "payment.captured")
    );

    expect(result.success).toBe(true);
    expect(result.alreadyConfirmed).toBe(true);
  });

  test("confirms a booking after a prior failure event", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking({ razorpayPaymentId: "pay_fail", status: "failed" })],
      trips: [baseTrip({ availableSeats: 8 })],
    });

    const result = await confirmBookingByOrderIdHandler(
      ctx as never,
      paymentEventArgs("pay_ok", "payment.captured")
    );

    expect(result.success).toBe(true);
    expect(result.alreadyConfirmed).toBe(false);
    expect(tables.bookings[0]?.status).toBe("confirmed");
    expect(tables.trips[0]?.availableSeats).toBe(6);
  });

  test("does not confirm or debit inventory for a refunded booking", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking({ razorpayPaymentId: "pay_refunded", status: "refunded" })],
      trips: [baseTrip({ availableSeats: 6 })],
    });

    const result = await confirmBookingByOrderIdHandler(ctx as never, {
      orderId,
      paymentId: "pay_retry",
      providerEventId: "razorpay:payment.captured:pay_retry",
      reason: "late capture retry",
    });

    expect(result).toMatchObject({ ignored: true, status: "refunded" });
    expect(tables.bookings[0]?.status).toBe("refunded");
    expect(tables.trips[0]?.availableSeats).toBe(6);
  });

  test("does not confirm a recoverable failed booking when inventory has expired", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking({ razorpayPaymentId: "pay_fail", status: "failed" })],
      trips: [baseTrip({ availableSeats: 1 })],
    });

    await expect(
      confirmBookingByOrderIdHandler(ctx as never, paymentEventArgs("pay_late", "payment.captured"))
    ).rejects.toThrow("No seats available for confirmation");

    expect(tables.bookings[0]?.status).toBe("failed");
    expect(tables.trips[0]?.availableSeats).toBe(1);
    expect(tables.bookingPaymentEvents).toHaveLength(0);
  });

  test("serialized concurrent capture retries debit inventory once", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookingPaymentEvents: [],
      bookings: [baseBooking()],
      trips: [baseTrip({ availableSeats: 8 })],
    });
    const args = paymentEventArgs("pay_race", "payment.captured");
    let transactionLane = Promise.resolve<unknown>(undefined);
    const runAsConvexTransaction = () => {
      const result = transactionLane.then(() => confirmBookingByOrderIdHandler(ctx as never, args));
      transactionLane = result;
      return result;
    };

    const results = await Promise.all([runAsConvexTransaction(), runAsConvexTransaction()]);

    expect(results.filter((result) => result.alreadyConfirmed === false)).toHaveLength(1);
    expect(results.filter((result) => result.duplicateEvent === true)).toHaveLength(1);
    expect(tables.trips[0]?.availableSeats).toBe(6);
    expect(tables.bookingPaymentEvents).toHaveLength(1);
  });
});

describe("captured-then-failed ordering", () => {
  test("does not downgrade a confirmed booking on a late failure webhook", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking()],
      trips: [baseTrip({ availableSeats: 8 })],
    });

    await confirmBookingByOrderIdHandler(
      ctx as never,
      paymentEventArgs("pay_ok", "payment.captured")
    );
    expect(tables.bookings[0]?.status).toBe("confirmed");
    expect(tables.trips[0]?.availableSeats).toBe(6);

    const failureResult = await markPaymentFailedByOrderIdHandler(
      ctx as never,
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

describe("booking transition capability", () => {
  test("does not export a booking-id-only failure mutation", () => {
    const source = readFileSync(new URL("./bookings.ts", import.meta.url), "utf8");
    expect(source).not.toContain("export const markBookingFailedById = mutation");
  });

  test("the remaining payment failure mutation rejects an unauthenticated secret", async () => {
    const previous = process.env.PAYMENT_MUTATION_SECRET;
    process.env.PAYMENT_MUTATION_SECRET = "expected-secret";
    try {
      await expect(
        (markPaymentFailedByOrderId as any)._handler(
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
