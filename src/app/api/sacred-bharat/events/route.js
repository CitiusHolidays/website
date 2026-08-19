import { fetchMutation } from "convex/nextjs";
import { anyApi } from "convex/server";
import { getClientIp, isAllowedSiteOrigin } from "@/lib/contact/spam-guard";
import { isJsonObject, readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { checkSacredBharatEventRateLimit } from "@/lib/sacredBharat/eventRateLimit";

const MAX_BODY_BYTES = 4096;
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
    typeof body.event === "string" &&
    typeof body.eventId === "string" &&
    typeof body.playerToken === "string"
  );
}

export async function handleSacredBharatEditionEvent(
  request,
  { fetchMutationImpl = fetchMutation, rateLimit = checkSacredBharatEventRateLimit } = {}
) {
  if (!isAllowedSiteOrigin(request)) {
    return json({ error: "Forbidden." }, 403);
  }
  const gateway = configuredGateway();
  if (!gateway) {
    return json({ error: "Event service is temporarily unavailable." }, 503);
  }
  const bodyResult = await readJsonBodyWithinLimit(request, MAX_BODY_BYTES);
  if (!(bodyResult.ok && isJsonObject(bodyResult.value) && isBoundedEvent(bodyResult.value))) {
    return json({ error: "Invalid event." }, bodyResult.reason === "too_large" ? 413 : 400);
  }
  const limit = rateLimit(getClientIp(request));
  if (!limit.allowed) {
    return json({ error: "Too many events." }, 429, {
      "Retry-After": String(limit.retryAfterSec),
    });
  }
  try {
    await fetchMutationImpl(
      anyApi.sacredBharatEditionEvents.recordEdition001EventGateway,
      { ...bodyResult.value, gatewaySecret: gateway.gatewaySecret },
      { url: gateway.convexUrl }
    );
    return json({ accepted: true }, 202);
  } catch {
    return json({ error: "Event service is temporarily unavailable." }, 503);
  }
}

export async function POST(request) {
  return await withApiRequestLogging(request, "/api/sacred-bharat/events", () =>
    handleSacredBharatEditionEvent(request)
  );
}
