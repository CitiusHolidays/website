import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { createAiProviderResponse } from "@/lib/ai/providerStream";
import { AI_RUNTIME_POLICIES } from "@/lib/ai/runtimePolicy";
import { consumeSharedAiRateLimit, recordAiTelemetry } from "@/lib/ai/runtimeService";
import {
  buildDefaultPlannerUserMessage,
  buildSacredBharatPlannerContext,
  sacredBharatJourneyPlannerSystemPrompt,
} from "@/lib/ai/sacredBharatJourneyPlanner";
import { getClientIp, isAllowedSiteOrigin } from "@/lib/contact/spam-guard";

export const maxDuration = 60;

const MAX_BODY_BYTES = 16 * 1024;
const PLANNER_POLICY = AI_RUNTIME_POLICIES.journeyPlanner;

export async function POST(req) {
  try {
    if (!isAllowedSiteOrigin(req)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { "Content-Type": "application/json" },
        status: 403,
      });
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

    let rateLimit;
    try {
      rateLimit = await consumeSharedAiRateLimit({
        feature: "journeyPlanner",
        rawKey: getClientIp(req),
      });
    } catch (error) {
      console.error("Journey planner rate-limit storage error:", error);
      return new Response(
        JSON.stringify({ error: "Journey planner is temporarily unavailable." }),
        {
          headers: { "Content-Type": "application/json" },
          status: 503,
        }
      );
    }
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

    return createAiProviderResponse({
      feature: "journeyPlanner",
      minimumAttemptMs: PLANNER_POLICY.minimumAttemptMs,
      models: PLANNER_POLICY.models,
      onError: () => "Journey planner could not complete that response. Please try again.",
      onTelemetry: recordAiTelemetry,
      providerAttemptTimeoutMs: PLANNER_POLICY.providerAttemptTimeoutMs,
      signal: req.signal,
      startAttempt: ({ model, signal, timeoutMs }) =>
        streamText({
          abortSignal: signal,
          maxOutputTokens: PLANNER_POLICY.maxOutputTokens,
          maxRetries: PLANNER_POLICY.maxRetries,
          messages: [{ content: userMessage, role: "user" }],
          model: openrouter.chat(model, {
            extraBody: { provider: { require_parameters: true } },
          }),
          providerOptions: {
            openrouter: {
              reasoning: { effort: "none", exclude: true },
              usage: { include: true },
            },
          },
          system: sacredBharatJourneyPlannerSystemPrompt(context),
          temperature: 0.4,
          timeout: {
            chunkMs: Math.min(PLANNER_POLICY.chunkTimeoutMs, timeoutMs),
            totalMs: timeoutMs,
          },
        }),
      totalTimeoutMs: PLANNER_POLICY.totalTimeoutMs,
    });
  } catch (error) {
    console.error("Sacred Bharat journey planner error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate journey plan." }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
