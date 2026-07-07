export function validateVerifyPaymentPayload(body) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
  if (!(razorpay_order_id && razorpay_payment_id && razorpay_signature)) {
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
      error: "Payment verification failed. Please contact support.",
      ok: false,
      status: 400,
    };
  }

  const serverSecret = getPaymentMutationSecret();
  if (!serverSecret) {
    return { error: "Payment confirmation is not configured", ok: false, status: 500 };
  }

  const confirmed = await confirmBooking({
    orderId: validated.orderId,
    paymentId: validated.paymentId,
    serverSecret,
    signature: validated.signature,
  });
  if (!confirmed?.success) {
    return { error: "Booking not found for this order", ok: false, status: 404 };
  }

  return { confirmed, ok: true };
}
