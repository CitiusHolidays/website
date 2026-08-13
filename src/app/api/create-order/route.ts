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

const AVAILABLE_SEATS_ERROR_PATTERN = /^Only \d+ seats available$/;

interface CreateOrderBody {
  currency?: unknown;
  notes?: unknown;
  travelerDetails?: unknown;
  travelers?: unknown;
  tripId?: unknown;
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
  createPendingBooking: (args: Record<string, unknown>) => Promise<unknown>;
  createProviderOrder: (args: ProviderCreateOrderArgs) => Promise<unknown>;
  ensureProfile: () => Promise<unknown>;
  establishIdentity: () => Promise<unknown>;
  prepareCheckout: (args: Record<string, unknown>) => Promise<unknown>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function structuredFailureData(error: unknown) {
  return isRecord(error) ? error.data : undefined;
}

function assertNever(_value: never): never {
  throw new Error("Unhandled create-order failure");
}

function dependencyFailure(error: unknown, fallback: CreateOrderFailureTag) {
  if (error instanceof CreateOrderDomainError) {
    return error;
  }
  const data = structuredFailureData(error);
  if (data === "UNAUTHORIZED") {
    return new CreateOrderDomainError("unauthorized", error);
  }
  if (data === "Trip not found or inactive") {
    return new CreateOrderDomainError("trip_not_found", error);
  }
  if (typeof data === "string" && AVAILABLE_SEATS_ERROR_PATTERN.test(data)) {
    return new CreateOrderDomainError("availability_conflict", error);
  }
  return new CreateOrderDomainError(fallback, error);
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
    createProviderOrder: (args) => createOrder(args),
    ensureProfile: () => fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {}),
    establishIdentity: () => fetchAuthMutation(anyApi.userProfiles.establishMyIdentity, {}),
    prepareCheckout: (args) => fetchAuthQuery(anyApi.bookings.prepareCheckout, args),
    providerKeyId: razorpayKeyId,
  };
}

function normalizeTravelers(value: unknown) {
  return typeof value === "number" ? value : 1;
}

export function mapCreateOrderError(error: unknown) {
  const failure = dependencyFailure(error, "unexpected");
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

function parsePreparedCheckout(value: unknown): PreparedCheckout {
  if (!(isRecord(value) && isRecord(value.trip) && isRecord(value.user))) {
    throw new CreateOrderDomainError("checkout_unavailable");
  }
  const { totalAmount, trip, user } = value;
  if (
    typeof totalAmount !== "number" ||
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0 ||
    typeof trip.id !== "string" ||
    !trip.id ||
    typeof trip.name !== "string" ||
    !trip.name ||
    typeof user.id !== "string" ||
    !user.id ||
    typeof user.email !== "string" ||
    typeof user.name !== "string" ||
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
      phoneNumber: typeof user.phoneNumber === "string" ? user.phoneNumber : null,
    },
  };
}

export function parseRazorpayOrder(
  value: unknown,
  expected: { amount: number; currency: string; receipt: string }
): RazorpayOrder {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id ||
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

function parsePendingBooking(value: unknown): PendingBookingResult {
  if (
    !(isRecord(value) && isRecord(value.booking)) ||
    typeof value.booking.id !== "string" ||
    !value.booking.id ||
    typeof value.booking.status !== "string" ||
    !value.booking.status
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

    if (typeof tripId !== "string" || !tripId) {
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
    if (typeof deps.providerKeyId !== "string" || !deps.providerKeyId.trim()) {
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
          notes: typeof notes === "string" ? notes : "",
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

export function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
