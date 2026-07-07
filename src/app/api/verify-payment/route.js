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
      confirmBooking: (args) => fetchAuthMutation(anyApi.bookings.confirmBookingByOrderId, args),
      verifySignature: verifyPaymentSignature,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    void booking_id;
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
