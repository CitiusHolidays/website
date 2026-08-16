import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type FinishReason,
  toUIMessageChunk,
  type UIMessageChunk,
} from "ai";
import type { JsonObject, JsonValue } from "@/lib/jsonValue";
import { isRuntimeNumber, isRuntimeObject, isRuntimeString } from "../runtimeValues";
import { type AiFeature, planProviderAttempt } from "./runtimePolicy";

type ProviderPartValue = DOMException | Error | JsonValue;

interface ProviderRawPart {
  delta?: string;
  error?: DOMException | Error | JsonValue;
  finishReason?: string;
  reason?: string;
  response?: JsonObject;
  totalUsage?: JsonValue;
  type: string;
  [key: string]: ProviderPartValue;
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
  onError?: (cause: unknown) => string;
  onTelemetry?: (event: ProviderStreamTelemetry) => JsonValue | Promise<JsonValue>;
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

function errorDetails(cause: unknown): string {
  if (cause instanceof Error) {
    return `${cause.name} ${cause.message}`.toLowerCase();
  }
  return String(cause).toLowerCase();
}

function isTimeoutFailure(cause: unknown): boolean {
  const details = errorDetails(cause);
  return details.includes("timeout") || details.includes("timed out");
}

function usageNumber(usage: JsonValue, key: "inputTokens" | "outputTokens") {
  if (!(usage && isRuntimeObject(usage) && !Array.isArray(usage))) {
    return;
  }
  const value = usage[key];
  return isRuntimeNumber(value) && Number.isFinite(value) ? value : undefined;
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
      let lastError = new Error("No AI provider was attempted");
      let lastModel = models.at(-1) ?? "unconfigured";
      let lastFallback = models.length > 1;

      writer.write({ messageId: responseMessageId, type: "start" });

      for (const [index, configuredModel] of models.entries()) {
        const attemptPlan = planProviderAttempt({
          index,
          minimumAttemptMs,
          model: configuredModel,
          now: now(),
          providerAttemptTimeoutMs,
          startedAt,
          totalTimeoutMs,
        });
        if (!attemptPlan) {
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

        const { fallback, remainingMs, timeoutMs } = attemptPlan;
        lastModel = configuredModel;
        lastFallback = fallback;
        let committed = false;
        let selectedModel = configuredModel;
        let finishReason: FinishReason | undefined;
        let totalUsage: JsonValue;
        const bufferedChunks: UIMessageChunk[] = [];

        try {
          const result = await startAttempt({
            attempt: attemptPlan.attempt,
            fallback,
            model: configuredModel,
            remainingMs,
            signal,
            timeoutMs,
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
              if (response && isRuntimeObject(response)) {
                const modelId = response.modelId;
                if (isRuntimeString(modelId) && modelId) {
                  selectedModel = modelId;
                }
              }
            }
            if (part.type === "finish") {
              // SAFETY: finish parts come from the AI SDK stream and its finishReason field uses FinishReason values.
              finishReason = isRuntimeString(part.finishReason)
                ? (part.finishReason as FinishReason)
                : undefined;
              totalUsage = part.totalUsage;
              continue;
            }
            if (part.type === "start") {
              continue;
            }

            // SAFETY: non-lifecycle provider parts are exactly the stream-part union accepted by toUIMessageChunk.
            const chunk = toUIMessageChunk(part as never, {
              sendFinish: false,
              sendReasoning: true,
              sendSources: false,
              sendStart: false,
            });
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
          lastError = error instanceof Error ? error : new Error(String(error));
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
