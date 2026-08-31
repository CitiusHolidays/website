import type { JsonObject, JsonValue } from "@/lib/jsonValue";

/**
 * API Route: Create Razorpay Order
 * POST /api/create-order
 *
 * Creates a Razorpay order for a trip booking.
 * Returns the order_id to be used with Razorpay Checkout on the frontend.
 */

import { executeRazorpayNewOrderOrchestration } from "@convex/crm/lib/majorCapabilityPreparation";
import { type BookingTravelerDetail, parseBookingDetails } from "@convex/lib/bookingCheckoutInput";
import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { fetchAuthMutation } from "@/lib/auth-server";
import { readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import {
  type OperationalControlDecision,
  resolveOperationalControl,
} from "@/lib/operationalControls/runtimeService";
import { getPaymentMutationSecret } from "@/lib/paymentVerification";
import { createOrder, findOrdersByReceipt, razorpayKeyId } from "@/lib/razorpay";
import { isRuntimeNumber, isRuntimeObject, isRuntimeString } from "../../../lib/runtimeValues";

const AVAILABLE_SEATS_ERROR_PATTERN = /^Only \d+ seats available$/;
const CREATE_ORDER_MAX_BODY_BYTES = 16 * 1024;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

interface CreateOrderBody {
  currency?: JsonValue;
  notes?: JsonValue;
  travelerDetails?: JsonValue;
  travelers?: JsonValue;
  tripId?: JsonValue;
}

interface NormalizedCreateOrderBody {
  currency: string;
  idempotencyKey: string;
  notes: string;
  travelerDetails: BookingTravelerDetail[] | null;
  travelers: number;
  tripId: string;
}

interface PreparedCheckout {
  checkoutIntentId: string;
  expiresAt: number;
  intentStatus: "consumed" | "prepared" | "provider_creating";
  receipt: string;
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
  checkoutIntentId: string;
}

type CheckoutClaimResult =
  | { state: "claimed" }
  | { state: "in_progress" }
  | {
      booking: PendingBookingResult["booking"];
      providerOrder: RazorpayOrder;
      state: "consumed";
    };

export interface ProviderCreateOrderArgs {
  amount: number;
  currency: string;
  notes: Record<string, string>;
  receipt: string;
}

export interface CreateOrderDependencies {
  claimCheckoutIntent: (args: JsonObject) => Promise<JsonValue>;
  createPendingBooking: (args: JsonObject) => Promise<JsonValue>;
  createProviderOrder: (args: ProviderCreateOrderArgs) => Promise<JsonValue>;
  ensureProfile: () => Promise<JsonValue>;
  establishIdentity: () => Promise<JsonValue>;
  findProviderOrdersByReceipt: (receipt: string) => Promise<JsonValue>;
  getServerSecret: () => string | null;
  prepareCheckout: (args: JsonObject) => Promise<JsonValue>;
  providerKeyId?: string;
  resolvePaymentControl: () => Promise<OperationalControlDecision>;
}

export interface CreateOrderOptions {
  deps?: Partial<CreateOrderDependencies>;
  logFailure?: (message: string, cause: unknown) => void;
  supportReference?: string;
}

type CreateOrderFailureTag =
  | "availability_conflict"
  | "checkout_in_progress"
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

async function runSensitiveDependency<Result>(
  failureTag: CreateOrderFailureTag,
  operation: () => Promise<Result>
) {
  try {
    return await operation();
  } catch {
    // Never retain a transport error that may echo server-capability arguments.
    return throwSensitiveDependencyFailure(failureTag);
  }
}

function throwSensitiveDependencyFailure(failureTag: CreateOrderFailureTag): never {
  throw new CreateOrderDomainError(failureTag);
}

function defaultDependencies(supportReference?: string): CreateOrderDependencies {
  const authOptions = { correlationId: supportReference };
  return {
    claimCheckoutIntent: (args) =>
      fetchAuthMutation(anyApi.bookings.claimCheckoutIntentForOrder, args, authOptions),
    createPendingBooking: (args) =>
      fetchAuthMutation(anyApi.bookings.createPendingBooking, args, authOptions),
    createProviderOrder: async (args) => {
      const order = await createOrder(args);
      if (!isRecord(order)) {
        throw new CreateOrderDomainError("provider_unavailable");
      }
      return order;
    },
    ensureProfile: () => fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {}, authOptions),
    establishIdentity: () =>
      fetchAuthMutation(anyApi.userProfiles.establishMyIdentity, {}, authOptions),
    findProviderOrdersByReceipt: (receipt) => findOrdersByReceipt(receipt),
    getServerSecret: getPaymentMutationSecret,
    prepareCheckout: (args) =>
      fetchAuthMutation(anyApi.bookings.prepareCheckout, args, authOptions),
    providerKeyId: razorpayKeyId,
    resolvePaymentControl: () => resolveOperationalControl("payments.razorpay_new_order"),
  };
}

export function mapCreateOrderError(cause: unknown) {
  const failure = dependencyFailure(cause, "unexpected");
  const { tag } = failure;
  const responses = {
    availability_conflict: {
      error: "The requested number of seats is no longer available",
      status: 400,
    },
    checkout_in_progress: {
      error: "Checkout is already being prepared. Please retry.",
      status: 409,
    },
    checkout_unavailable: {
      error: "Checkout is temporarily unavailable. Please try again later.",
      status: 503,
    },
    identity_review_required: {
      error: "Your account identity requires support review before checkout.",
      status: 403,
    },
    invalid_configuration: {
      error: "Checkout is temporarily unavailable. Please try again later.",
      status: 503,
    },
    invalid_payload: { error: "Invalid checkout request", status: 400 },
    mutation_unavailable: {
      error: "Checkout is temporarily unavailable. Please try again later.",
      status: 503,
    },
    provider_unavailable: {
      error: "Payment gateway error. Please try again later.",
      status: 503,
    },
    trip_not_found: { error: "Trip not found or is no longer available", status: 404 },
    unauthorized: { error: "You must be logged in to continue.", status: 401 },
    unexpected: { error: "Failed to create order. Please try again.", status: 500 },
  } satisfies Record<CreateOrderFailureTag, { error: string; status: number }>;
  const response = responses[tag];
  return NextResponse.json({ error: response.error }, { status: response.status });
}

function parsePreparedCheckout(value: JsonValue): PreparedCheckout {
  if (!(isRecord(value) && isRecord(value.trip) && isRecord(value.user))) {
    throw new CreateOrderDomainError("checkout_unavailable");
  }
  const { checkoutIntentId, expiresAt, intentStatus, receipt, totalAmount, trip, user } = value;
  if (
    !(
      isRuntimeString(checkoutIntentId) &&
      checkoutIntentId &&
      isRuntimeNumber(expiresAt) &&
      Number.isSafeInteger(expiresAt)
    ) ||
    (intentStatus !== "consumed" &&
      intentStatus !== "prepared" &&
      intentStatus !== "provider_creating") ||
    (intentStatus === "prepared" && expiresAt <= Date.now()) ||
    !isRuntimeString(receipt) ||
    !receipt ||
    !(isRuntimeNumber(totalAmount) && Number.isSafeInteger(totalAmount)) ||
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
    checkoutIntentId,
    expiresAt,
    intentStatus,
    receipt,
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
    !(
      isRecord(value) &&
      isRuntimeString(value.id) &&
      value.id.trim().length > 0 &&
      value.id.length <= 128
    ) ||
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

function parseRazorpayOrderLookup(
  value: JsonValue,
  expected: { amount: number; currency: string; receipt: string }
): RazorpayOrder | null {
  if (!(isRecord(value) && Array.isArray(value.items))) {
    throw new CreateOrderDomainError("provider_unavailable");
  }
  const exactMatches = value.items.filter(
    (item) => isRecord(item) && item.receipt === expected.receipt
  );
  if (exactMatches.length > 1) {
    throw new CreateOrderDomainError("provider_unavailable");
  }
  const [order] = exactMatches;
  return order === undefined ? null : parseRazorpayOrder(order, expected);
}

function parsePendingBooking(
  value: JsonValue,
  expectedCheckoutIntentId: string
): PendingBookingResult {
  if (
    !(
      isRecord(value) &&
      isRecord(value.booking) &&
      isRuntimeString(value.booking.id) &&
      value.booking.id &&
      isRuntimeString(value.booking.status) &&
      value.booking.status &&
      value.checkoutIntentId === expectedCheckoutIntentId
    )
  ) {
    throw new CreateOrderDomainError("mutation_unavailable");
  }
  return {
    booking: { id: value.booking.id, status: value.booking.status },
    checkoutIntentId: expectedCheckoutIntentId,
  };
}

async function jsonHash(value: JsonObject) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseCheckoutClaim(
  value: JsonValue,
  checkout: PreparedCheckout,
  currency: string
): CheckoutClaimResult {
  if (!(isRecord(value) && isRuntimeString(value.state))) {
    throw new CreateOrderDomainError("mutation_unavailable");
  }
  if (value.state === "claimed") {
    return { state: "claimed" };
  }
  if (value.state === "in_progress") {
    return { state: "in_progress" };
  }
  if (value.state !== "consumed" || !isRecord(value.booking)) {
    throw new CreateOrderDomainError("mutation_unavailable");
  }
  const { booking } = parsePendingBooking(
    { booking: value.booking, checkoutIntentId: checkout.checkoutIntentId },
    checkout.checkoutIntentId
  );
  return {
    booking,
    providerOrder: parseRazorpayOrder(value.providerOrder, {
      amount: checkout.totalAmount,
      currency,
      receipt: checkout.receipt,
    }),
    state: "consumed",
  };
}

function successfulOrderResponse({
  booking,
  checkout,
  currency,
  providerKeyId,
  providerOrder,
  travelers,
  tripId,
}: {
  booking: PendingBookingResult["booking"];
  checkout: PreparedCheckout;
  currency: string;
  providerKeyId: string;
  providerOrder: RazorpayOrder;
  travelers: number;
  tripId: string;
}) {
  return NextResponse.json({
    booking,
    order: providerOrder,
    razorpay: {
      amount: checkout.totalAmount,
      currency,
      description: `${checkout.trip.name} - ${travelers} traveler(s)`,
      key: providerKeyId,
      name: "Spiritual Trails",
      notes: { bookingId: booking.id, tripId },
      orderId: providerOrder.id,
      prefill: {
        contact: checkout.user.phoneNumber || "",
        email: checkout.user.email,
        name: checkout.user.name,
      },
      theme: { color: "#8B4513" },
    },
    success: true,
  });
}

async function parseCreateOrderInput(
  request: Request
): Promise<{ ok: false; response: NextResponse } | { ok: true; value: NormalizedCreateOrderBody }> {
  let body: CreateOrderBody;
  try {
    const parsed = await readJsonBodyWithinLimit(request, CREATE_ORDER_MAX_BODY_BYTES);
    if (!("value" in parsed && isRecord(parsed.value))) {
      throw new CreateOrderDomainError("invalid_payload");
    }
    body = parsed.value;
  } catch (error) {
    throw dependencyFailure(error, "invalid_payload");
  }
  const { currency = "INR", notes = "", travelerDetails = [], travelers = 1, tripId } = body;
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "A valid Idempotency-Key header is required" },
        { status: 400 }
      ),
    };
  }
  if (!(isRuntimeString(currency) && ["INR", "USD"].includes(currency))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unsupported currency" }, { status: 400 }),
    };
  }
  if (!(isRuntimeString(tripId) && tripId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Trip ID is required" }, { status: 400 }),
    };
  }
  const normalizedTravelers = isRuntimeNumber(travelers) ? travelers : Number.NaN;
  if (
    !Number.isInteger(normalizedTravelers) ||
    normalizedTravelers < 1 ||
    normalizedTravelers > 10
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Number of travelers must be between 1 and 10" },
        { status: 400 }
      ),
    };
  }
  const bookingDetails = parseBookingDetails(notes, travelerDetails, normalizedTravelers);
  if (!bookingDetails.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid booking details" }, { status: 400 }),
    };
  }
  return {
    ok: true,
    value: {
      currency,
      idempotencyKey,
      notes: bookingDetails.notes,
      travelerDetails: bookingDetails.travelerDetails,
      travelers: normalizedTravelers,
      tripId,
    },
  };
}

export async function handleCreateOrder(request: Request, options: CreateOrderOptions = {}) {
  const deps = { ...defaultDependencies(options.supportReference), ...options.deps };
  try {
    const input = await parseCreateOrderInput(request);
    if (!input.ok) {
      return input.response;
    }
    const {
      currency: normalizedCurrency,
      idempotencyKey,
      notes: normalizedNotes,
      travelerDetails: normalizedTravelerDetails,
      travelers: normalizedTravelers,
      tripId,
    } = input.value;

    const identityLink = await runDependency("mutation_unavailable", deps.establishIdentity);
    if (!isRecord(identityLink) || identityLink.status !== "linked") {
      throw new CreateOrderDomainError("identity_review_required");
    }
    await runDependency("mutation_unavailable", deps.ensureProfile);
    const factsHash = await jsonHash({
      currency: normalizedCurrency,
      notes: normalizedNotes,
      travelerDetails: normalizedTravelerDetails,
      travelers: normalizedTravelers,
      tripId,
    });
    const checkout = parsePreparedCheckout(
      await runDependency("checkout_unavailable", () =>
        deps.prepareCheckout({
          checkoutFactsHash: factsHash,
          currency: normalizedCurrency,
          idempotencyKey,
          travelers: normalizedTravelers,
          tripIdentifier: tripId,
        })
      )
    );

    const { totalAmount } = checkout;
    if (!(isRuntimeString(deps.providerKeyId) && deps.providerKeyId.trim())) {
      throw new CreateOrderDomainError("invalid_configuration");
    }
    const serverSecret = deps.getServerSecret();
    if (!(isRuntimeString(serverSecret) && serverSecret.trim())) {
      throw new CreateOrderDomainError("invalid_configuration");
    }
    const providerClaimId = await jsonHash({
      checkoutIntentId: checkout.checkoutIntentId,
    });
    const claim = parseCheckoutClaim(
      await runSensitiveDependency("mutation_unavailable", () =>
        deps.claimCheckoutIntent({
          checkoutIntentId: checkout.checkoutIntentId,
          providerClaimId,
          serverSecret,
        })
      ),
      checkout,
      normalizedCurrency
    );
    if (claim.state === "in_progress") {
      throw new CreateOrderDomainError("checkout_in_progress");
    }
    if (claim.state === "consumed") {
      return successfulOrderResponse({
        booking: claim.booking,
        checkout,
        currency: normalizedCurrency,
        providerKeyId: deps.providerKeyId,
        providerOrder: claim.providerOrder,
        travelers: normalizedTravelers,
        tripId,
      });
    }
    const { pendingBooking: booking, providerOrder: razorpayOrder } =
      await executeRazorpayNewOrderOrchestration<RazorpayOrder, PendingBookingResult>(
        {
          checkout,
          currency: normalizedCurrency,
          receipt: checkout.receipt,
          travelers: normalizedTravelers,
        },
        {
          createPendingBooking: async (providerOrder) =>
            parsePendingBooking(
              await runSensitiveDependency("mutation_unavailable", () =>
                deps.createPendingBooking({
                  checkoutIntentId: checkout.checkoutIntentId,
                  notes: normalizedNotes,
                  providerClaimId,
                  providerOrder: {
                    amount: providerOrder.amount,
                    currency: providerOrder.currency,
                    id: providerOrder.id,
                    receipt: providerOrder.receipt,
                  },
                  serverSecret,
                  travelerDetails: normalizedTravelerDetails,
                })
              ),
              checkout.checkoutIntentId
            ),
          createProviderOrder: async (providerInput) => {
            const expectedOrder = {
              amount: totalAmount,
              currency: normalizedCurrency,
              receipt: checkout.receipt,
            };
            const findExistingOrder = async () =>
              parseRazorpayOrderLookup(
                await runDependency("provider_unavailable", () =>
                  deps.findProviderOrdersByReceipt(checkout.receipt)
                ),
                expectedOrder
              );
            const existingOrder = await findExistingOrder();
            if (existingOrder) {
              return existingOrder;
            }
            const finalControl = await runDependency(
              "checkout_unavailable",
              deps.resolvePaymentControl
            );
            if (!finalControl.enabled) {
              throw new CreateOrderDomainError("checkout_unavailable");
            }
            if (checkout.expiresAt <= Date.now()) {
              throw new CreateOrderDomainError("checkout_unavailable");
            }
            try {
              return parseRazorpayOrder(
                await runDependency("provider_unavailable", () =>
                  deps.createProviderOrder(providerInput)
                ),
                expectedOrder
              );
            } catch (error) {
              const recoveredOrder = await findExistingOrder();
              if (recoveredOrder) {
                return recoveredOrder;
              }
              throw error;
            }
          },
        }
      );

    return successfulOrderResponse({
      booking: booking.booking,
      checkout,
      currency: normalizedCurrency,
      providerKeyId: deps.providerKeyId,
      providerOrder: razorpayOrder,
      travelers: normalizedTravelers,
      tripId,
    });
  } catch (error) {
    options.logFailure?.("Create order error", error);
    return mapCreateOrderError(error);
  }
}

export async function POST(request: Request) {
  return await withApiRequestLogging(
    request,
    "/api/create-order",
    ({ requestId }: { requestId: string }) =>
      handleCreateOrder(request, { supportReference: requestId })
  );
}

export async function OPTIONS(request: Request) {
  return await withApiRequestLogging(request, "/api/create-order", () =>
    Promise.resolve(NextResponse.json({}, { status: 200 }))
  );
}
