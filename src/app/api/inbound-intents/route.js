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
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { normalizeSacredBharatIntentContext } from "@/lib/sacredBharat/inboundIntent";
import { isRuntimeObject, isRuntimeString, propertiesWhen } from "../../../lib/runtimeValues";

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
const OPERATIONAL_TEST_TOKEN_PATTERN = /^oct_[a-f0-9]{64}$/;
const ALLOWED_SOURCES = new Set(["Citius Concierge", "Sacred Bharat", "Website"]);

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

function optionalTrimmedString(value, lowercase = false) {
  if (!isRuntimeString(value)) {
    return;
  }
  const trimmed = value.trim();
  return lowercase ? trimmed.toLowerCase() : trimmed;
}

function normalizedNotes(body, source) {
  if (source === "Sacred Bharat") {
    return;
  }
  return optionalTrimmedString(body.notes);
}

function validateContactIdentity({ clientName, consent, contactEmail, contactMobile }) {
  if (consent !== true || !clientName || clientName.length > CLIENT_NAME_MAX) {
    return "Please provide your name and consent to be contacted.";
  }
  if (
    contactEmail !== undefined &&
    (!EMAIL_PATTERN.test(contactEmail) || contactEmail.length > EMAIL_MAX)
  ) {
    return "Please provide a valid email address.";
  }
  if (
    contactMobile !== undefined &&
    (!MOBILE_PATTERN.test(contactMobile) || contactMobile.length > MOBILE_MAX)
  ) {
    return "Please provide a valid mobile number.";
  }
  return contactEmail || contactMobile ? null : "Please provide an email address or mobile number.";
}

function validateIntentDetails({
  destination,
  notes,
  paxCount,
  rawSacredBharatContext,
  sacredBharatContext,
  source,
  travelStartDate,
}) {
  if (destination !== undefined && destination.length > DESTINATION_MAX) {
    return "Destination is too long.";
  }
  if (notes !== undefined && notes.length > NOTES_MAX) {
    return "Notes are too long.";
  }
  if (!ALLOWED_SOURCES.has(source)) {
    return "Invalid enquiry source.";
  }
  if (source === "Sacred Bharat" && !sacredBharatContext) {
    return "Select a Sacred Bharat trail or completed journey plan.";
  }
  if (source !== "Sacred Bharat" && rawSacredBharatContext !== undefined) {
    return "Sacred Bharat context does not match this enquiry source.";
  }
  if (
    paxCount !== undefined &&
    !(Number.isInteger(paxCount) && paxCount >= 1 && paxCount <= MAX_PAX_COUNT)
  ) {
    return "Pax count must be a whole number between 1 and 1,000.";
  }
  if (travelStartDate !== undefined && !DATE_PATTERN.test(travelStartDate)) {
    return "Travel date must use YYYY-MM-DD format.";
  }
  return null;
}

function validateOperationalTest({ operationalTestToken, synthetic }) {
  const pairingIsValid = synthetic === Boolean(operationalTestToken);
  const tokenIsValid =
    operationalTestToken === undefined || OPERATIONAL_TEST_TOKEN_PATTERN.test(operationalTestToken);
  return pairingIsValid && tokenIsValid ? null : "Invalid operational test session.";
}

function normalizeBody(body) {
  if (!(body && isRuntimeObject(body)) || Array.isArray(body)) {
    return { error: "Invalid request body.", ok: false };
  }

  const clientName = optionalTrimmedString(body.clientName) ?? "";
  const contactEmail = optionalTrimmedString(body.contactEmail, true);
  const contactMobile = optionalTrimmedString(body.contactMobile);
  const destination = optionalTrimmedString(body.destination);
  const source = optionalTrimmedString(body.source) ?? "";
  const notes = normalizedNotes(body, source);
  const sacredBharatContext = normalizeSacredBharatIntentContext(body.sacredBharatContext);
  const travelStartDate = optionalTrimmedString(body.travelStartDate);
  const paxCount = body.paxCount === undefined ? undefined : Number(body.paxCount);
  const synthetic = body.synthetic === true;
  const operationalTestToken = optionalTrimmedString(body.operationalTestToken);

  const error =
    validateContactIdentity({
      clientName,
      consent: body.consent,
      contactEmail,
      contactMobile,
    }) ??
    validateIntentDetails({
      destination,
      notes,
      paxCount,
      rawSacredBharatContext: body.sacredBharatContext,
      sacredBharatContext,
      source,
      travelStartDate,
    }) ??
    validateOperationalTest({ operationalTestToken, synthetic });
  if (error) {
    return { error, ok: false };
  }

  return {
    ok: true,
    value: {
      clientName,
      consent: true,
      ...propertiesWhen(contactEmail, () => ({ contactEmail })),
      ...propertiesWhen(contactMobile, () => ({ contactMobile })),
      ...propertiesWhen(destination, () => ({ destination })),
      ...propertiesWhen(notes, () => ({ notes })),
      ...propertiesWhen(operationalTestToken, () => ({ operationalTestToken })),
      ...propertiesWhen(!(paxCount === undefined), () => ({ paxCount })),
      ...propertiesWhen(sacredBharatContext, () => ({ sacredBharatContext })),
      source,
      ...propertiesWhen(synthetic, () => ({ synthetic: true })),
      ...propertiesWhen(travelStartDate, () => ({ travelStartDate })),
    },
  };
}

function canonicalSubmission(value, requestKey) {
  return requestKey || JSON.stringify(value);
}

async function botProtectionRejection(body, value, request, turnstileVerifier) {
  if (isHoneypotTripped(body.company) || !validateFormTiming(body.formLoadedAt).ok) {
    return reject();
  }
  const spamCheck = detectSpamContent({
    email: value.contactEmail || "",
    message: value.notes || "",
    name: value.clientName,
    subject: value.source,
  });
  if (spamCheck.spam) {
    return reject();
  }
  if (!isTurnstileConfigured()) {
    return null;
  }
  const captcha = await turnstileVerifier(body.turnstileToken, getClientIp(request));
  return captcha.ok ? null : reject("Security verification failed. Please refresh and try again.");
}

async function prepareInboundIntentSubmission(request, { checkRateLimit, turnstileVerifier }) {
  if (!isAllowedSiteOrigin(request)) {
    return { ok: false, response: reject("Forbidden.", 403) };
  }
  const gateway = configuredGateway();
  if (!gateway) {
    return {
      ok: false,
      response: jsonResponse({ error: "Enquiry service is temporarily unavailable." }, 503),
    };
  }
  if (
    process.env.NODE_ENV === "production" &&
    (isTurnstilePartiallyConfigured() || !isTurnstileConfigured())
  ) {
    return {
      ok: false,
      response: jsonResponse({ error: "Enquiry service is temporarily unavailable." }, 503),
    };
  }
  const bodyResult = await readJsonBodyWithinLimit(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    const tooLarge = bodyResult.reason === "too_large";
    return {
      ok: false,
      response: reject(
        tooLarge ? "Request is too large." : "Invalid request body.",
        tooLarge ? 413 : 400
      ),
    };
  }
  const body = bodyResult.value;
  if (!isJsonObject(body)) {
    return { ok: false, response: reject("Invalid request body.") };
  }
  const normalized = normalizeBody(body);
  if (!normalized.ok) {
    return { ok: false, response: reject(normalized.error) };
  }
  const { value } = normalized;
  const botRejection = await botProtectionRejection(body, value, request, turnstileVerifier);
  if (botRejection) {
    return { ok: false, response: botRejection };
  }
  const requestKey = request.headers.get("idempotency-key")?.trim() || "";
  if (requestKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return { ok: false, response: reject("Invalid idempotency key.") };
  }
  const rateLimit = checkRateLimit(getClientIp(request));
  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: jsonResponse(
        { error: "Too many enquiries. Please wait a few minutes and try again." },
        429,
        { "Retry-After": String(rateLimit.retryAfterSec) }
      ),
    };
  }
  return { gateway, ok: true, requestKey, value };
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
  const prepared = await prepareInboundIntentSubmission(request, {
    checkRateLimit,
    turnstileVerifier,
  });
  if (!prepared.ok) {
    return prepared.response ?? reject();
  }
  const { gateway, requestKey, value } = prepared;

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
    if (result.status === "disabled") {
      return jsonResponse(
        {
          accepted: false,
          error: "Enquiry intake is temporarily paused. Please try again shortly.",
          ...propertiesWhen(result.effects, () => ({ effects: result.effects })),
          status: result.status,
        },
        503
      );
    }
    return jsonResponse(
      {
        accepted: result.status === "created" || result.status === "duplicate",
        duplicate: result.status === "duplicate",
        ...propertiesWhen(result.effects, () => ({ effects: result.effects })),
        ...propertiesWhen(result.intentId !== undefined, () => ({ intentId: result.intentId })),
        status: result.status,
      },
      result.status === "created" ? 201 : 200
    );
  } catch {
    // Keep provider, URL, secret, and Convex details out of the public error.
    return jsonResponse({ error: "Enquiry service is temporarily unavailable." }, 503);
  }
}

export async function POST(request) {
  return await withApiRequestLogging(request, "/api/inbound-intents", () =>
    handleInboundIntentRequest(request)
  );
}
