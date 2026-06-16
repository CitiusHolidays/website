import { describe, expect, test } from "bun:test";
import { confirmBookingByOrderIdHandler, markPaymentFailedByOrderIdHandler } from "./bookings";

type Row = { _id: string; [key: string]: unknown };
type Tables = Record<string, Row[]>;

function makeBookingsCtx(initialTables: Tables) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]]),
  ) as Tables;

  const ctx = {
    db: {
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
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
              filters.every((filter) => row[filter.field] === filter.value),
            );
            return this;
          },
          take: async (limit: number) => rows.slice(0, limit),
        };
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
    },
  };

  return { ctx, tables };
}

const tripId = "trips_1";
const bookingId = "bookings_1";
const orderId = "order_test_1";

function baseBooking(overrides: Record<string, unknown> = {}) {
  return {
    _id: bookingId,
    userId: "user_1",
    tripId,
    status: "pending",
    razorpayOrderId: orderId,
    razorpayPaymentId: "",
    totalAmount: 1000,
    currency: "INR",
    travelers: 2,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function baseTrip(overrides: Record<string, unknown> = {}) {
  return {
    _id: tripId,
    name: "Test Trip",
    slug: "test-trip",
    startDate: "2026-07-01",
    endDate: "2026-07-10",
    totalSeats: 10,
    availableSeats: 8,
    priceInr: 500,
    priceUsd: 10,
    isActive: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("markPaymentFailedByOrderId transitions", () => {
  test("ignores failure for confirmed bookings", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking({ status: "confirmed", razorpayPaymentId: "pay_ok" })],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(ctx as never, {
      orderId,
      paymentId: "pay_fail",
    });

    expect(result).toEqual({
      id: bookingId,
      ignored: true,
      status: "confirmed",
    });
    expect(tables.bookings[0]?.status).toBe("confirmed");
  });

  test("ignores failure for refunded bookings", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking({ status: "refunded", razorpayPaymentId: "pay_refunded" })],
      trips: [baseTrip()],
    });

    const result = await markPaymentFailedByOrderIdHandler(ctx as never, {
      orderId,
      paymentId: "pay_fail",
    });

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

    const result = await markPaymentFailedByOrderIdHandler(ctx as never, {
      orderId,
      paymentId: "pay_fail",
    });

    expect(result).toEqual({ id: bookingId, status: "failed" });
    expect(tables.bookings[0]?.status).toBe("failed");
    expect(tables.bookings[0]?.razorpayPaymentId).toBe("pay_fail");
  });
});

describe("confirmBookingByOrderId transitions", () => {
  test("returns alreadyConfirmed for duplicate capture", async () => {
    const { ctx } = makeBookingsCtx({
      bookings: [
        baseBooking({
          status: "confirmed",
          razorpayPaymentId: "pay_ok",
          confirmedAt: 123,
        }),
      ],
      trips: [baseTrip({ availableSeats: 6 })],
    });

    const result = await confirmBookingByOrderIdHandler(ctx as never, {
      orderId,
      paymentId: "pay_ok",
    });

    expect(result.success).toBe(true);
    expect(result.alreadyConfirmed).toBe(true);
  });

  test("confirms a booking after a prior failure event", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking({ status: "failed", razorpayPaymentId: "pay_fail" })],
      trips: [baseTrip({ availableSeats: 8 })],
    });

    const result = await confirmBookingByOrderIdHandler(ctx as never, {
      orderId,
      paymentId: "pay_ok",
    });

    expect(result.success).toBe(true);
    expect(result.alreadyConfirmed).toBe(false);
    expect(tables.bookings[0]?.status).toBe("confirmed");
    expect(tables.trips[0]?.availableSeats).toBe(6);
  });
});

describe("captured-then-failed ordering", () => {
  test("does not downgrade a confirmed booking on a late failure webhook", async () => {
    const { ctx, tables } = makeBookingsCtx({
      bookings: [baseBooking()],
      trips: [baseTrip({ availableSeats: 8 })],
    });

    await confirmBookingByOrderIdHandler(ctx as never, {
      orderId,
      paymentId: "pay_ok",
    });
    expect(tables.bookings[0]?.status).toBe("confirmed");
    expect(tables.trips[0]?.availableSeats).toBe(6);

    const failureResult = await markPaymentFailedByOrderIdHandler(ctx as never, {
      orderId,
      paymentId: "pay_fail_alt",
    });

    expect(failureResult).toEqual({
      id: bookingId,
      ignored: true,
      status: "confirmed",
    });
    expect(tables.bookings[0]?.status).toBe("confirmed");
    expect(tables.trips[0]?.availableSeats).toBe(6);
  });
});
