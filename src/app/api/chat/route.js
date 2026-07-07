import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { CITIUS_CHAT_MODEL, citiusChatTools, systemPrompt } from "@/lib/ai/citiusTravelAssistant";
import { getClientIp, isAllowedSiteOrigin } from "@/lib/contact/spam-guard";

export const maxDuration = 60;

const MAX_CHAT_BODY_BYTES = 64 * 1024;
const MAX_CHAT_MESSAGES = 20;
const MAX_CHAT_MESSAGE_CHARS = 4000;
const CHAT_WINDOW_MS = 10 * 60 * 1000;
const CHAT_MAX_REQUESTS = 20;
const FALLBACK_MODELS_ENV = "OPENROUTER_FALLBACK_MODELS";
const DEFAULT_FALLBACK_MODELS = ["google/gemma-4-31b-it:free", "openai/gpt-oss-120b:free"];

/** @type {Map<string, { count: number; resetAt: number }>} */
const chatBuckets = new Map();

function checkChatRateLimit(key) {
  const now = Date.now();
  let bucket = chatBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + CHAT_WINDOW_MS };
    chatBuckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > CHAT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  if (chatBuckets.size > 10_000) {
    for (const [bucketKey, value] of chatBuckets) {
      if (now > value.resetAt) {
        chatBuckets.delete(bucketKey);
      }
    }
  }

  return { allowed: true };
}

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

function configuredOpenRouterModels() {
  const fallbackModels = String(process.env[FALLBACK_MODELS_ENV] || "")
    .split(",")
    .flatMap((model) => {
      const trimmed = model.trim();
      return trimmed ? [trimmed] : [];
    });
  return [...new Set([CITIUS_CHAT_MODEL, ...DEFAULT_FALLBACK_MODELS, ...fallbackModels])];
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

    const clientIp = getClientIp(req);
    const rateLimit = checkChatRateLimit(clientIp);
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

    const result = streamText({
      abortSignal: req.signal,
      maxOutputTokens: 900,
      maxRetries: 2,
      messages: convertedMessages,
      model: openrouter.chat(CITIUS_CHAT_MODEL),
      providerOptions: {
        openrouter: {
          models: configuredOpenRouterModels(),
          reasoning: {
            effort: "none",
            exclude: true,
          },
        },
      },
      stopWhen: stepCountIs(4),
      system: systemPrompt,
      temperature: 0.35,
      tools: citiusChatTools,
    });

    return result.toUIMessageStreamResponse({
      onError: chatStreamErrorMessage,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
