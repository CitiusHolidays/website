/**
 * API Route: Razorpay Webhook Handler
 * POST /api/webhooks/razorpay
 *
 * Handles webhooks from Razorpay for payment status updates.
 * This is a backup for client-side verification - always verify on server.
 */

import { anyApi } from "convex/server";
import { NextResponse } from "next/server";
import { fetchAuthMutation } from "@/lib/auth-server";
import { getPaymentMutationSecret } from "@/lib/paymentVerification";
import { verifyWebhookSignature } from "@/lib/razorpay";
import {
  mapRazorpayWebhookProcessingError,
  processRazorpayWebhookEvent,
  type RazorpayWebhookPayload,
} from "@/lib/razorpayWebhook";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      console.error("Webhook received without signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const event = typeof payload.event === "string" ? payload.event : "unknown";
    console.log(`Razorpay webhook received: ${event}`);

    const result = await processRazorpayWebhookEvent(payload, {
      confirmBookingByOrderId: (args) =>
        fetchAuthMutation(anyApi.bookings.confirmBookingByOrderId, args),
      getServerSecret: getPaymentMutationSecret,
      markPaymentFailedByOrderId: (args) =>
        fetchAuthMutation(anyApi.bookings.markPaymentFailedByOrderId, args),
      markRefundedByPaymentId: (args) =>
        fetchAuthMutation(anyApi.bookings.markRefundedByPaymentId, args),
      recordPaymentAuthorized: (args) =>
        fetchAuthMutation(anyApi.bookings.recordPaymentAuthorized, args),
    });

    console.log(`Razorpay webhook action: ${result.action}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    const response = mapRazorpayWebhookProcessingError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
