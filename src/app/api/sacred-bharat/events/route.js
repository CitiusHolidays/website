import { isRateLimitError } from "@convex-dev/rate-limiter";
import { fetchMutation } from "convex/nextjs";
import { anyApi } from "convex/server";
import { getClientIp, isAllowedSiteOrigin } from "@/lib/contact/spam-guard";
import { isJsonObject, readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { isRuntimeString } from "@/lib/runtimeValues";
import { sacredBharatEventRateLimitKey } from "@/lib/sacredBharat/eventRateLimit";

const MAX_BODY_BYTES = 4096;
const LINK_PREVIEW_USER_AGENT_PATTERN =
  /(?:bot|crawler|facebookexternalhit|linkedinbot|preview|slackbot|spider|telegrambot|twitterbot)/i;
const PRELOAD_PURPOSE_PATTERN = /(?:prefetch|prerender|preview)/i;
const ALLOWED_FIELDS = new Set([
  "correct",
  "edition",
  "event",
  "eventId",
  "playerToken",
  "questionId",
  "referrerToken",
  "score",
  "shareToken",
  "style",
]);

function json(payload, status, headers = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", ...headers },
    status,
  });
}

function configuredGateway() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  const gatewaySecret = process.env.SACRED_BHARAT_EVENT_GATEWAY_SECRET?.trim();
  return convexUrl && gatewaySecret ? { convexUrl, gatewaySecret } : null;
}

function isBoundedEvent(body) {
  return (
    Object.keys(body).every((key) => ALLOWED_FIELDS.has(key)) &&
    body.edition === "001" &&
    isRuntimeString(body.event) &&
    isRuntimeString(body.eventId) &&
    isRuntimeString(body.playerToken)
  );
}

function isAutomatedPreview(request) {
  const purpose = `${request.headers.get("purpose") ?? ""} ${
    request.headers.get("sec-purpose") ?? ""
  }`;
  const userAgent = request.headers.get("user-agent") ?? "";
  return PRELOAD_PURPOSE_PATTERN.test(purpose) || LINK_PREVIEW_USER_AGENT_PATTERN.test(userAgent);
}

export async function handleSacredBharatEditionEvent(
  request,
  { fetchMutationImpl = fetchMutation, rateLimitKey = sacredBharatEventRateLimitKey } = {}
) {
  if (!isAllowedSiteOrigin(request)) {
    return json({ error: "Forbidden." }, 403);
  }
  if (isAutomatedPreview(request)) {
    return json({ accepted: true, filtered: true }, 202);
  }
  const gateway = configuredGateway();
  if (!gateway) {
    return json({ error: "Event service is temporarily unavailable." }, 503);
  }
  const bodyResult = await readJsonBodyWithinLimit(request, MAX_BODY_BYTES);
  if (!(bodyResult.ok && isJsonObject(bodyResult.value) && isBoundedEvent(bodyResult.value))) {
    return json({ error: "Invalid event." }, bodyResult.reason === "too_large" ? 413 : 400);
  }
  try {
    const rateLimitKeyHash = await rateLimitKey(getClientIp(request), gateway.gatewaySecret);
    await fetchMutationImpl(
      anyApi.sacredBharatEditionEvents.recordEdition001EventGateway,
      { ...bodyResult.value, gatewaySecret: gateway.gatewaySecret, rateLimitKeyHash },
      { url: gateway.convexUrl }
    );
    return json({ accepted: true }, 202);
  } catch (error) {
    if (isRateLimitError(error)) {
      return json({ error: "Too many events." }, 429, {
        "Retry-After": String(Math.max(1, Math.ceil(error.data.retryAfter / 1000))),
      });
    }
    return json({ error: "Event service is temporarily unavailable." }, 503);
  }
}

export async function POST(request) {
  return await withApiRequestLogging(request, "/api/sacred-bharat/events", () =>
    handleSacredBharatEditionEvent(request)
  );
}
