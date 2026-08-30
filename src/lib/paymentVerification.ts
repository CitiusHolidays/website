import { isRuntimeString } from "./runtimeValues";
export interface VerifyPaymentPayload {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
}

export interface ConfirmBookingArgs {
  orderId: string;
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
  success?: boolean;
}

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
      code: "invalid_configuration" | "invalid_payload" | "mutation_unavailable" | "not_found";
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
  verifySignature,
}: {
  body: VerifyPaymentPayload | null | undefined;
  confirmBooking: (args: ConfirmBookingArgs) => Promise<ConfirmedBookingResult>;
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
  } catch {
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

  let confirmed: ConfirmedBookingResult;
  try {
    confirmed = await confirmBooking({
      orderId: validated.orderId,
      paymentId: validated.paymentId,
      providerEventId: `checkout:payment.confirmed:${validated.orderId}:${validated.paymentId}`,
      reason: "Checkout signature verified",
      serverSecret,
      signature: validated.signature,
    });
  } catch {
    return {
      code: "mutation_unavailable",
      error: "Payment confirmation failed. Please contact support.",
      ok: false,
      status: 500,
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
