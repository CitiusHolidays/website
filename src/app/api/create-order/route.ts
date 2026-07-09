/**
 * API Route: Create Razorpay Order
 * POST /api/create-order
 *
 * Creates a Razorpay order for a trip booking.
 * Returns the order_id to be used with Razorpay Checkout on the frontend.
 */

import { randomUUID } from "node:crypto";
import { anyApi } from "convex/server";
import { Effect, Exit } from "effect";
import { NextResponse } from "next/server";
import { fetchAuthMutation, fetchAuthQuery } from "@/lib/auth-server";
import { buildExternalIoEffect } from "@/lib/effectAdoption";
import { createOrder, razorpayKeyId } from "@/lib/razorpay";

// Effect: external-io, typed-recoverable-errors (see effectAdoption.ts).
interface CreateOrderBody {
  currency?: unknown;
  notes?: unknown;
  travelerDetails?: unknown;
  travelers?: unknown;
  tripId?: unknown;
}

interface PreparedCheckout {
  totalAmount: number;
  trip: {
    id: string;
    name: string;
  };
  user: {
    email: string;
    name: string;
    phoneNumber?: string | null;
  };
}

interface RazorpayOrder {
  amount: number;
  currency: string;
  id: string;
  receipt: string;
}

function normalizeTravelers(value: unknown) {
  return typeof value === "number" ? value : 1;
}

function mapCreateOrderError(error: unknown) {
  if (error instanceof Error && error.message.includes("Trip not found")) {
    return NextResponse.json(
      { error: "Trip not found or is no longer available" },
      { status: 404 }
    );
  }

  if (error instanceof Error && error.message.includes("Only")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof Error && error.message.includes("UNAUTHORIZED")) {
    return NextResponse.json({ error: "You must be logged in to continue." }, { status: 401 });
  }

  if (error instanceof Error && error.message.includes("Razorpay")) {
    return NextResponse.json(
      { error: "Payment gateway error. Please try again later." },
      { status: 503 }
    );
  }

  return NextResponse.json({ error: "Failed to create order. Please try again." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateOrderBody;
    const { currency = "INR", notes = "", travelerDetails = [], travelers = 1, tripId } = body;

    const normalizedCurrency = currency === "USD" ? "USD" : "INR";
    const normalizedTravelers = normalizeTravelers(travelers);

    if (typeof tripId !== "string" || !tripId) {
      return NextResponse.json({ error: "Trip ID is required" }, { status: 400 });
    }

    const currentUser = await fetchAuthQuery(anyApi.auth.getCurrentUser, {});
    if (!currentUser?.id) {
      return NextResponse.json({ error: "You must be logged in to continue." }, { status: 401 });
    }

    if (normalizedTravelers < 1 || normalizedTravelers > 10) {
      return NextResponse.json(
        { error: "Number of travelers must be between 1 and 10" },
        { status: 400 }
      );
    }

    await fetchAuthMutation(anyApi.userProfiles.ensureMyProfile, {});
    const checkout = (await fetchAuthQuery(anyApi.bookings.prepareCheckout, {
      currency: normalizedCurrency,
      travelers: normalizedTravelers,
      tripIdentifier: tripId,
    })) as PreparedCheckout;

    const { totalAmount } = checkout;
    const receiptId = `rcpt_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    const razorpayOrderExit = await Effect.runPromiseExit(
      buildExternalIoEffect("create Razorpay order", () =>
        createOrder({
          amount: totalAmount,
          currency: normalizedCurrency,
          notes: {
            travelers: normalizedTravelers.toString(),
            tripId: checkout.trip.id,
            tripName: checkout.trip.name,
            userEmail: checkout.user.email,
            userId: currentUser.id,
          },
          receipt: receiptId,
        })
      )
    );

    if (Exit.isFailure(razorpayOrderExit)) {
      throw new Error("Razorpay order creation failed");
    }

    const razorpayOrder = razorpayOrderExit.value as RazorpayOrder;
    const booking = await fetchAuthMutation(anyApi.bookings.createPendingBooking, {
      currency: normalizedCurrency,
      notes: typeof notes === "string" ? notes : "",
      razorpayOrderId: razorpayOrder.id,
      travelerDetails:
        Array.isArray(travelerDetails) && travelerDetails.length > 0 ? travelerDetails : null,
      travelers: normalizedTravelers,
      tripIdentifier: tripId,
    });

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
      razorpay: {
        amount: totalAmount,
        currency: normalizedCurrency,
        description: `${checkout.trip.name} - ${normalizedTravelers} traveler(s)`,
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
          color: "#8B4513",
        },
      },
      success: true,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return mapCreateOrderError(error);
  }
}

export function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
