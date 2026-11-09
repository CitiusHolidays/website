import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

/**
 * The pending booking is written only by the create-order route, with the payment mutation
 * secret, once per Razorpay order and only for the amount that order was created for.
 */

const SECRET = "payment-secret-for-tests";
const OWNER = "checkout-owner-identity";

function harness() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  rateLimiterTest.register(t, "rateLimiter");
  return t;
}

type Harness = ReturnType<typeof harness>;

async function seedTrip(t: Harness) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("trips", {
      availableSeats: 10,
      createdAt: now,
      endDate: "2027-01-18",
      isActive: true,
      name: "Kailash Mansarovar Yatra",
      priceInr: 6_250_000,
      priceUsd: 75_000,
      slug: "kailash-checkout",
      startDate: "2027-01-10",
      totalSeats: 10,
      updatedAt: now,
    });
  });
}

function pendingArgs(tripIdentifier: string, overrides: Record<string, number | string> = {}) {
  return {
    amount: 12_500_000,
    currency: "INR",
    razorpayOrderId: "order_1",
    serverSecret: SECRET,
    travelers: 2,
    tripIdentifier,
    ...overrides,
  };
}

async function bookings(t: Harness) {
  return await t.run((ctx) => ctx.db.query("bookings").collect());
}

beforeEach(() => {
  vi.stubEnv("PAYMENT_MUTATION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createPendingBooking", () => {
  test("records one pending booking for the order amount", async () => {
    const t = harness();
    const tripId = await seedTrip(t);
    const owner = t.withIdentity({ subject: OWNER, tokenIdentifier: OWNER });

    const result = await owner.mutation(api.bookings.createPendingBooking, pendingArgs(tripId));

    expect(result).toMatchObject({ booking: { status: "pending" }, totalAmount: 12_500_000 });
    expect(await bookings(t)).toEqual([
      expect.objectContaining({
        currency: "INR",
        razorpayOrderId: "order_1",
        status: "pending",
        totalAmount: 12_500_000,
        userId: OWNER,
      }),
    ]);
  });

  test("is not callable by a signed-in browser without the server secret", async () => {
    const t = harness();
    const tripId = await seedTrip(t);
    const owner = t.withIdentity({ subject: OWNER, tokenIdentifier: OWNER });

    for (const serverSecret of ["", "guessed-secret"]) {
      await expect(
        owner.mutation(api.bookings.createPendingBooking, pendingArgs(tripId, { serverSecret }))
      ).rejects.toThrow("Invalid payment mutation secret");
    }
    expect(await bookings(t)).toEqual([]);
  });

  test("refuses a second booking for the same Razorpay order, from anyone", async () => {
    const t = harness();
    const tripId = await seedTrip(t);
    const owner = t.withIdentity({ subject: OWNER, tokenIdentifier: OWNER });
    const other = t.withIdentity({ subject: "other-identity", tokenIdentifier: "other-identity" });
    await owner.mutation(api.bookings.createPendingBooking, pendingArgs(tripId));

    await expect(
      owner.mutation(api.bookings.createPendingBooking, pendingArgs(tripId))
    ).rejects.toThrow("Payment order already has a booking");
    await expect(
      other.mutation(api.bookings.createPendingBooking, pendingArgs(tripId, { travelers: 1 }))
    ).rejects.toThrow("Payment order already has a booking");
    expect(await bookings(t)).toHaveLength(1);
  });

  test("refuses a booking whose price no longer matches the order amount", async () => {
    const t = harness();
    const tripId = await seedTrip(t);
    const owner = t.withIdentity({ subject: OWNER, tokenIdentifier: OWNER });

    await expect(
      owner.mutation(api.bookings.createPendingBooking, pendingArgs(tripId, { amount: 100 }))
    ).rejects.toThrow("Checkout amount changed");
    expect(await bookings(t)).toEqual([]);
  });
});
