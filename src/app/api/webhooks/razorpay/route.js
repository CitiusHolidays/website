/**
 * API Route: Razorpay Webhook Handler
 * POST /api/webhooks/razorpay
 * 
 * Handles webhooks from Razorpay for payment status updates.
 * This is a backup for client-side verification - always verify on server.
 * 
 * Setup in Razorpay Dashboard:
 * 1. Go to Settings > Webhooks
 * 2. Add webhook URL: https://yourdomain.com/api/webhooks/razorpay
 * 3. Select events: payment.authorized, payment.captured, payment.failed
 * 4. Copy the webhook secret to RAZORPAY_WEBHOOK_SECRET env variable
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookings, trips } from '@/lib/db/schema';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { eq, sql } from 'drizzle-orm';

// Disable body parsing - we need the raw body for signature verification
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // Get the raw body as text for signature verification
    const rawBody = await request.text();
    
    // Get the signature from headers
    const signature = request.headers.get('x-razorpay-signature');
    
    if (!signature) {
      console.error('Webhook received without signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Parse the webhook payload
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;

    console.log(`Razorpay webhook received: ${event}`);

    // Handle different webhook events
    switch (event) {
      case 'payment.authorized':
        // Payment is authorized but not yet captured
        // For auto-capture orders, this will be followed by payment.captured
        await handlePaymentAuthorized(paymentEntity);
        break;

      case 'payment.captured':
        // Payment is successfully captured
        await handlePaymentCaptured(paymentEntity);
        break;

      case 'payment.failed':
        // Payment failed
        await handlePaymentFailed(paymentEntity);
        break;

      case 'refund.created':
        // Refund initiated
        await handleRefundCreated(payload.payload?.refund?.entity);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    // Razorpay will retry if we return an error
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 200 anyway to prevent retries for parsing errors
    // Log the error for debugging
    return NextResponse.json({ received: true, error: 'Processing error logged' });
  }
}

/**
 * Handle payment authorized event
 */
async function handlePaymentAuthorized(payment) {
  if (!payment?.order_id) return;

  console.log(`Payment authorized: ${payment.id} for order ${payment.order_id}`);
  
  // Update booking to show payment is in progress
  await db
    .update(bookings)
    .set({
      razorpayPaymentId: payment.id,
      updatedAt: new Date(),
    })
    .where(eq(bookings.razorpayOrderId, payment.order_id));
}

/**
 * Handle payment captured event (successful payment)
 */
async function handlePaymentCaptured(payment) {
  if (!payment?.order_id) return;

  console.log(`Payment captured: ${payment.id} for order ${payment.order_id}`);

  // Find the booking
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.razorpayOrderId, payment.order_id))
    .limit(1);

  if (!booking) {
    console.error(`Booking not found for order: ${payment.order_id}`);
    return;
  }

  // Skip if already confirmed (idempotency)
  if (booking.status === 'confirmed') {
    console.log(`Booking ${booking.id} already confirmed, skipping`);
    return;
  }

  // Update booking to confirmed
  await db
    .update(bookings)
    .set({
      status: 'confirmed',
      razorpayPaymentId: payment.id,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id));

  // Decrement available seats
  await db
    .update(trips)
    .set({
      availableSeats: sql`${trips.availableSeats} - ${booking.travelers}`,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, booking.tripId));

  console.log(`Booking ${booking.id} confirmed via webhook`);

  // TODO: Send confirmation email
  // await sendBookingConfirmationEmail(booking);
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(payment) {
  if (!payment?.order_id) return;

  console.log(`Payment failed: ${payment.id} for order ${payment.order_id}`);
  console.log(`Failure reason: ${payment.error_description || 'Unknown'}`);

  // Update booking status to failed
  await db
    .update(bookings)
    .set({
      status: 'failed',
      razorpayPaymentId: payment.id,
      updatedAt: new Date(),
    })
    .where(eq(bookings.razorpayOrderId, payment.order_id));
}

/**
 * Handle refund created event
 */
async function handleRefundCreated(refund) {
  if (!refund?.payment_id) return;

  console.log(`Refund created: ${refund.id} for payment ${refund.payment_id}`);

  // Update booking status to refunded
  await db
    .update(bookings)
    .set({
      status: 'refunded',
      updatedAt: new Date(),
    })
    .where(eq(bookings.razorpayPaymentId, refund.payment_id));
}











