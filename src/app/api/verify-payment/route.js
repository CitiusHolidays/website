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
import { verifyPaymentRequest } from "@/lib/paymentVerification";
import { verifyPaymentSignature } from "@/lib/razorpay";

export async function POST(request) {
  try {
    const body = await request.json();
    const { booking_id } = body;

    const result = await verifyPaymentRequest({
      body,
      verifySignature: verifyPaymentSignature,
      confirmBooking: (args) => fetchAuthMutation(anyApi.bookings.confirmBookingByOrderId, args),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    void booking_id;
    const { confirmed } = result;

    if (confirmed.alreadyConfirmed) {
      return NextResponse.json({
        success: true,
        message: "Payment already confirmed",
        booking: {
          id: confirmed.booking?.id,
          status: confirmed.booking?.status,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and booking confirmed",
      booking: {
        id: confirmed.booking?.id,
        status: confirmed.booking?.status,
        confirmedAt: confirmed.booking?.confirmedAt,
      },
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment. Please contact support." },
      { status: 500 },
    );
  }
}
