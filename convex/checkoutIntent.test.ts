import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import { claimCheckoutIntent, consumeCheckoutIntent, prepareCheckoutHandler } from "./bookings";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import type { TestIndexQuery } from "./testSupport/runtimeContracts";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}

interface Tables {
  bookingCheckoutIntents: Row[];
  bookings: Row[];
  customerJourneyEntitlements: Row[];
  trips: Row[];
  [tableName: string]: Row[];
}

function makeCtx() {
  const now = 1000;
  const intentId = "bookingCheckoutIntents_intent0001";
  const tables: Tables = {
    bookingCheckoutIntents: [
      {
        _id: intentId,
        amount: 25_000,
        authUserId: "auth_user_1",
        checkoutFactsHash: "checkout_facts_hash_0001",
        createdAt: now,
        currency: "INR",
        expiresAt: now + 10_000,
        idempotencyKey: "checkout_attempt_0001",
        providerClaimId: "provider_claim_0001",
        receipt: "rcpt_intent0001",
        status: "provider_creating",
        travelers: 2,
        tripId: "trips_1",
        updatedAt: now,
      },
    ],
    bookings: [],
    customerJourneyEntitlements: [],
    trips: [
      {
        _id: "trips_1",
        availableSeats: 5,
        createdAt: now,
        endDate: "2027-01-10",
        isActive: true,
        name: "Bound checkout trip",
        priceInr: 12_500,
        priceUsd: 150,
        slug: "bound-checkout-trip",
        startDate: "2027-01-01",
        totalSeats: 5,
        updatedAt: now,
      },
    ],
  };
  const ctx = {
    auth: {
      getUserIdentity: () =>
        Promise.resolve({
          email: "traveller@example.com",
          name: "A Traveller",
          subject: "auth_user_1",
        }),
    },
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
      normalizeId: (tableName: string, value: string) =>
        tableName === "trips" && value === "trips_1" ? value : null,
      patch: (_tableName: string, id: string, value: RuntimeObject) => {
        for (const [tableName, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[tableName][index] = { ...rows[index], ...value };
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          first: () => Promise.resolve(rows[0] ?? null),
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
  return { ctx, intentId, now, tables };
}

function boundArgs(intentId: string) {
  return {
    checkoutIntentId: intentId,
    notes: "server supplied",
    providerClaimId: "provider_claim_0001",
    providerOrder: {
      amount: 25_000,
      currency: "INR",
      id: "order_1",
      receipt: "rcpt_intent0001",
    },
  };
}

describe("Server-owned checkout intent consumption", () => {
  test("replays one customer-scoped intent only for the exact checkout facts", async () => {
    const { ctx, intentId, now } = makeCtx();
    const facts = {
      checkoutFactsHash: "checkout_facts_hash_0001",
      currency: "INR",
      idempotencyKey: "checkout_attempt_0001",
      travelers: 2,
      tripIdentifier: "trips_1",
    };

    const replay = await prepareCheckoutHandler(fromAny<never, unknown>(ctx), facts, now + 1);
    expect(replay).toMatchObject({
      checkoutIntentId: intentId,
      totalAmount: 25_000,
      travelers: 2,
    });

    await expect(
      prepareCheckoutHandler(
        fromAny<never, unknown>(ctx),
        { ...facts, checkoutFactsHash: "different_checkout_facts_01" },
        now + 2
      )
    ).rejects.toThrow("Checkout idempotency key was reused for different facts");
  });

  test("transactionally gives one request ownership of provider creation", async () => {
    const { ctx, intentId, now, tables } = makeCtx();
    const [intent] = tables.bookingCheckoutIntents;
    if (!intent) {
      throw new Error("checkout intent fixture missing");
    }
    intent.status = "prepared";

    const first = await claimCheckoutIntent(
      fromAny<never, unknown>(ctx),
      fromAny<never, unknown>({
        checkoutIntentId: intentId,
        providerClaimId: "provider_claim_first",
      }),
      "auth_user_1",
      now + 1
    );
    const competing = await claimCheckoutIntent(
      fromAny<never, unknown>(ctx),
      fromAny<never, unknown>({
        checkoutIntentId: intentId,
        providerClaimId: "provider_claim_other",
      }),
      "auth_user_1",
      now + 2
    );

    expect(first).toEqual({ state: "claimed" });
    expect(competing).toEqual({ state: "in_progress" });
    expect(tables.bookingCheckoutIntents[0]).toMatchObject({
      providerClaimId: "provider_claim_first",
      status: "provider_creating",
    });
  });

  test("Creates exactly one booking from canonical intent money, trip, travelers, and owner", async () => {
    const { ctx, intentId, now, tables } = makeCtx();
    const result = await consumeCheckoutIntent(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      fromAny<never, unknown>(boundArgs(intentId)),
      "auth_user_1",
      now + 1
    );

    expect(result).toMatchObject({ checkoutIntentId: intentId, totalAmount: 25_000 });
    expect(tables.bookings).toHaveLength(1);
    expect(tables.bookings[0]).toMatchObject({
      checkoutIntentId: intentId,
      currency: "INR",
      razorpayOrderId: "order_1",
      status: "pending",
      totalAmount: 25_000,
      travelers: 2,
      tripId: "trips_1",
      userId: "auth_user_1",
    });
    expect(tables.bookingCheckoutIntents[0]).toMatchObject({
      bookingId: tables.bookings[0]?._id,
      providerOrderId: "order_1",
      status: "consumed",
    });
    expect(tables.customerJourneyEntitlements).toHaveLength(1);

    const replay = await claimCheckoutIntent(
      fromAny<never, unknown>(ctx),
      fromAny<never, unknown>({
        checkoutIntentId: intentId,
        providerClaimId: "provider_claim_replay",
      }),
      "auth_user_1",
      now + 2
    );
    expect(replay).toMatchObject({
      booking: { id: tables.bookings[0]?._id, status: "pending" },
      providerOrder: {
        amount: 25_000,
        currency: "INR",
        id: "order_1",
        receipt: "rcpt_intent0001",
      },
      state: "consumed",
    });
  });

  test("Rejects a client/provider mismatch or expired intent before any booking write", async () => {
    await Promise.all(
      [{ amount: 24_999 }, { currency: "USD" }, { receipt: "rcpt_other0001" }].map(
        async (change) => {
          const { ctx, intentId, now, tables } = makeCtx();
          await expect(
            consumeCheckoutIntent(
              // SAFETY: This test controls the asserted value at the framework boundary below.
              fromAny<never, unknown>(ctx),
              fromAny<never, unknown>({
                ...boundArgs(intentId),
                providerOrder: { ...boundArgs(intentId).providerOrder, ...change },
              }),
              "auth_user_1",
              now + 1
            )
          ).rejects.toThrow("Provider order does not match the checkout intent");
          expect(tables.bookings).toHaveLength(0);
        }
      )
    );

    const { ctx, intentId, now, tables } = makeCtx();
    await expect(
      consumeCheckoutIntent(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        fromAny<never, unknown>(ctx),
        fromAny<never, unknown>(boundArgs(intentId)),
        "auth_user_1",
        now + 10_000
      )
    ).rejects.toThrow("Checkout intent has expired");
    expect(tables.bookings).toHaveLength(0);
  });

  test("Serialized concurrent consumption and exact replay produce one booking", async () => {
    const { ctx, intentId, now, tables } = makeCtx();
    const args = fromAny<never, unknown>(boundArgs(intentId));
    let transactionLane = Promise.resolve<unknown>(undefined);
    const runAsConvexTransaction = () => {
      const result = transactionLane.then(() =>
        consumeCheckoutIntent(
          // SAFETY: This test controls the asserted value at the framework boundary below.
          fromAny<never, unknown>(ctx),
          args,
          "auth_user_1",
          now + 1
        )
      );
      transactionLane = result;
      return result;
    };

    const [first, replay] = await Promise.all([runAsConvexTransaction(), runAsConvexTransaction()]);

    expect(first.booking.id).toBe(replay.booking.id);
    expect(tables.bookings).toHaveLength(1);
    expect(tables.customerJourneyEntitlements).toHaveLength(1);

    await expect(
      consumeCheckoutIntent(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        fromAny<never, unknown>(ctx),
        fromAny<never, unknown>({
          ...boundArgs(intentId),
          providerOrder: { ...boundArgs(intentId).providerOrder, id: "order_other" },
        }),
        "auth_user_1",
        now + 2
      )
    ).rejects.toThrow("already consumed by another provider order");
  });
});
