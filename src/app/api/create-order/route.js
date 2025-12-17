/**
 * API Route: Create Razorpay Order
 * POST /api/create-order
 * 
 * Creates a Razorpay order for a trip booking.
 * Returns the order_id to be used with Razorpay Checkout on the frontend.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trips, bookings, users } from '@/lib/db/schema';
import { createOrder, razorpayKeyId } from '@/lib/razorpay';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();
    const { 
      tripId, 
      userId, 
      travelers = 1, 
      currency = 'INR',
      travelerDetails = [],
      notes = '' 
    } = body;

    // Validate required fields
    if (!tripId) {
      return NextResponse.json(
        { error: 'Trip ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required. Please log in to continue.' },
        { status: 401 }
      );
    }

    if (travelers < 1 || travelers > 10) {
      return NextResponse.json(
        { error: 'Number of travelers must be between 1 and 10' },
        { status: 400 }
      );
    }

    // Verify user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please log in again.' },
        { status: 404 }
      );
    }

    // Fetch trip details
    const [trip] = await db
      .select()
      .from(trips)
      .where(and(
        eq(trips.id, tripId),
        eq(trips.isActive, 1)
      ))
      .limit(1);

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found or is no longer available' },
        { status: 404 }
      );
    }

    // Check seat availability
    if (trip.availableSeats < travelers) {
      return NextResponse.json(
        { error: `Only ${trip.availableSeats} seats available for this trip` },
        { status: 400 }
      );
    }

    // Calculate total amount based on currency
    const pricePerPerson = currency === 'INR' ? trip.priceInr : trip.priceUsd;
    const totalAmount = pricePerPerson * travelers;

    // Generate unique receipt ID for this order
    const receiptId = `rcpt_${randomUUID().replace(/-/g, '').substring(0, 16)}`;

    // Create Razorpay order
    const razorpayOrder = await createOrder({
      amount: totalAmount,
      currency,
      receipt: receiptId,
      notes: {
        tripId,
        tripName: trip.name,
        userId,
        userEmail: user.email,
        travelers: travelers.toString(),
      },
    });

    // Create pending booking in database
    const [booking] = await db
      .insert(bookings)
      .values({
        userId,
        tripId,
        status: 'pending',
        razorpayOrderId: razorpayOrder.id,
        totalAmount,
        currency,
        travelers,
        travelerDetails: travelerDetails.length > 0 ? travelerDetails : null,
        notes: notes || null,
      })
      .returning();

    // Return order details for frontend Razorpay Checkout
    return NextResponse.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
      },
      booking: {
        id: booking.id,
        status: booking.status,
      },
      // Razorpay checkout configuration
      razorpay: {
        key: razorpayKeyId,
        orderId: razorpayOrder.id,
        amount: totalAmount,
        currency,
        name: 'Spiritual Trails',
        description: `${trip.name} - ${travelers} traveler(s)`,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phoneNumber || '',
        },
        notes: {
          bookingId: booking.id,
          tripId,
        },
        theme: {
          color: '#8B4513', // Earthy brown for spiritual theme
        },
      },
    });

  } catch (error) {
    console.error('Create order error:', error);
    
    // Handle specific error types
    if (error.message?.includes('Razorpay')) {
      return NextResponse.json(
        { error: 'Payment gateway error. Please try again later.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create order. Please try again.' },
      { status: 500 }
    );
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}











