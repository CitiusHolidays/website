import { executeAiProviderOrchestration } from "@convex/crm/lib/majorCapabilityPreparation";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { citiusChatTools, systemPrompt } from "@/lib/ai/citiusTravelAssistant";
import { createAiProviderResponse } from "@/lib/ai/providerStream";
import { AI_RUNTIME_POLICIES } from "@/lib/ai/runtimePolicy";
import { consumeSharedAiRateLimit, recordAiTelemetry } from "@/lib/ai/runtimeService";
import { getClientIp, isAllowedSiteOrigin } from "@/lib/contact/spam-guard";
import {
  isTurnstileConfigured,
  isTurnstilePartiallyConfigured,
  verifyTurnstileToken,
} from "@/lib/contact/turnstile";
import { isJsonObject, readJsonBodyWithinLimit } from "@/lib/http/readJsonBody";
import { withApiRequestLogging } from "@/lib/observability/api-log";
import { resolveOperationalControl } from "@/lib/operationalControls/runtimeService";
import { isRuntimeString } from "../../../lib/runtimeValues";

export const maxDuration = 60;

const MAX_CHAT_BODY_BYTES = 64 * 1024;
const MAX_CHAT_MESSAGES = 20;
const MAX_CHAT_MESSAGE_CHARS = 4000;
const CHAT_POLICY = AI_RUNTIME_POLICIES.concierge;

function normalizeChatMessage(msg) {
  const role = msg?.role === "assistant" || msg?.role === "user" ? msg.role : "user";
  const rawParts = Array.isArray(msg?.parts)
    ? msg.parts
    : [{ text: msg?.content || "", type: "text" }];
  const parts = rawParts.flatMap((part) => {
    if (part?.type !== "text") {
      return [];
    }
    const text = String(part.text || "").slice(0, MAX_CHAT_MESSAGE_CHARS);
    return text.trim().length > 0 ? [{ text, type: "text" }] : [];
  });

  return {
    id: String(msg?.id || crypto.randomUUID()),
    parts,
    role,
  };
}

function chatStreamErrorMessage(error) {
  const details = isRuntimeString(error)
    ? error
    : JSON.stringify(error, Object.getOwnPropertyNames(error));
  if (
    details.includes("ResourceExhausted") ||
    details.includes("provider_unavailable") ||
    details.includes("Worker local total request limit")
  ) {
    return [
      "Citius Concierge is temporarily at model capacity.",
      "",
      "Please try again in a moment, or share your destination, dates, traveler count, departure city, and travel purpose so the Citius team can pick it up directly.",
    ].join("\n");
  }
  return "Citius Concierge could not complete that response. Please try again.";
}

// Initialize OpenRouter with the API key from environment variables
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

async function chatAvailabilityResponse(resolveControl) {
  try {
    const control = await resolveControl("ai.concierge");
    if (!control.enabled) {
      return new Response(JSON.stringify({ error: "Citius Concierge is currently paused." }), {
        headers: { "Content-Type": "application/json" },
        status: 503,
      });
    }
    return null;
  } catch {
    return new Response(JSON.stringify({ error: "Chat service is temporarily unavailable." }), {
      headers: { "Content-Type": "application/json" },
      status: 503,
    });
  }
}

export async function handleChatRequest(
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

    const body = await readJsonBodyWithinLimit(req, MAX_CHAT_BODY_BYTES);
    if (!body.ok) {
      return new Response(
        JSON.stringify({
          error:
            body.reason === "too_large" ? "Chat request is too large." : "Invalid chat request.",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: body.reason === "too_large" ? 413 : 400,
        }
      );
    }

    if (!isJsonObject(body.value)) {
      return new Response(JSON.stringify({ error: "Invalid chat request." }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (
      process.env.NODE_ENV === "production" &&
      (isTurnstilePartiallyConfigured() || !isTurnstileConfigured())
    ) {
      return new Response(JSON.stringify({ error: "Chat service is temporarily unavailable." }), {
        headers: { "Content-Type": "application/json" },
        status: 503,
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "Chat service is not configured." }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    const unavailableResponse = await chatAvailabilityResponse(resolveControl);
    if (unavailableResponse) {
      return unavailableResponse;
    }

    if (isTurnstileConfigured()) {
      const challenge = await turnstileVerifier(body.value.turnstileToken, getClientIp(req));
      if (!challenge.ok) {
        return new Response(
          JSON.stringify({ error: "Security verification failed. Please refresh and try again." }),
          {
            headers: { "Content-Type": "application/json" },
            status: 403,
          }
        );
      }
    }

    let rateLimit;
    try {
      rateLimit = await consumeRateLimit({
        feature: "concierge",
        rawKey: getClientIp(req),
      });
    } catch {
      return new Response(JSON.stringify({ error: "Chat service is temporarily unavailable." }), {
        headers: { "Content-Type": "application/json" },
        status: 503,
      });
    }
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many chat requests. Please try again shortly." }),
        {
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfterSec),
          },
          status: 429,
        }
      );
    }

    const { messages } = body.value;
    if (!Array.isArray(messages) || messages.length > MAX_CHAT_MESSAGES) {
      return new Response(JSON.stringify({ error: "Invalid chat request." }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    const uiMessages = messages.flatMap((msg) => {
      const normalized = normalizeChatMessage(msg);
      return normalized.parts.length > 0 ? [normalized] : [];
    });
    const convertedMessages = await convertToModelMessages(uiMessages);
    return await executeAiProviderOrchestration(
      {
        capability: "concierge",
        maxOutputTokens: CHAT_POLICY.maxOutputTokens,
        messages: convertedMessages,
        models: CHAT_POLICY.models,
        system: systemPrompt,
        totalTimeoutMs: CHAT_POLICY.totalTimeoutMs,
      },
      async (providerBoundary) => {
        const finalUnavailableResponse = await chatAvailabilityResponse(resolveControl);
        if (finalUnavailableResponse) {
          return finalUnavailableResponse;
        }
        return createAiProviderResponse({
          feature: "concierge",
          minimumAttemptMs: CHAT_POLICY.minimumAttemptMs,
          models: providerBoundary.models,
          onError: chatStreamErrorMessage,
          onTelemetry: recordAiTelemetry,
          providerAttemptTimeoutMs: CHAT_POLICY.providerAttemptTimeoutMs,
          signal: req.signal,
          startAttempt: ({ model, signal, timeoutMs }) =>
            streamText({
              abortSignal: signal,
              maxOutputTokens: providerBoundary.maxOutputTokens,
              maxRetries: CHAT_POLICY.maxRetries,
              messages: providerBoundary.messages,
              model: openrouter.chat(model, {
                extraBody: {
                  provider: { require_parameters: true },
                },
              }),
              providerOptions: {
                openrouter: {
                  reasoning: {
                    effort: "none",
                    exclude: true,
                  },
                  usage: { include: true },
                },
              },
              stopWhen: stepCountIs(CHAT_POLICY.maxSteps),
              system: providerBoundary.system,
              temperature: 0.35,
              timeout: {
                chunkMs: Math.min(CHAT_POLICY.chunkTimeoutMs, timeoutMs),
                totalMs: timeoutMs,
              },
              tools: citiusChatTools,
            }),
          totalTimeoutMs: providerBoundary.totalTimeoutMs,
        });
      }
    );
  } catch {
    return new Response(
      JSON.stringify({
        error: "Citius Concierge could not complete that response. Please try again.",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

export async function POST(request) {
  return await withApiRequestLogging(request, "/api/chat", () => handleChatRequest(request));
}
