import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { getClientIp, isAllowedSiteOrigin } from "@/lib/contact/spam-guard";
import { systemPrompt } from "./sysprompt";

export const maxDuration = 60;

const MAX_CHAT_BODY_BYTES = 64 * 1024;
const MAX_CHAT_MESSAGES = 20;
const MAX_CHAT_MESSAGE_CHARS = 4000;
const CHAT_WINDOW_MS = 10 * 60 * 1000;
const CHAT_MAX_REQUESTS = 20;

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

// Initialize OpenRouter with the API key from environment variables
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

export async function POST(req) {
  try {
    if (!isAllowedSiteOrigin(req)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const clientIp = getClientIp(req);
    const rateLimit = checkChatRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many chat requests. Please try again shortly." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfterSec),
          },
        },
      );
    }

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_CHAT_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Chat request is too large." }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "Chat service is not configured." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length > MAX_CHAT_MESSAGES) {
      return new Response(JSON.stringify({ error: "Invalid chat request." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Convert messages to the format expected by the AI SDK
    const convertedMessages = messages.map((msg) => {
      const role = msg.role === "assistant" || msg.role === "user" ? msg.role : "user";
      const content = String(msg.parts?.[0]?.text || msg.content || "").slice(
        0,
        MAX_CHAT_MESSAGE_CHARS,
      );
      return { role, content };
    });

    const result = streamText({
      model: openrouter.chat("nvidia/nemotron-3-nano-30b-a3b:free"),
      messages: convertedMessages,
      // Add system message for travel context
      system: systemPrompt,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
