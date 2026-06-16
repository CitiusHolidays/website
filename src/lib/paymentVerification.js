export function validateVerifyPaymentPayload(body) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return { ok: false, status: 400, error: "Missing payment verification parameters" };
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

export async function verifyPaymentRequest({ body, verifySignature, confirmBooking }) {
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
      ok: false,
      status: 400,
      error: "Payment verification failed. Please contact support.",
    };
  }

  const serverSecret = getPaymentMutationSecret();
  if (!serverSecret) {
    return { ok: false, status: 500, error: "Payment confirmation is not configured" };
  }

  const confirmed = await confirmBooking({
    orderId: validated.orderId,
    paymentId: validated.paymentId,
    signature: validated.signature,
    serverSecret,
  });
  if (!confirmed?.success) {
    return { ok: false, status: 404, error: "Booking not found for this order" };
  }

  return { ok: true, confirmed };
}
