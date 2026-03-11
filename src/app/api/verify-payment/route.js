/**
 * API Route: Verify Razorpay Payment
 * POST /api/verify-payment
 * 
 * Verifies the payment signature after successful checkout.
 * Called by the frontend after Razorpay Checkout returns success.
 */

import { NextResponse } from 'next/server';
import { anyApi } from 'convex/server';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { fetchAuthMutation } from '@/lib/auth-server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      booking_id 
    } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment verification parameters' },
        { status: 400 }
      );
    }

    // Verify the payment signature
    const isValid = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      console.error('Payment signature verification failed:', {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });

      // Update booking status to failed
      if (booking_id) {
        await fetchAuthMutation(anyApi.bookings.markBookingFailedById, {
          bookingId: booking_id,
        });
      }

      return NextResponse.json(
        { error: 'Payment verification failed. Please contact support.' },
        { status: 400 }
      );
    }

    const confirmed = await fetchAuthMutation(anyApi.bookings.confirmBookingByOrderId, {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!confirmed?.success) {
      return NextResponse.json(
        { error: 'Booking not found for this order' },
        { status: 404 }
      );
    }

    if (confirmed.alreadyConfirmed) {
      return NextResponse.json({
        success: true,
        message: 'Payment already confirmed',
        booking: {
          id: confirmed.booking?.id,
          status: confirmed.booking?.status,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and booking confirmed',
      booking: {
        id: confirmed.booking?.id,
        status: confirmed.booking?.status,
        confirmedAt: confirmed.booking?.confirmedAt,
      },
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment. Please contact support.' },
      { status: 500 }
    );
  }
}











