/**
 * API Route: Verify Razorpay Payment
 * POST /api/verify-payment
 * 
 * Verifies the payment signature after successful checkout.
 * Called by the frontend after Razorpay Checkout returns success.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookings, trips } from '@/lib/db/schema';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { eq, sql } from 'drizzle-orm';

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
        await db
          .update(bookings)
          .set({ 
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking_id));
      }

      return NextResponse.json(
        { error: 'Payment verification failed. Please contact support.' },
        { status: 400 }
      );
    }

    // Find the booking by Razorpay order ID
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.razorpayOrderId, razorpay_order_id))
      .limit(1);

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found for this order' },
        { status: 404 }
      );
    }

    // Check if already confirmed (idempotency)
    if (booking.status === 'confirmed') {
      return NextResponse.json({
        success: true,
        message: 'Payment already confirmed',
        booking: {
          id: booking.id,
          status: booking.status,
        },
      });
    }

    // Update booking to confirmed
    const [updatedBooking] = await db
      .update(bookings)
      .set({
        status: 'confirmed',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id))
      .returning();

    // Decrement available seats for the trip
    await db
      .update(trips)
      .set({
        availableSeats: sql`${trips.availableSeats} - ${booking.travelers}`,
        updatedAt: new Date(),
      })
      .where(eq(trips.id, booking.tripId));

    // TODO: Send confirmation email to user
    // await sendBookingConfirmationEmail(booking);

    return NextResponse.json({
      success: true,
      message: 'Payment verified and booking confirmed',
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        confirmedAt: updatedBooking.confirmedAt,
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











