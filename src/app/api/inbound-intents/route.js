import { createHash } from "node:crypto";
import { fetchMutation } from "convex/nextjs";
import { anyApi } from "convex/server";
import { checkContactRateLimit } from "@/lib/contact/rate-limit";
import {
  detectSpamContent,
  getClientIp,
  isAllowedSiteOrigin,
  isHoneypotTripped,
  validateFormTiming,
} from "@/lib/contact/spam-guard";
import {
  isTurnstileConfigured,
  isTurnstilePartiallyConfigured,
  verifyTurnstileToken,
} from "@/lib/contact/turnstile";
import { isJsonObject, readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const CLIENT_NAME_MAX = 160;
const EMAIL_MAX = 254;
const MOBILE_MAX = 50;
const DESTINATION_MAX = 240;
const NOTES_MAX = 5000;
const MAX_PAX_COUNT = 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^[+()\d][\d\s().-]{5,49}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_SOURCES = new Set(["Citius Concierge", "Sacred Bharat"]);

function jsonResponse(payload, status, headers = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", ...headers },
    status,
  });
}

function reject(message = "Unable to submit your enquiry. Please try again later.", status = 400) {
  return jsonResponse({ error: message }, status);
}

function configuredGateway() {
  const gatewaySecret = process.env.INBOUND_INTENT_GATEWAY_SECRET?.trim();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  const rateLimitSalt = process.env.INBOUND_INTENT_RATE_LIMIT_SALT?.trim();
  if (!(gatewaySecret && convexUrl)) {
    return null;
  }
  if (process.env.NODE_ENV === "production" && !rateLimitSalt) {
    return null;
  }
  return {
    convexUrl,
    gatewaySecret,
    rateLimitSalt: rateLimitSalt || "development-inbound-rate-limit",
  };
}

function hashWithSalt(salt, value) {
  return createHash("sha256").update(`${salt}\0${value}`).digest("hex");
}

function normalizeBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid request body." };
  }

  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  const contactEmail =
    typeof body.contactEmail === "string" ? body.contactEmail.trim().toLowerCase() : undefined;
  const contactMobile =
    typeof body.contactMobile === "string" ? body.contactMobile.trim() : undefined;
  const destination = typeof body.destination === "string" ? body.destination.trim() : undefined;
  const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;
  const source = typeof body.source === "string" ? body.source.trim() : "";
  const travelStartDate =
    typeof body.travelStartDate === "string" ? body.travelStartDate.trim() : undefined;
  const paxCount = body.paxCount === undefined ? undefined : Number(body.paxCount);

  if (body.consent !== true || !clientName || clientName.length > CLIENT_NAME_MAX) {
    return { error: "Please provide your name and consent to be contacted." };
  }
  if (
    contactEmail !== undefined &&
    (!EMAIL_PATTERN.test(contactEmail) || contactEmail.length > EMAIL_MAX)
  ) {
    return { error: "Please provide a valid email address." };
  }
  if (
    contactMobile !== undefined &&
    (!MOBILE_PATTERN.test(contactMobile) || contactMobile.length > MOBILE_MAX)
  ) {
    return { error: "Please provide a valid mobile number." };
  }
  if (destination !== undefined && destination.length > DESTINATION_MAX) {
    return { error: "Destination is too long." };
  }
  if (notes !== undefined && notes.length > NOTES_MAX) {
    return { error: "Notes are too long." };
  }
  if (!ALLOWED_SOURCES.has(source)) {
    return { error: "Invalid enquiry source." };
  }
  if (
    paxCount !== undefined &&
    !(Number.isInteger(paxCount) && paxCount >= 1 && paxCount <= MAX_PAX_COUNT)
  ) {
    return { error: "Pax count must be a whole number between 1 and 1,000." };
  }
  if (travelStartDate !== undefined && !DATE_PATTERN.test(travelStartDate)) {
    return { error: "Travel date must use YYYY-MM-DD format." };
  }

  return {
    value: {
      clientName,
      consent: true,
      ...(contactEmail ? { contactEmail } : {}),
      ...(contactMobile ? { contactMobile } : {}),
      ...(destination ? { destination } : {}),
      ...(notes ? { notes } : {}),
      ...(paxCount === undefined ? {} : { paxCount }),
      source,
      ...(travelStartDate ? { travelStartDate } : {}),
    },
  };
}

function canonicalSubmission(value, requestKey) {
  return requestKey || JSON.stringify(value);
}

/**
 * Testable request boundary. The public POST handler below supplies the real
 * Convex and Turnstile dependencies; tests can replace them without making a
 * network call or writing to a deployment.
 */
export async function handleInboundIntentRequest(
  request,
  {
    checkRateLimit = checkContactRateLimit,
    fetchMutationImpl = fetchMutation,
    turnstileVerifier = verifyTurnstileToken,
  } = {}
) {
  if (!isAllowedSiteOrigin(request)) {
    return reject("Forbidden.", 403);
  }

  const gateway = configuredGateway();
  if (!gateway) {
    return jsonResponse({ error: "Enquiry service is temporarily unavailable." }, 503);
  }
  if (
    process.env.NODE_ENV === "production" &&
    (isTurnstilePartiallyConfigured() || !isTurnstileConfigured())
  ) {
    return jsonResponse({ error: "Enquiry service is temporarily unavailable." }, 503);
  }

  const bodyResult = await readJsonBodyWithinLimit(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return reject(
      bodyResult.reason === "too_large" ? "Request is too large." : "Invalid request body.",
      bodyResult.reason === "too_large" ? 413 : 400
    );
  }
  const body = bodyResult.value;
  if (!isJsonObject(body)) {
    return reject("Invalid request body.");
  }

  if (isHoneypotTripped(body?.company)) {
    return reject();
  }
  const timing = validateFormTiming(body?.formLoadedAt);
  if (!timing.ok) {
    return reject();
  }

  const normalized = normalizeBody(body);
  if (normalized.error) {
    return reject(normalized.error);
  }
  const value = normalized.value;

  const spamCheck = detectSpamContent({
    email: value.contactEmail || "",
    message: value.notes || "",
    name: value.clientName,
    subject: value.source,
  });
  if (spamCheck.spam) {
    return reject();
  }

  if (isTurnstileConfigured()) {
    const captcha = await turnstileVerifier(body?.turnstileToken, getClientIp(request));
    if (!captcha.ok) {
      return reject("Security verification failed. Please refresh and try again.");
    }
  }

  const requestKey = request.headers.get("idempotency-key")?.trim() || "";
  if (requestKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return reject("Invalid idempotency key.");
  }
  const rateLimit = checkRateLimit(getClientIp(request));
  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many enquiries. Please wait a few minutes and try again." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSec) }
    );
  }

  const submissionKeyHash = hashWithSalt(
    gateway.gatewaySecret,
    canonicalSubmission(value, requestKey)
  );
  const rateLimitKeyHash = hashWithSalt(gateway.rateLimitSalt, getClientIp(request));

  try {
    const result = await fetchMutationImpl(
      anyApi.crm.inboundQueryIntents.submitIntentGateway,
      {
        ...value,
        gatewaySecret: gateway.gatewaySecret,
        rateLimitKeyHash,
        submissionKeyHash,
      },
      { url: gateway.convexUrl }
    );
    if (result.status === "throttled") {
      return jsonResponse(
        { error: "Too many enquiries. Please wait a few minutes and try again." },
        429,
        { "Retry-After": "900" }
      );
    }
    return jsonResponse(
      { accepted: true, duplicate: result.status === "duplicate" },
      result.status === "created" ? 201 : 200
    );
  } catch {
    // Keep provider, URL, secret, and Convex details out of the public error.
    return jsonResponse({ error: "Enquiry service is temporarily unavailable." }, 503);
  }
}

export async function POST(request) {
  return await handleInboundIntentRequest(request);
}
