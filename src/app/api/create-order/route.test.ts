import { describe, expect, test } from "bun:test";
import type { JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "../../../lib/runtimeValues";
import type { CreateOrderDependencies, CreateOrderOptions } from "./route";
import { handleCreateOrder, parseRazorpayOrder } from "./route";

type DependencyOverrides = Partial<CreateOrderDependencies>;

function request(body: JsonValue) {
  return new Request("http://localhost/api/create-order", {
    body: isRuntimeString(body) ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

function routeOptions(overrides: DependencyOverrides = {}): CreateOrderOptions {
  const deps: CreateOrderDependencies = {
    createPendingBooking: () =>
      Promise.resolve({ booking: { id: "booking_1", status: "pending" } }),
    createProviderOrder: (args) =>
      Promise.resolve({
        amount: args.amount,
        currency: args.currency,
        id: "order_1",
        receipt: args.receipt,
      }),
    ensureProfile: () => Promise.resolve({ id: "profile_1" }),
    establishIdentity: () => Promise.resolve({ status: "linked" }),
    prepareCheckout: () =>
      Promise.resolve({
        totalAmount: 25_000,
        trip: { id: "trips_1", name: "Kailash Journey" },
        user: {
          email: "traveller@example.com",
          id: "account_opaque",
          name: "A Traveller",
          phoneNumber: "+919999999999",
        },
      }),
    providerKeyId: "rzp_test_public_key",
    resolvePaymentControl: () =>
      Promise.resolve({
        blockedBy: [],
        enabled: true,
        key: "payments.razorpay_new_order",
        reason: "standard",
      }),
    ...overrides,
  };
  return { deps, logFailure: () => undefined };
}

function validBody() {
  return { currency: "INR", travelers: 2, tripId: "kailash-journey" };
}

describe("Create-order route boundary", () => {
  test("Creates one validated provider order before the pending booking", async () => {
    const operations: string[] = [];
    const response = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        createPendingBooking: (args) => {
          operations.push(`booking:${String(args.razorpayOrderId)}`);
          return Promise.resolve({ booking: { id: "booking_1", status: "pending" } });
        },
        createProviderOrder: (args) => {
          operations.push("provider");
          return Promise.resolve({
            amount: args.amount,
            currency: args.currency,
            id: "order_1",
            receipt: args.receipt,
          });
        },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      booking: { id: "booking_1", status: "pending" },
      order: { amount: 25_000, currency: "INR", id: "order_1" },
      razorpay: { key: "rzp_test_public_key", orderId: "order_1" },
      success: true,
    });
    expect(operations).toEqual(["provider", "booking:order_1"]);
  });

  test("Rejects malformed JSON and invalid traveler counts before dependencies", async () => {
    let calls = 0;
    const options = routeOptions({
      establishIdentity: () => {
        calls += 1;
        return Promise.resolve({ status: "linked" });
      },
    });
    const malformed = await handleCreateOrder(request("{"), options);
    const invalidCount = await handleCreateOrder(
      request({ ...validBody(), travelers: 1.5 }),
      options
    );

    expect(malformed.status).toBe(400);
    expect(invalidCount.status).toBe(400);
    expect(calls).toBe(0);
  });

  test("blocks new checkout before identity or provider work when payments are paused", async () => {
    let identityCalls = 0;
    let providerCalls = 0;
    const response = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        createProviderOrder: () => {
          providerCalls += 1;
          return Promise.resolve({});
        },
        establishIdentity: () => {
          identityCalls += 1;
          return Promise.resolve({ status: "linked" });
        },
        resolvePaymentControl: () =>
          Promise.resolve({
            blockedBy: [],
            enabled: false,
            key: "payments.razorpay_new_order",
            reason: "operator_disabled",
          }),
      })
    );

    expect(response.status).toBe(503);
    expect(identityCalls).toBe(0);
    expect(providerCalls).toBe(0);
  });

  test("Maps structured authentication and trip failures without message matching", async () => {
    const unauthorized = await handleCreateOrder(
      request(validBody()),
      routeOptions({ establishIdentity: () => Promise.reject({ data: "UNAUTHORIZED" }) })
    );
    const missingTrip = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        prepareCheckout: () => Promise.reject({ data: "Trip not found or inactive" }),
      })
    );
    const unavailableSeats = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        prepareCheckout: () => Promise.reject({ data: "Only 1 seats available" }),
      })
    );

    expect(unauthorized.status).toBe(401);
    expect(missingTrip.status).toBe(404);
    expect(unavailableSeats.status).toBe(400);
  });

  test("Keeps an identity conflict distinct from transport failures", async () => {
    const response = await handleCreateOrder(
      request(validBody()),
      routeOptions({ establishIdentity: () => Promise.resolve({ status: "conflict" }) })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Your account identity requires support review before checkout.",
    });
  });

  test("Rejects missing provider configuration without calling the provider", async () => {
    let providerCalls = 0;
    const response = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        createProviderOrder: () => {
          providerCalls += 1;
          return Promise.resolve({});
        },
        providerKeyId: "",
      })
    );

    expect(response.status).toBe(503);
    expect(providerCalls).toBe(0);
  });

  test("Rejects provider transport and malformed response failures before booking mutation", async () => {
    let bookingCalls = 0;
    const createPendingBooking = () => {
      bookingCalls += 1;
      return Promise.resolve({ booking: { id: "booking_1", status: "pending" } });
    };
    const unavailable = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        createPendingBooking,
        createProviderOrder: () => Promise.reject(new Error("provider unavailable")),
      })
    );
    const malformed = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        createPendingBooking,
        createProviderOrder: () => Promise.resolve({ id: "unchecked-order" }),
      })
    );

    expect(unavailable.status).toBe(503);
    expect(malformed.status).toBe(503);
    expect(bookingCalls).toBe(0);
  });

  test("Keeps a pending-booking mutation failure separate from provider failure", async () => {
    const response = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        createPendingBooking: () => Promise.reject(new Error("Convex unavailable")),
      })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Checkout is temporarily unavailable. Please try again later.",
    });
  });

  test("Validates all provider fields instead of accepting an unchecked cast", () => {
    expect(() =>
      parseRazorpayOrder(
        { amount: 99, currency: "INR", id: "order_1", receipt: "receipt_1" },
        { amount: 100, currency: "INR", receipt: "receipt_1" }
      )
    ).toThrow("provider_unavailable");
  });
});
