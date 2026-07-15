import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { citiusChatTools, systemPrompt } from "@/lib/ai/citiusTravelAssistant";
import { createAiProviderResponse } from "@/lib/ai/providerStream";
import { AI_RUNTIME_POLICIES } from "@/lib/ai/runtimePolicy";
import { consumeSharedAiRateLimit, recordAiTelemetry } from "@/lib/ai/runtimeService";
import { getClientIp, isAllowedSiteOrigin } from "@/lib/contact/spam-guard";

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
  const details =
    typeof error === "string" ? error : JSON.stringify(error, Object.getOwnPropertyNames(error));
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

export async function POST(req) {
  try {
    if (!isAllowedSiteOrigin(req)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { "Content-Type": "application/json" },
        status: 403,
      });
    }

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_CHAT_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Chat request is too large." }), {
        headers: { "Content-Type": "application/json" },
        status: 413,
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "Chat service is not configured." }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    let rateLimit;
    try {
      rateLimit = await consumeSharedAiRateLimit({
        feature: "concierge",
        rawKey: getClientIp(req),
      });
    } catch (error) {
      console.error("Chat rate-limit storage error:", error);
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

    const { messages } = await req.json();
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

    return createAiProviderResponse({
      feature: "concierge",
      minimumAttemptMs: CHAT_POLICY.minimumAttemptMs,
      models: CHAT_POLICY.models,
      onError: chatStreamErrorMessage,
      onTelemetry: recordAiTelemetry,
      providerAttemptTimeoutMs: CHAT_POLICY.providerAttemptTimeoutMs,
      signal: req.signal,
      startAttempt: ({ model, signal, timeoutMs }) =>
        streamText({
          abortSignal: signal,
          maxOutputTokens: CHAT_POLICY.maxOutputTokens,
          maxRetries: CHAT_POLICY.maxRetries,
          messages: convertedMessages,
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
          system: systemPrompt,
          temperature: 0.35,
          timeout: {
            chunkMs: Math.min(CHAT_POLICY.chunkTimeoutMs, timeoutMs),
            totalMs: timeoutMs,
          },
          tools: citiusChatTools,
        }),
      totalTimeoutMs: CHAT_POLICY.totalTimeoutMs,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
