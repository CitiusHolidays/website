/**
 * API Route: Create Razorpay Order
 * POST /api/create-order
 *
 * Creates a Razorpay order for a trip booking.
 * Returns the order_id to be used with Razorpay Checkout on the frontend.
 */

import { anyApi } from "convex/server";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { fetchAuthMutation, fetchAuthQuery } from "@/lib/auth-server";
import { createOrder, razorpayKeyId } from "@/lib/razorpay";

export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();
    const { tripId, travelers = 1, currency = "INR", travelerDetails = [], notes = "" } = body;

    const normalizedCurrency = currency === "USD" ? "USD" : "INR";

    // Validate required fields
    if (!tripId) {
      return NextResponse.json({ error: "Trip ID is required" }, { status: 400 });
    }

    const currentUser = await fetchAuthQuery(anyApi.auth.getCurrentUser, {});
    if (!currentUser?.id) {
      return NextResponse.json({ error: "You must be logged in to continue." }, { status: 401 });
    }

    if (travelers < 1 || travelers > 10) {
      return NextResponse.json(
        { error: "Number of travelers must be between 1 and 10" },
        { status: 400 }
      );
    }

    await fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {});
    const checkout = await fetchAuthQuery(anyApi.bookings.prepareCheckout, {
      currency: normalizedCurrency,
      travelers,
      tripIdentifier: tripId,
    });

    // Calculate total amount based on currency
    const totalAmount = checkout.totalAmount;

    // Generate unique receipt ID for this order
    const receiptId = `rcpt_${randomUUID().replace(/-/g, "").substring(0, 16)}`;

    // Create Razorpay order
    const razorpayOrder = await createOrder({
      amount: totalAmount,
      currency: normalizedCurrency,
      notes: {
        travelers: travelers.toString(),
        tripId: checkout.trip.id,
        tripName: checkout.trip.name,
        userEmail: checkout.user.email,
        userId: currentUser.id,
      },
      receipt: receiptId,
    });

    const booking = await fetchAuthMutation(anyApi.bookings.createPendingBooking, {
      currency: normalizedCurrency,
      notes: notes || "",
      razorpayOrderId: razorpayOrder.id,
      travelerDetails: travelerDetails.length > 0 ? travelerDetails : null,
      travelers,
      tripIdentifier: tripId,
    });

    // Return order details for frontend Razorpay Checkout
    return NextResponse.json({
      booking: {
        id: booking.booking.id,
        status: booking.booking.status,
      },
      order: {
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        id: razorpayOrder.id,
        receipt: razorpayOrder.receipt,
      },
      // Razorpay checkout configuration
      razorpay: {
        amount: totalAmount,
        currency: normalizedCurrency,
        description: `${checkout.trip.name} - ${travelers} traveler(s)`,
        key: razorpayKeyId,
        name: "Spiritual Trails",
        notes: {
          bookingId: booking.booking.id,
          tripId,
        },
        orderId: razorpayOrder.id,
        prefill: {
          contact: checkout.user.phoneNumber || "",
          email: checkout.user.email,
          name: checkout.user.name,
        },
        theme: {
          color: "#8B4513", // Earthy brown for spiritual theme
        },
      },
      success: true,
    });
  } catch (error) {
    console.error("Create order error:", error);

    if (error?.message?.includes("Trip not found")) {
      return NextResponse.json(
        { error: "Trip not found or is no longer available" },
        { status: 404 }
      );
    }

    if (error?.message?.includes("Only")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error?.message?.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: "You must be logged in to continue." }, { status: 401 });
    }

    // Handle specific error types
    if (error.message?.includes("Razorpay")) {
      return NextResponse.json(
        { error: "Payment gateway error. Please try again later." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create order. Please try again." },
      { status: 500 }
    );
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
