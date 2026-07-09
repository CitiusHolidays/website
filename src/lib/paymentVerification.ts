import { Effect, Exit } from "effect";
import { buildExternalIoEffect } from "./effectAdoption";

// Effect: external-io, typed-recoverable-errors (see effectAdoption.ts).
export interface VerifyPaymentPayload {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
}

export interface ConfirmBookingArgs {
  orderId: string;
  paymentId: string;
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
      error: string;
      ok: false;
      status: number;
    };

export function validateVerifyPaymentPayload(
  body: VerifyPaymentPayload | null | undefined
): VerifyPaymentValidationResult {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
  if (
    typeof razorpay_order_id !== "string" ||
    typeof razorpay_payment_id !== "string" ||
    typeof razorpay_signature !== "string" ||
    !(razorpay_order_id && razorpay_payment_id && razorpay_signature)
  ) {
    return { error: "Missing payment verification parameters", ok: false, status: 400 };
  }
  return {
    ok: true,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  };
}

export function getPaymentMutationSecret() {
  return process.env.PAYMENT_MUTATION_SECRET ?? null;
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
    return validated;
  }

  const isValid = verifySignature({
    orderId: validated.orderId,
    paymentId: validated.paymentId,
    signature: validated.signature,
  });
  if (!isValid) {
    return {
      error: "Payment verification failed. Please contact support.",
      ok: false,
      status: 400,
    };
  }

  const serverSecret = getPaymentMutationSecret();
  if (!serverSecret) {
    return { error: "Payment confirmation is not configured", ok: false, status: 500 };
  }

  const confirmedExit = await Effect.runPromiseExit(
    buildExternalIoEffect("confirm Razorpay booking", () =>
      confirmBooking({
        orderId: validated.orderId,
        paymentId: validated.paymentId,
        serverSecret,
        signature: validated.signature,
      })
    )
  );

  if (Exit.isFailure(confirmedExit)) {
    return {
      error: "Payment confirmation failed. Please contact support.",
      ok: false,
      status: 500,
    };
  }

  const confirmed = confirmedExit.value;
  if (!confirmed?.success) {
    return { error: "Booking not found for this order", ok: false, status: 404 };
  }

  return { confirmed, ok: true };
}
