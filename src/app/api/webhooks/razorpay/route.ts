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
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { getPaymentMutationSecret } from "@/lib/paymentVerification";
import { verifyWebhookSignature } from "@/lib/razorpay";
import {
  mapRazorpayWebhookProcessingError,
  processRazorpayWebhookEvent,
  type RazorpayWebhookDeps,
  type RazorpayWebhookPayload,
} from "@/lib/razorpayWebhook";

interface RazorpayWebhookRouteOptions {
  deps?: RazorpayWebhookDeps;
  supportReference?: string;
}

function defaultWebhookDeps(supportReference?: string): RazorpayWebhookDeps {
  const authOptions = { correlationId: supportReference };
  return {
    confirmBookingByOrderId: (args) =>
      fetchAuthMutation(anyApi.bookings.confirmBookingByOrderId, args, authOptions),
    getServerSecret: getPaymentMutationSecret,
    markPaymentFailedByOrderId: (args) =>
      fetchAuthMutation(anyApi.bookings.markPaymentFailedByOrderId, args, authOptions),
    markRefundedByPaymentId: (args) =>
      fetchAuthMutation(anyApi.bookings.markRefundedByPaymentId, args, authOptions),
    recordPaymentAuthorized: (args) =>
      fetchAuthMutation(anyApi.bookings.recordPaymentAuthorized, args, authOptions),
  };
}

export async function handleRazorpayWebhook(
  request: Request,
  options: RazorpayWebhookRouteOptions = {}
) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const providerEventId = request.headers.get("x-razorpay-event-id");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (!providerEventId?.trim()) {
      return NextResponse.json({ error: "Missing event identity" }, { status: 400 });
    }

    // SAFETY: the raw body is authenticated by Razorpay's HMAC before its provider-owned payload is consumed.
    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const result = await processRazorpayWebhookEvent(
      payload,
      options.deps ?? defaultWebhookDeps(options.supportReference),
      providerEventId
    );

    return NextResponse.json(result);
  } catch (error) {
    const response = mapRazorpayWebhookProcessingError(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  return await withApiRequestLogging(
    request,
    "/api/webhooks/razorpay",
    ({ requestId }: { requestId: string }) =>
      handleRazorpayWebhook(request, { supportReference: requestId })
  );
}
