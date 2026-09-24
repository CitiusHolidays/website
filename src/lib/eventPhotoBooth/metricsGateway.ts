import { createHmac } from "node:crypto";
import { isRateLimitError } from "@convex-dev/rate-limiter";
import { fetchMutation } from "convex/nextjs";
import { fetchConvexTokenFromHeaders } from "@/lib/auth-server";
import { getClientIp, isAllowedSiteOrigin } from "@/lib/contact/spam-guard";
import { readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";
import { boothApi } from "./api";
import { isBoothMetricBatch } from "./contracts";

function json(
  body: { error: string } | { accepted: true },
  status: number,
  extra: Record<string, string> = {}
) {
  return Response.json(body, { headers: { "Cache-Control": "no-store", ...extra }, status });
}
export async function handleBoothMetrics(
  request: Request,
  { send = fetchMutation, tokenFor = fetchConvexTokenFromHeaders } = {}
) {
  if (!isAllowedSiteOrigin(request)) {
    return json({ error: "Forbidden." }, 403);
  }
  const gatewaySecret = process.env.EVENT_PHOTO_BOOTH_GATEWAY_SECRET?.trim();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!(gatewaySecret && url)) {
    return json({ error: "Event metrics unavailable." }, 503);
  }
  const result = await readJsonBodyWithinLimit(request, 4096);
  const payload = "value" in result ? result.value : null;
  if (!(result.ok && isBoothMetricBatch(payload))) {
    return json(
      { error: "Invalid metrics." },
      "reason" in result && result.reason === "too_large" ? 413 : 400
    );
  }
  const day = Math.floor(Date.now() / 86_400_000);
  const rateLimitKeyHash = createHmac("sha256", gatewaySecret)
    .update(`${day}\0${getClientIp(request)}`)
    .digest("hex");
  try {
    const token = await tokenFor(request.headers);
    await send(
      boothApi.recordMetricGateway,
      { events: payload.events, gatewaySecret, rateLimitKeyHash },
      { token: token ?? undefined, url }
    );
    return json({ accepted: true }, 202);
  } catch (error) {
    if (isRateLimitError(error)) {
      return json({ error: "Too many events." }, 429, {
        "Retry-After": String(Math.max(1, Math.ceil(error.data.retryAfter / 1000))),
      });
    }
    return json({ error: "Event metrics unavailable." }, 503);
  }
}
