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
import { withApiRequestLogging } from "@/lib/observability/api-log";
import type { ConfirmBookingArgs, VerifyPaymentPayload } from "@/lib/paymentVerification";
import { verifyPaymentRequest } from "@/lib/paymentVerification";
import { verifyPaymentSignature } from "@/lib/razorpay";

async function handleVerifyPayment(request: Request, supportReference: string) {
  try {
    const body: VerifyPaymentPayload = await request.json();

    const result = await verifyPaymentRequest({
      body,
      confirmBooking: (args: ConfirmBookingArgs) =>
        fetchAuthMutation(anyApi.bookings.confirmBookingByOrderId, args, {
          correlationId: supportReference,
        }),
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
  } catch {
    return NextResponse.json(
      { error: "Failed to verify payment. Please contact support." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return await withApiRequestLogging(
    request,
    "/api/verify-payment",
    ({ requestId }: { requestId: string }) => handleVerifyPayment(request, requestId)
  );
}
