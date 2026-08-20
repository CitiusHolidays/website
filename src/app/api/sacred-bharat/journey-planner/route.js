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
import {
  isTurnstileConfigured,
  isTurnstilePartiallyConfigured,
  verifyTurnstileToken,
} from "@/lib/contact/turnstile";
import { isJsonObject, readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { resolveOperationalControl } from "@/lib/operationalControls/runtimeService";
import { prepareAiProviderBoundary } from "@convex/crm/lib/majorCapabilityPreparation";

export const maxDuration = 60;

const MAX_BODY_BYTES = 16 * 1024;
const PLANNER_POLICY = AI_RUNTIME_POLICIES.journeyPlanner;

async function journeyPlannerAvailabilityResponse(resolveControl) {
  try {
    const control = await resolveControl("ai.journey_planner");
    if (!control.enabled) {
      return new Response(JSON.stringify({ error: "Journey planner is currently paused." }), {
        headers: { "Content-Type": "application/json" },
        status: 503,
      });
    }
    return null;
  } catch (error) {
    console.error("Journey planner operational-control error:", error);
    return new Response(JSON.stringify({ error: "Journey planner is temporarily unavailable." }), {
      headers: { "Content-Type": "application/json" },
      status: 503,
    });
  }
}

async function journeyPlannerBotProtectionResponse(req, body, turnstileVerifier) {
  if (
    process.env.NODE_ENV === "production" &&
    (isTurnstilePartiallyConfigured() || !isTurnstileConfigured())
  ) {
    return new Response(JSON.stringify({ error: "Journey planner is temporarily unavailable." }), {
      headers: { "Content-Type": "application/json" },
      status: 503,
    });
  }
  if (!isTurnstileConfigured()) {
    return null;
  }
  const challenge = await turnstileVerifier(body.turnstileToken, getClientIp(req));
  return challenge.ok
    ? null
    : new Response(JSON.stringify({ error: "Security verification failed." }), {
        headers: { "Content-Type": "application/json" },
        status: 403,
      });
}

export async function handleJourneyPlannerRequest(
  req,
  {
    consumeRateLimit = consumeSharedAiRateLimit,
    resolveControl = resolveOperationalControl,
    turnstileVerifier = verifyTurnstileToken,
  } = {}
) {
  try {
    if (!isAllowedSiteOrigin(req)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { "Content-Type": "application/json" },
        status: 403,
      });
    }

    const bodyResult = await readJsonBodyWithinLimit(req, MAX_BODY_BYTES);
    if (!bodyResult.ok) {
      return new Response(
        JSON.stringify({
          error: bodyResult.reason === "too_large" ? "Request is too large." : "Invalid request.",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: bodyResult.reason === "too_large" ? 413 : 400,
        }
      );
    }

    if (!isJsonObject(bodyResult.value)) {
      return new Response(JSON.stringify({ error: "Invalid request." }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "Journey planner is not configured." }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    const unavailableResponse = await journeyPlannerAvailabilityResponse(resolveControl);
    if (unavailableResponse) {
      return unavailableResponse;
    }

    const botProtectionResponse = await journeyPlannerBotProtectionResponse(
      req,
      bodyResult.value,
      turnstileVerifier
    );
    if (botProtectionResponse) {
      return botProtectionResponse;
    }

    let rateLimit;
    try {
      rateLimit = await consumeRateLimit({
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

    const body = bodyResult.value;
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
    const providerBoundary = prepareAiProviderBoundary({
      capability: "journeyPlanner",
      maxOutputTokens: PLANNER_POLICY.maxOutputTokens,
      messages: [{ content: userMessage, role: "user" }],
      models: PLANNER_POLICY.models,
      system: sacredBharatJourneyPlannerSystemPrompt(context),
      totalTimeoutMs: PLANNER_POLICY.totalTimeoutMs,
    });

    return createAiProviderResponse({
      feature: "journeyPlanner",
      minimumAttemptMs: PLANNER_POLICY.minimumAttemptMs,
      models: providerBoundary.models,
      onError: () => "Journey planner could not complete that response. Please try again.",
      onTelemetry: recordAiTelemetry,
      providerAttemptTimeoutMs: PLANNER_POLICY.providerAttemptTimeoutMs,
      signal: req.signal,
      startAttempt: ({ model, signal, timeoutMs }) =>
        streamText({
          abortSignal: signal,
          maxOutputTokens: providerBoundary.maxOutputTokens,
          maxRetries: PLANNER_POLICY.maxRetries,
          messages: providerBoundary.messages,
          model: openrouter.chat(model, {
            extraBody: { provider: { require_parameters: true } },
          }),
          providerOptions: {
            openrouter: {
              reasoning: { effort: "none", exclude: true },
              usage: { include: true },
            },
          },
          system: providerBoundary.system,
          temperature: 0.4,
          timeout: {
            chunkMs: Math.min(PLANNER_POLICY.chunkTimeoutMs, timeoutMs),
            totalMs: timeoutMs,
          },
        }),
      totalTimeoutMs: providerBoundary.totalTimeoutMs,
    });
  } catch (error) {
    console.error("Sacred Bharat journey planner error:", error);
    return new Response(
      JSON.stringify({
        error: "Sacred Bharat Journey Planner could not complete that response. Please try again.",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

export async function POST(request) {
  return await withApiRequestLogging(request, "/api/sacred-bharat/journey-planner", () =>
    handleJourneyPlannerRequest(request)
  );
}
