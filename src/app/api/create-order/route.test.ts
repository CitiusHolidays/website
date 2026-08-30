import { describe, expect, test } from "bun:test";
import type { JsonObject, JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "../../../lib/runtimeValues";
import type { CreateOrderDependencies, CreateOrderOptions } from "./route";
import { handleCreateOrder, parseRazorpayOrder } from "./route";

type DependencyOverrides = Partial<CreateOrderDependencies>;
const PROVIDER_CLAIM_PATTERN = /^[0-9a-f-]{36}$/;
const CHECKOUT_FACTS_HASH_PATTERN = /^[0-9a-f]{64}$/;

function preparedCheckout() {
  return {
    checkoutIntentId: "intent_1",
    expiresAt: 4_102_444_800_000,
    receipt: "rcpt_checkoutintent1",
    totalAmount: 25_000,
    trip: { id: "trips_1", name: "Kailash Journey" },
    user: {
      email: "traveller@example.com",
      id: "account_opaque",
      name: "A Traveller",
      phoneNumber: "+919999999999",
    },
  };
}

function request(body: JsonValue, idempotencyKey = "checkout_attempt_0001") {
  return new Request("http://localhost/api/create-order", {
    body: isRuntimeString(body) ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
    method: "POST",
  });
}

function routeOptions(overrides: DependencyOverrides = {}): CreateOrderOptions {
  const deps: CreateOrderDependencies = {
    claimCheckoutIntent: () => Promise.resolve({ state: "claimed" }),
    createPendingBooking: () =>
      Promise.resolve({
        booking: { id: "booking_1", status: "pending" },
        checkoutIntentId: "intent_1",
      }),
    createProviderOrder: (args) =>
      Promise.resolve({
        amount: args.amount,
        currency: args.currency,
        id: "order_1",
        receipt: args.receipt,
      }),
    ensureProfile: () => Promise.resolve({ id: "profile_1" }),
    establishIdentity: () => Promise.resolve({ status: "linked" }),
    getServerSecret: () => "payment-mutation-secret",
    prepareCheckout: () => Promise.resolve(preparedCheckout()),
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
  return { deps };
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
          operations.push("booking:order_1");
          expect(args).toMatchObject({
            checkoutIntentId: "intent_1",
            notes: "",
            providerOrder: {
              amount: 25_000,
              currency: "INR",
              id: "order_1",
              receipt: "rcpt_checkoutintent1",
            },
            serverSecret: "payment-mutation-secret",
            travelerDetails: null,
          });
          expect(args.providerClaimId).toMatch(PROVIDER_CLAIM_PATTERN);
          return Promise.resolve({
            booking: { id: "booking_1", status: "pending" },
            checkoutIntentId: "intent_1",
          });
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

  test("replays the same provider order and Booking after response loss", async () => {
    let consumed = false;
    let providerCalls = 0;
    let bookingCalls = 0;
    const prepareCalls: JsonObject[] = [];
    const options = routeOptions({
      claimCheckoutIntent: () =>
        Promise.resolve(
          consumed
            ? {
                booking: { id: "booking_1", status: "pending" },
                providerOrder: {
                  amount: 25_000,
                  currency: "INR",
                  id: "order_1",
                  receipt: "rcpt_checkoutintent1",
                },
                state: "consumed",
              }
            : { state: "claimed" }
        ),
      createPendingBooking: () => {
        bookingCalls += 1;
        consumed = true;
        return Promise.resolve({
          booking: { id: "booking_1", status: "pending" },
          checkoutIntentId: "intent_1",
        });
      },
      createProviderOrder: (args) => {
        providerCalls += 1;
        return Promise.resolve({
          ...args,
          id: "order_1",
        });
      },
      prepareCheckout: (args) => {
        prepareCalls.push(args);
        return Promise.resolve(preparedCheckout());
      },
    });

    const first = await handleCreateOrder(request(validBody(), "stable_checkout_key_01"), options);
    const replay = await handleCreateOrder(request(validBody(), "stable_checkout_key_01"), options);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      booking: { id: "booking_1", status: "pending" },
      order: { id: "order_1" },
    });
    expect(providerCalls).toBe(1);
    expect(bookingCalls).toBe(1);
    expect(prepareCalls).toHaveLength(2);
    expect(prepareCalls[0]).toMatchObject({
      currency: "INR",
      idempotencyKey: "stable_checkout_key_01",
      travelers: 2,
      tripIdentifier: "kailash-journey",
    });
    expect(prepareCalls[1]).toEqual(prepareCalls[0]);
    expect(prepareCalls[0]?.checkoutFactsHash).toMatch(CHECKOUT_FACTS_HASH_PATTERN);
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

  test("rechecks the payment control at the provider boundary", async () => {
    let controlChecks = 0;
    let providerCalls = 0;
    const response = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        createProviderOrder: () => {
          providerCalls += 1;
          return Promise.resolve({});
        },
        resolvePaymentControl: () => {
          controlChecks += 1;
          return Promise.resolve({
            blockedBy: [],
            enabled: controlChecks === 1,
            key: "payments.razorpay_new_order",
            reason: controlChecks === 1 ? "configured_default" : "explicit_disabled",
          });
        },
      })
    );

    expect(response.status).toBe(503);
    expect(controlChecks).toBe(2);
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

  test("Rejects missing payment mutation capability before calling the provider", async () => {
    let providerCalls = 0;
    const response = await handleCreateOrder(
      request(validBody()),
      routeOptions({
        createProviderOrder: () => {
          providerCalls += 1;
          return Promise.resolve({});
        },
        getServerSecret: () => null,
      })
    );

    expect(response.status).toBe(503);
    expect(providerCalls).toBe(0);
  });

  test("Rejects provider transport and malformed response failures before booking mutation", async () => {
    let bookingCalls = 0;
    const createPendingBooking = () => {
      bookingCalls += 1;
      return Promise.resolve({
        booking: { id: "booking_1", status: "pending" },
        checkoutIntentId: "intent_1",
      });
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
    const failures: unknown[] = [];
    const options = routeOptions({
      createPendingBooking: () =>
        Promise.reject(new Error("Convex unavailable for payment-mutation-secret")),
    });
    options.logFailure = (_message, cause) => failures.push(cause);
    const response = await handleCreateOrder(request(validBody()), options);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Checkout is temporarily unavailable. Please try again later.",
    });
    expect(JSON.stringify(failures)).not.toContain("payment-mutation-secret");
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
