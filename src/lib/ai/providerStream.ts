import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FinishReason,
  toUIMessageChunk,
  type UIMessageChunk,
} from "ai";
import type { AiFeature } from "./runtimePolicy";

interface ProviderRawPart {
  type: string;
  [key: string]: unknown;
}

interface ProviderAttemptStream {
  stream: ReadableStream<ProviderRawPart>;
}

interface ProviderStreamAttempt {
  attempt: number;
  fallback: boolean;
  model: string;
  remainingMs: number;
  signal?: AbortSignal;
  timeoutMs: number;
}

export interface ProviderStreamTelemetry {
  fallback: boolean;
  feature: AiFeature;
  finishReason?: string;
  inputTokens?: number;
  latencyMs: number;
  model: string;
  outputTokens?: number;
  terminalState: "completed" | "failed" | "interrupted";
}

interface ProviderStreamOptions {
  feature: AiFeature;
  generateMessageId?: () => string;
  minimumAttemptMs?: number;
  models: readonly string[];
  now?: () => number;
  onError?: (error: unknown) => string;
  onTelemetry?: (event: ProviderStreamTelemetry) => Promise<unknown> | unknown;
  providerAttemptTimeoutMs?: number;
  signal?: AbortSignal;
  startAttempt: (
    attempt: ProviderStreamAttempt
  ) => Promise<ProviderAttemptStream> | ProviderAttemptStream;
  totalTimeoutMs: number;
}

const DEFAULT_STREAM_ERROR = "The AI service could not complete that response. Please try again.";

function isCommitChunk(chunk: UIMessageChunk): boolean {
  switch (chunk.type) {
    case "text-delta":
    case "reasoning-delta":
      return chunk.delta.trim().length > 0;
    case "tool-input-available":
    case "tool-input-error":
    case "tool-output-available":
    case "tool-output-error":
    case "tool-output-denied":
    case "source-url":
    case "source-document":
    case "file":
      return true;
    default:
      return false;
  }
}

function errorDetails(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }
  return String(error).toLowerCase();
}

function isTimeoutFailure(error: unknown): boolean {
  const details = errorDetails(error);
  return details.includes("timeout") || details.includes("timed out");
}

function usageNumber(usage: unknown, key: "inputTokens" | "outputTokens") {
  if (!usage || typeof usage !== "object") {
    return;
  }
  const value = (usage as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function safelyRecordTelemetry(
  callback: ProviderStreamOptions["onTelemetry"],
  event: ProviderStreamTelemetry
) {
  try {
    await callback?.(event);
  } catch {
    // Operational telemetry must never break or replace a user response.
  }
}

export function createAiProviderUiStream(options: ProviderStreamOptions) {
  const {
    feature,
    generateMessageId = () => crypto.randomUUID(),
    minimumAttemptMs = 1,
    models,
    now = Date.now,
    onError = () => DEFAULT_STREAM_ERROR,
    onTelemetry,
    providerAttemptTimeoutMs = Number.POSITIVE_INFINITY,
    signal,
    startAttempt,
    totalTimeoutMs,
  } = options;
  const responseMessageId = generateMessageId();

  return createUIMessageStream({
    execute: async ({ writer }) => {
      const startedAt = now();
      let lastError: unknown = new Error("No AI provider was attempted");
      let lastModel = models.at(-1) ?? "unconfigured";
      let lastFallback = models.length > 1;

      writer.write({ messageId: responseMessageId, type: "start" });

      for (const [index, configuredModel] of models.entries()) {
        const remainingMs = totalTimeoutMs - (now() - startedAt);
        if (remainingMs < minimumAttemptMs) {
          lastError = new Error("AI route budget exhausted", { cause: lastError });
          break;
        }
        if (signal?.aborted) {
          writer.write({ reason: "cancelled", type: "abort" });
          await safelyRecordTelemetry(onTelemetry, {
            fallback: index > 0,
            feature,
            latencyMs: now() - startedAt,
            model: configuredModel,
            terminalState: "interrupted",
          });
          return;
        }

        const fallback = index > 0;
        lastModel = configuredModel;
        lastFallback = fallback;
        let committed = false;
        let selectedModel = configuredModel;
        let finishReason: FinishReason | undefined;
        let totalUsage: unknown;
        const bufferedChunks: UIMessageChunk[] = [];

        try {
          const result = await startAttempt({
            attempt: index + 1,
            fallback,
            model: configuredModel,
            remainingMs,
            signal,
            timeoutMs: Math.min(providerAttemptTimeoutMs, remainingMs),
          });

          for await (const part of result.stream) {
            if (part.type === "error") {
              throw part.error;
            }
            if (part.type === "abort") {
              const abortError = new DOMException(String(part.reason ?? "aborted"), "AbortError");
              if (!(signal?.aborted || committed)) {
                throw abortError;
              }
              writer.write({
                reason: signal?.aborted ? "cancelled" : "interrupted",
                type: "abort",
              });
              await safelyRecordTelemetry(onTelemetry, {
                fallback,
                feature,
                latencyMs: now() - startedAt,
                model: selectedModel,
                terminalState: "interrupted",
              });
              return;
            }
            if (part.type === "finish-step") {
              const response = part.response;
              if (response && typeof response === "object") {
                const modelId = (response as Record<string, unknown>).modelId;
                if (typeof modelId === "string" && modelId) {
                  selectedModel = modelId;
                }
              }
            }
            if (part.type === "finish") {
              finishReason =
                typeof part.finishReason === "string"
                  ? (part.finishReason as FinishReason)
                  : undefined;
              totalUsage = part.totalUsage;
              continue;
            }
            if (part.type === "start") {
              continue;
            }

            const chunk = toUIMessageChunk(part as never, {
              sendFinish: false,
              sendReasoning: true,
              sendSources: false,
              sendStart: false,
            }) as UIMessageChunk | undefined;
            if (!chunk) {
              continue;
            }

            if (committed) {
              writer.write(chunk);
            } else {
              bufferedChunks.push(chunk);
              if (isCommitChunk(chunk)) {
                committed = true;
                for (const bufferedChunk of bufferedChunks) {
                  writer.write(bufferedChunk);
                }
                bufferedChunks.length = 0;
              }
            }
          }

          if (!committed) {
            throw new Error("AI provider returned no usable output");
          }

          writer.write({ finishReason, type: "finish" });
          await safelyRecordTelemetry(onTelemetry, {
            fallback,
            feature,
            finishReason,
            inputTokens: usageNumber(totalUsage, "inputTokens"),
            latencyMs: now() - startedAt,
            model: selectedModel,
            outputTokens: usageNumber(totalUsage, "outputTokens"),
            terminalState: "completed",
          });
          return;
        } catch (error) {
          lastError = error;
          if (signal?.aborted) {
            writer.write({ reason: "cancelled", type: "abort" });
            await safelyRecordTelemetry(onTelemetry, {
              fallback,
              feature,
              latencyMs: now() - startedAt,
              model: selectedModel,
              terminalState: "interrupted",
            });
            return;
          }
          if (committed) {
            const timedOut = isTimeoutFailure(error);
            if (timedOut) {
              writer.write({ reason: "timeout", type: "abort" });
            } else {
              writer.write({ errorText: onError(error), type: "error" });
            }
            await safelyRecordTelemetry(onTelemetry, {
              fallback,
              feature,
              latencyMs: now() - startedAt,
              model: selectedModel,
              terminalState: timedOut ? "interrupted" : "failed",
            });
            return;
          }
        }
      }

      await safelyRecordTelemetry(onTelemetry, {
        fallback: lastFallback,
        feature,
        latencyMs: now() - startedAt,
        model: lastModel,
        terminalState: "failed",
      });
      throw lastError;
    },
    generateId: generateMessageId,
    onError,
  });
}

export function createAiProviderResponse(options: ProviderStreamOptions): Response {
  return createUIMessageStreamResponse({
    stream: createAiProviderUiStream(options),
  });
}
