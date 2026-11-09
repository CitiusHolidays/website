import { isJsonObject, type JsonValue } from "./jsonValue";
import { isRuntimeNumber, isRuntimeString } from "./runtimeValues";
export interface VerifyPaymentPayload {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
}

export interface ConfirmBookingArgs {
  orderId: string;
  paidAmount: number;
  paidCurrency: string;
  paymentId: string;
  providerEventId: string;
  reason: string;
  serverSecret: string;
  signature: string;
}

export interface ConfirmedBookingResult {
  alreadyConfirmed?: boolean;
  booking?: {
    confirmedAt?: unknown;
    id?: unknown;
    status?: unknown;
  };
  paymentMismatch?: boolean;
  success?: boolean;
}

/** The fields of a Razorpay payment this check relies on, as fetched by the server. */
export interface VerifiedRazorpayPayment {
  amount: number;
  currency: string;
  orderId: string;
  status: string;
}

// Razorpay reports a successful checkout as authorized, then captured (auto-capture).
const SUCCESSFUL_PAYMENT_STATUSES = new Set(["authorized", "captured"]);

export type VerifyPaymentValidationResult =
  | {
      ok: true;
      orderId: string;
      paymentId: string;
      signature: string;
    }
  | {
      error: string;
      ok: false;
      status: number;
    };

export type VerifyPaymentResult =
  | {
      confirmed: ConfirmedBookingResult;
      ok: true;
    }
  | {
      code:
        | "invalid_configuration"
        | "invalid_payload"
        | "mutation_unavailable"
        | "not_found"
        | "payment_incomplete"
        | "payment_mismatch"
        | "provider_unavailable";
      error: string;
      ok: false;
      status: number;
    };

export function validateVerifyPaymentPayload(
  body: VerifyPaymentPayload | null | undefined
): VerifyPaymentValidationResult {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
  if (
    !(
      isRuntimeString(razorpay_order_id) &&
      isRuntimeString(razorpay_payment_id) &&
      isRuntimeString(razorpay_signature) &&
      razorpay_order_id &&
      razorpay_payment_id &&
      razorpay_signature
    )
  ) {
    return {
      error: "Missing payment verification parameters",
      ok: false,
      status: 400,
    };
  }
  return {
    ok: true,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  };
}

/** Narrows a fetched Razorpay payment; anything malformed is treated as unverifiable. */
function parseRazorpayPayment(value: JsonValue): VerifiedRazorpayPayment | null {
  if (!isJsonObject(value)) {
    return null;
  }
  const { amount, currency, order_id: orderId, status } = value;
  if (
    !(
      isRuntimeNumber(amount) &&
      Number.isSafeInteger(amount) &&
      amount >= 0 &&
      isRuntimeString(currency) &&
      currency &&
      isRuntimeString(orderId) &&
      orderId &&
      isRuntimeString(status) &&
      status
    )
  ) {
    return null;
  }
  return { amount, currency, orderId, status };
}

export function getPaymentMutationSecret(env = process.env) {
  const secret = env.PAYMENT_MUTATION_SECRET;

  // An empty/whitespace-only value is not a usable server-to-server secret.
  // Treat it the same as an absent value so callers fail closed before making
  // a payment mutation call. Do not trim a configured secret: the exact value
  // must still be passed to Convex for equality checking.
  return isRuntimeString(secret) && secret.trim().length > 0 ? secret : null;
}

export async function verifyPaymentRequest({
  body,
  confirmBooking,
  fetchPayment,
  logFailure = console.error,
  verifySignature,
}: {
  body: VerifyPaymentPayload | null | undefined;
  confirmBooking: (args: ConfirmBookingArgs) => Promise<ConfirmedBookingResult>;
  /** Server-side Razorpay lookup: the only source of the paid amount and currency. */
  fetchPayment: (paymentId: string) => Promise<JsonValue>;
  logFailure?: (message: string, cause: unknown) => void;
  verifySignature: (input: { orderId: string; paymentId: string; signature: string }) => boolean;
}): Promise<VerifyPaymentResult> {
  const validated = validateVerifyPaymentPayload(body);
  if (!validated.ok) {
    return { ...validated, code: "invalid_payload" };
  }

  let isValid = false;
  try {
    isValid = verifySignature({
      orderId: validated.orderId,
      paymentId: validated.paymentId,
      signature: validated.signature,
    });
  } catch (cause) {
    logFailure("Razorpay signature verification is not configured", cause);
    return {
      code: "invalid_configuration",
      error: "Payment confirmation is not configured",
      ok: false,
      status: 500,
    };
  }
  if (!isValid) {
    return {
      code: "invalid_payload",
      error: "Payment verification failed. Please contact support.",
      ok: false,
      status: 400,
    };
  }

  const serverSecret = getPaymentMutationSecret();
  if (!serverSecret) {
    return {
      code: "invalid_configuration",
      error: "Payment confirmation is not configured",
      ok: false,
      status: 500,
    };
  }

  // The signature proves the payment belongs to the order, not how much was paid. Ask Razorpay.
  let payment: VerifiedRazorpayPayment | null;
  try {
    payment = parseRazorpayPayment(await fetchPayment(validated.paymentId));
  } catch (cause) {
    logFailure("Razorpay payment lookup failed", cause);
    payment = null;
  }
  if (!payment) {
    // The signed webhook confirms the booking independently once Razorpay is reachable.
    return {
      code: "provider_unavailable",
      error: "We could not confirm your payment yet. Please check your bookings shortly.",
      ok: false,
      status: 503,
    };
  }
  if (payment.orderId !== validated.orderId) {
    return {
      code: "invalid_payload",
      error: "Payment verification failed. Please contact support.",
      ok: false,
      status: 400,
    };
  }
  if (!SUCCESSFUL_PAYMENT_STATUSES.has(payment.status)) {
    return {
      code: "payment_incomplete",
      error: "Your payment has not completed. Please contact support if you were charged.",
      ok: false,
      status: 409,
    };
  }

  let confirmed: ConfirmedBookingResult;
  try {
    confirmed = await confirmBooking({
      orderId: validated.orderId,
      paidAmount: payment.amount,
      paidCurrency: payment.currency,
      paymentId: validated.paymentId,
      providerEventId: `checkout:payment.confirmed:${validated.orderId}:${validated.paymentId}`,
      reason: "Checkout signature verified",
      serverSecret,
      signature: validated.signature,
    });
  } catch (cause) {
    logFailure("Razorpay booking confirmation mutation failed", cause);
    return {
      code: "mutation_unavailable",
      error: "Payment confirmation failed. Please contact support.",
      ok: false,
      status: 500,
    };
  }

  if (confirmed?.paymentMismatch) {
    return {
      code: "payment_mismatch",
      error: "Your payment did not match this booking. Our team will contact you.",
      ok: false,
      status: 409,
    };
  }

  if (!confirmed?.success) {
    return {
      code: "not_found",
      error: "Booking not found for this order",
      ok: false,
      status: 404,
    };
  }

  return { confirmed, ok: true };
}
