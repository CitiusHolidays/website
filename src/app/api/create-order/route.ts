import type { JsonObject, JsonValue } from "@/lib/jsonValue";

/**
 * API Route: Create Razorpay Order
 * POST /api/create-order
 *
 * Creates a Razorpay order for a trip booking.
 * Returns the order_id to be used with Razorpay Checkout on the frontend.
 */

import { randomUUID } from "node:crypto";
import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { fetchAuthMutation, fetchAuthQuery } from "@/lib/auth-server";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { createOrder, razorpayKeyId } from "@/lib/razorpay";
import { isRuntimeNumber, isRuntimeObject, isRuntimeString } from "../../../lib/runtimeValues";

const AVAILABLE_SEATS_ERROR_PATTERN = /^Only \d+ seats available$/;

interface CreateOrderBody {
  currency?: JsonValue;
  notes?: JsonValue;
  travelerDetails?: JsonValue;
  travelers?: JsonValue;
  tripId?: JsonValue;
}

interface PreparedCheckout {
  totalAmount: number;
  trip: {
    id: string;
    name: string;
  };
  user: {
    email: string;
    id: string;
    name: string;
    phoneNumber?: string | null;
  };
}

interface RazorpayOrder {
  amount: number;
  currency: string;
  id: string;
  receipt: string;
}

interface PendingBookingResult {
  booking: {
    id: string;
    status: string;
  };
}

export interface ProviderCreateOrderArgs {
  amount: number;
  currency: string;
  notes: Record<string, string>;
  receipt: string;
}

export interface CreateOrderDependencies {
  createPendingBooking: (args: JsonObject) => Promise<JsonValue>;
  createProviderOrder: (args: ProviderCreateOrderArgs) => Promise<JsonValue>;
  ensureProfile: () => Promise<JsonValue>;
  establishIdentity: () => Promise<JsonValue>;
  prepareCheckout: (args: JsonObject) => Promise<JsonValue>;
  providerKeyId?: string;
}

export interface CreateOrderOptions {
  deps?: Partial<CreateOrderDependencies>;
  logFailure?: (message: string, cause: unknown) => void;
}

type CreateOrderFailureTag =
  | "availability_conflict"
  | "checkout_unavailable"
  | "identity_review_required"
  | "invalid_configuration"
  | "invalid_payload"
  | "mutation_unavailable"
  | "provider_unavailable"
  | "trip_not_found"
  | "unauthorized"
  | "unexpected";

export class CreateOrderDomainError extends Error {
  readonly cause?: unknown;
  readonly tag: CreateOrderFailureTag;

  constructor(tag: CreateOrderFailureTag, cause?: unknown) {
    super(tag);
    this.name = "CreateOrderDomainError";
    this.tag = tag;
    this.cause = cause;
  }
}

function isRecord<Value>(value: Value): value is Value & JsonObject {
  return isRuntimeObject(value) && value !== null && !Array.isArray(value);
}

function structuredFailureData(cause: unknown) {
  return cause && isRuntimeObject(cause) && "data" in cause ? cause.data : undefined;
}

function assertNever(_value: never): never {
  throw new Error("Unhandled create-order failure");
}

function dependencyFailure(cause: unknown, fallback: CreateOrderFailureTag) {
  if (cause instanceof CreateOrderDomainError) {
    return cause;
  }
  const data = structuredFailureData(cause);
  if (data === "UNAUTHORIZED") {
    return new CreateOrderDomainError("unauthorized", cause);
  }
  if (data === "Trip not found or inactive") {
    return new CreateOrderDomainError("trip_not_found", cause);
  }
  if (isRuntimeString(data) && AVAILABLE_SEATS_ERROR_PATTERN.test(data)) {
    return new CreateOrderDomainError("availability_conflict", cause);
  }
  return new CreateOrderDomainError(fallback, cause);
}

async function runDependency<Result>(
  failureTag: CreateOrderFailureTag,
  operation: () => Promise<Result>
) {
  try {
    return await operation();
  } catch (error) {
    throw dependencyFailure(error, failureTag);
  }
}

function defaultDependencies(): CreateOrderDependencies {
  return {
    createPendingBooking: (args) => fetchAuthMutation(anyApi.bookings.createPendingBooking, args),
    createProviderOrder: async (args) => {
      const order = await createOrder(args);
      if (!isRecord(order)) {
        throw new CreateOrderDomainError("provider_unavailable");
      }
      return order;
    },
    ensureProfile: () => fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {}),
    establishIdentity: () => fetchAuthMutation(anyApi.userProfiles.establishMyIdentity, {}),
    prepareCheckout: (args) => fetchAuthQuery(anyApi.bookings.prepareCheckout, args),
    providerKeyId: razorpayKeyId,
  };
}

function normalizeTravelers(value: JsonValue) {
  return isRuntimeNumber(value) ? value : 1;
}

export function mapCreateOrderError(cause: unknown) {
  const failure = dependencyFailure(cause, "unexpected");
  const { tag } = failure;
  switch (tag) {
    case "invalid_payload":
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    case "unauthorized":
      return NextResponse.json({ error: "You must be logged in to continue." }, { status: 401 });
    case "identity_review_required":
      return NextResponse.json(
        { error: "Your account identity requires support review before checkout." },
        { status: 403 }
      );
    case "trip_not_found":
      return NextResponse.json(
        { error: "Trip not found or is no longer available" },
        { status: 404 }
      );
    case "availability_conflict":
      return NextResponse.json(
        { error: "The requested number of seats is no longer available" },
        { status: 400 }
      );
    case "invalid_configuration":
    case "checkout_unavailable":
    case "mutation_unavailable":
      return NextResponse.json(
        { error: "Checkout is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    case "provider_unavailable":
      return NextResponse.json(
        { error: "Payment gateway error. Please try again later." },
        { status: 503 }
      );
    case "unexpected":
      return NextResponse.json(
        { error: "Failed to create order. Please try again." },
        { status: 500 }
      );
    default:
      return assertNever(tag);
  }
}

function parsePreparedCheckout(value: JsonValue): PreparedCheckout {
  if (!(isRecord(value) && isRecord(value.trip) && isRecord(value.user))) {
    throw new CreateOrderDomainError("checkout_unavailable");
  }
  const { totalAmount, trip, user } = value;
  if (
    !(isRuntimeNumber(totalAmount) && Number.isFinite(totalAmount)) ||
    totalAmount <= 0 ||
    !isRuntimeString(trip.id) ||
    !trip.id ||
    !isRuntimeString(trip.name) ||
    !trip.name ||
    !isRuntimeString(user.id) ||
    !user.id ||
    !isRuntimeString(user.email) ||
    !isRuntimeString(user.name) ||
    !user.name
  ) {
    throw new CreateOrderDomainError("checkout_unavailable");
  }
  return {
    totalAmount,
    trip: { id: trip.id, name: trip.name },
    user: {
      email: user.email,
      id: user.id,
      name: user.name,
      phoneNumber: isRuntimeString(user.phoneNumber) ? user.phoneNumber : null,
    },
  };
}

export function parseRazorpayOrder(
  value: JsonValue,
  expected: { amount: number; currency: string; receipt: string }
): RazorpayOrder {
  if (
    !(isRecord(value) && isRuntimeString(value.id) && value.id) ||
    value.amount !== expected.amount ||
    value.currency !== expected.currency ||
    value.receipt !== expected.receipt
  ) {
    throw new CreateOrderDomainError("provider_unavailable");
  }
  return {
    amount: value.amount,
    currency: value.currency,
    id: value.id,
    receipt: value.receipt,
  };
}

function parsePendingBooking(value: JsonValue): PendingBookingResult {
  if (
    !(
      isRecord(value) &&
      isRecord(value.booking) &&
      isRuntimeString(value.booking.id) &&
      value.booking.id &&
      isRuntimeString(value.booking.status) &&
      value.booking.status
    )
  ) {
    throw new CreateOrderDomainError("mutation_unavailable");
  }
  return { booking: { id: value.booking.id, status: value.booking.status } };
}

export async function handleCreateOrder(request: Request, options: CreateOrderOptions = {}) {
  const deps = { ...defaultDependencies(), ...options.deps };
  try {
    let body: CreateOrderBody;
    try {
      const parsed = await request.json();
      if (!isRecord(parsed)) {
        throw new CreateOrderDomainError("invalid_payload");
      }
      body = parsed;
    } catch (error) {
      throw dependencyFailure(error, "invalid_payload");
    }
    const { currency = "INR", notes = "", travelerDetails = [], travelers = 1, tripId } = body;

    const normalizedCurrency = currency === "USD" ? "USD" : "INR";
    const normalizedTravelers = normalizeTravelers(travelers);

    if (!(isRuntimeString(tripId) && tripId)) {
      return NextResponse.json({ error: "Trip ID is required" }, { status: 400 });
    }

    if (
      !Number.isInteger(normalizedTravelers) ||
      normalizedTravelers < 1 ||
      normalizedTravelers > 10
    ) {
      return NextResponse.json(
        { error: "Number of travelers must be between 1 and 10" },
        { status: 400 }
      );
    }

    const identityLink = await runDependency("mutation_unavailable", deps.establishIdentity);
    if (!isRecord(identityLink) || identityLink.status !== "linked") {
      throw new CreateOrderDomainError("identity_review_required");
    }
    await runDependency("mutation_unavailable", deps.ensureProfile);
    const checkout = parsePreparedCheckout(
      await runDependency("checkout_unavailable", () =>
        deps.prepareCheckout({
          currency: normalizedCurrency,
          travelers: normalizedTravelers,
          tripIdentifier: tripId,
        })
      )
    );

    const { totalAmount } = checkout;
    const receiptId = `rcpt_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    if (!(isRuntimeString(deps.providerKeyId) && deps.providerKeyId.trim())) {
      throw new CreateOrderDomainError("invalid_configuration");
    }
    const razorpayOrder = parseRazorpayOrder(
      await runDependency("provider_unavailable", () =>
        deps.createProviderOrder({
          amount: totalAmount,
          currency: normalizedCurrency,
          notes: {
            travelers: normalizedTravelers.toString(),
            tripId: checkout.trip.id,
            tripName: checkout.trip.name,
            userEmail: checkout.user.email,
            userId: checkout.user.id,
          },
          receipt: receiptId,
        })
      ),
      { amount: totalAmount, currency: normalizedCurrency, receipt: receiptId }
    );
    const booking = parsePendingBooking(
      await runDependency("mutation_unavailable", () =>
        deps.createPendingBooking({
          currency: normalizedCurrency,
          notes: isRuntimeString(notes) ? notes : "",
          razorpayOrderId: razorpayOrder.id,
          travelerDetails:
            Array.isArray(travelerDetails) && travelerDetails.length > 0 ? travelerDetails : null,
          travelers: normalizedTravelers,
          tripIdentifier: tripId,
        })
      )
    );

    return NextResponse.json({
      booking: {
        id: booking.booking.id,
        status: booking.booking.status,
      },
      order: {
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        id: razorpayOrder.id,
        receipt: razorpayOrder.receipt,
      },
      razorpay: {
        amount: totalAmount,
        currency: normalizedCurrency,
        description: `${checkout.trip.name} - ${normalizedTravelers} traveler(s)`,
        key: deps.providerKeyId,
        name: "Spiritual Trails",
        notes: {
          bookingId: booking.booking.id,
          tripId,
        },
        orderId: razorpayOrder.id,
        prefill: {
          contact: checkout.user.phoneNumber || "",
          email: checkout.user.email,
          name: checkout.user.name,
        },
        theme: {
          color: "#8B4513",
        },
      },
      success: true,
    });
  } catch (error) {
    (options.logFailure ?? console.error)("Create order error", error);
    return mapCreateOrderError(error);
  }
}

export async function POST(request: Request) {
  return await withApiRequestLogging(request, "/api/create-order", () =>
    handleCreateOrder(request)
  );
}

export async function OPTIONS(request: Request) {
  return await withApiRequestLogging(request, "/api/create-order", () =>
    Promise.resolve(NextResponse.json({}, { status: 200 }))
  );
}
