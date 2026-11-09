/**
 * API Route: Verify Razorpay Payment
 * POST /api/verify-payment
 *
 * Verifies the payment signature after successful checkout.
 * Called by the frontend after Razorpay Checkout returns success.
 */

import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { fetchAuthMutation } from "@/lib/auth-server";
import { isCrossSiteBrowserRequest } from "@/lib/http/crossSiteRequest";
import { isJsonObject } from "@/lib/jsonValue";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import type { ConfirmBookingArgs, VerifyPaymentPayload } from "@/lib/paymentVerification";
import { verifyPaymentRequest } from "@/lib/paymentVerification";
import { fetchPayment, verifyPaymentSignature } from "@/lib/razorpay";

async function handleVerifyPayment(request: Request) {
  // Cookie-authenticated state change: refuse a forged cross-site browser request.
  if (isCrossSiteBrowserRequest(request)) {
    return NextResponse.json({ error: "Request origin not allowed." }, { status: 403 });
  }
  try {
    const body: VerifyPaymentPayload = await request.json();

    const result = await verifyPaymentRequest({
      body,
      confirmBooking: (args: ConfirmBookingArgs) =>
        fetchAuthMutation(anyApi.bookings.confirmBookingByOrderId, args),
      fetchPayment: async (paymentId) => {
        const payment = await fetchPayment(paymentId);
        return isJsonObject(payment) ? payment : null;
      },
      verifySignature: verifyPaymentSignature,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { confirmed } = result;

    if (confirmed.alreadyConfirmed) {
      return NextResponse.json({
        booking: {
          id: confirmed.booking?.id,
          status: confirmed.booking?.status,
        },
        message: "Payment already confirmed",
        success: true,
      });
    }

    return NextResponse.json({
      booking: {
        confirmedAt: confirmed.booking?.confirmedAt,
        id: confirmed.booking?.id,
        status: confirmed.booking?.status,
      },
      message: "Payment verified and booking confirmed",
      success: true,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment. Please contact support." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return await withApiRequestLogging(request, "/api/verify-payment", () =>
    handleVerifyPayment(request)
  );
}
