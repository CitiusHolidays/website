import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { getClientIp, isAllowedSiteOrigin } from "@/lib/contact/spam-guard";
import {
  buildSacredBharatPlannerContext,
  buildDefaultPlannerUserMessage,
  CITIUS_CHAT_MODEL,
  sacredBharatJourneyPlannerSystemPrompt,
} from "@/lib/ai/sacredBharatJourneyPlanner";

export const maxDuration = 60;

const MAX_BODY_BYTES = 16 * 1024;
const PLANNER_WINDOW_MS = 10 * 60 * 1000;
const PLANNER_MAX_REQUESTS = 12;

/** @type {Map<string, { count: number; resetAt: number }>} */
const plannerBuckets = new Map();

function checkPlannerRateLimit(key) {
  const now = Date.now();
  let bucket = plannerBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + PLANNER_WINDOW_MS };
    plannerBuckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > PLANNER_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true };
}

export async function POST(req) {
  try {
    if (!isAllowedSiteOrigin(req)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { "Content-Type": "application/json" },
        status: 403,
      });
    }

    const clientIp = getClientIp(req);
    const rateLimit = checkPlannerRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many planner requests. Please try again shortly." }),
        {
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfterSec),
          },
          status: 429,
        }
      );
    }

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Request is too large." }), {
        headers: { "Content-Type": "application/json" },
        status: 413,
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "Journey planner is not configured." }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    const body = await req.json();
    const visitedTempleIds = Array.isArray(body.visitedTempleIds)
      ? body.visitedTempleIds.slice(0, 40).map(String)
      : [];
    const focusTempleId = body.focusTempleId ? String(body.focusTempleId) : undefined;
    const trailSlug = body.trailSlug ? String(body.trailSlug) : undefined;
    const wishlistTrailSlugs = Array.isArray(body.wishlistTrailSlugs)
      ? body.wishlistTrailSlugs.slice(0, 12).map(String)
      : [];

    const context = buildSacredBharatPlannerContext({
      focusTempleId,
      trailSlug,
      visitedTempleIds,
      wishlistTrailSlugs,
    });

    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    const userMessage = buildDefaultPlannerUserMessage(context);

    const result = streamText({
      abortSignal: req.signal,
      maxOutputTokens: 1200,
      maxRetries: 2,
      messages: [{ content: userMessage, role: "user" }],
      model: openrouter.chat(CITIUS_CHAT_MODEL),
      system: sacredBharatJourneyPlannerSystemPrompt(context),
      temperature: 0.4,
    });

    return result.toUIMessageStreamResponse({
      onError: () => "Journey planner could not complete that response. Please try again.",
    });
  } catch (error) {
    console.error("Sacred Bharat journey planner error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate journey plan." }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
