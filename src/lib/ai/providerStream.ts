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
const COMMIT_CHUNK_TYPES = new Set<UIMessageChunk["type"]>([
  "tool-input-available",
  "tool-input-error",
  "tool-output-available",
  "tool-output-error",
  "tool-output-denied",
  "source-url",
  "source-document",
  "file",
]);

function isCommitChunk(chunk: UIMessageChunk): boolean {
  if ("delta" in chunk && isRuntimeString(chunk.delta) && chunk.delta.trim()) {
    return true;
  }
  return COMMIT_CHUNK_TYPES.has(chunk.type);
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

interface ProviderWriter {
  write: (chunk: UIMessageChunk) => void;
}

interface ProviderExecutionContext {
  feature: AiFeature;
  minimumAttemptMs: number;
  models: readonly string[];
  now: () => number;
  onError: (cause: unknown) => string;
  onTelemetry: ProviderStreamOptions["onTelemetry"];
  providerAttemptTimeoutMs: number;
  signal?: AbortSignal;
  startAttempt: ProviderStreamOptions["startAttempt"];
  startedAt: number;
  totalTimeoutMs: number;
  writer: ProviderWriter;
}

interface ProviderExecutionState {
  lastError: Error;
  lastFallback: boolean;
  lastModel: string;
}

interface ProviderAttemptState {
  bufferedChunks: UIMessageChunk[];
  committed: boolean;
  finishReason?: FinishReason;
  selectedModel: string;
  totalUsage?: JsonValue;
}

function writeProviderChunk(
  state: ProviderAttemptState,
  writer: ProviderWriter,
  chunk: UIMessageChunk
) {
  if (state.committed) {
    writer.write(chunk);
    return;
  }
  state.bufferedChunks.push(chunk);
  if (!isCommitChunk(chunk)) {
    return;
  }
  state.committed = true;
  for (const bufferedChunk of state.bufferedChunks) {
    writer.write(bufferedChunk);
  }
  state.bufferedChunks.length = 0;
}

function updateProviderModel(state: ProviderAttemptState, part: ProviderRawPart) {
  const { response } = part;
  if (!(response && isRuntimeObject(response))) {
    return;
  }
  const { modelId } = response;
  if (isRuntimeString(modelId) && modelId) {
    state.selectedModel = modelId;
  }
}

function updateProviderFinish(state: ProviderAttemptState, part: ProviderRawPart) {
  const { finishReason, totalUsage } = part;
  // SAFETY: finish parts come from the AI SDK stream and its finishReason field uses FinishReason values.
  state.finishReason = isRuntimeString(finishReason) ? (finishReason as FinishReason) : undefined;
  state.totalUsage = totalUsage;
}

async function processProviderPart(
  context: ProviderExecutionContext,
  state: ProviderAttemptState,
  fallback: boolean,
  part: ProviderRawPart
): Promise<boolean> {
  if (part.type === "error") {
    throw part.error;
  }
  if (part.type === "abort") {
    const abortError = new DOMException(String(part.reason ?? "aborted"), "AbortError");
    if (!(context.signal?.aborted || state.committed)) {
      throw abortError;
    }
    context.writer.write({
      reason: context.signal?.aborted ? "cancelled" : "interrupted",
      type: "abort",
    });
    await safelyRecordTelemetry(context.onTelemetry, {
      fallback,
      feature: context.feature,
      latencyMs: context.now() - context.startedAt,
      model: state.selectedModel,
      terminalState: "interrupted",
    });
    return true;
  }
  if (part.type === "finish-step") {
    updateProviderModel(state, part);
  }
  if (part.type === "finish") {
    updateProviderFinish(state, part);
    return false;
  }
  if (part.type === "start") {
    return false;
  }
  // SAFETY: non-lifecycle provider parts are exactly the stream-part union accepted by toUIMessageChunk.
  const chunk = toUIMessageChunk(part as never, {
    sendFinish: false,
    sendReasoning: true,
    sendSources: false,
    sendStart: false,
  });
  if (chunk) {
    writeProviderChunk(state, context.writer, chunk);
  }
  return false;
}

function consumeProviderStream(
  context: ProviderExecutionContext,
  state: ProviderAttemptState,
  fallback: boolean,
  stream: ReadableStream<ProviderRawPart>
): Promise<boolean> {
  const reader = stream.getReader();
  const readNext = async (): Promise<boolean> => {
    const { done, value } = await reader.read();
    if (done) {
      return false;
    }
    if (await processProviderPart(context, state, fallback, value)) {
      return true;
    }
    return readNext();
  };
  return readNext().catch(async (cause) => {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    await reader.cancel(error);
    throw error;
  });
}

async function recordInterruptedAttempt(
  context: ProviderExecutionContext,
  state: ProviderAttemptState,
  fallback: boolean
) {
  context.writer.write({ reason: "cancelled", type: "abort" });
  await safelyRecordTelemetry(context.onTelemetry, {
    fallback,
    feature: context.feature,
    latencyMs: context.now() - context.startedAt,
    model: state.selectedModel,
    terminalState: "interrupted",
  });
}

async function recordCommittedAttemptFailure(
  context: ProviderExecutionContext,
  state: ProviderAttemptState,
  fallback: boolean,
  error: Error
) {
  const timedOut = isTimeoutFailure(error);
  if (timedOut) {
    context.writer.write({ reason: "timeout", type: "abort" });
  } else {
    context.writer.write({ errorText: context.onError(error), type: "error" });
  }
  await safelyRecordTelemetry(context.onTelemetry, {
    fallback,
    feature: context.feature,
    latencyMs: context.now() - context.startedAt,
    model: state.selectedModel,
    terminalState: timedOut ? "interrupted" : "failed",
  });
}

async function runProviderAttempt(
  context: ProviderExecutionContext,
  executionState: ProviderExecutionState,
  configuredModel: string,
  attemptPlan: NonNullable<ReturnType<typeof planProviderAttempt>>
): Promise<boolean> {
  const { fallback, remainingMs, timeoutMs } = attemptPlan;
  const state: ProviderAttemptState = {
    bufferedChunks: [],
    committed: false,
    selectedModel: configuredModel,
  };
  try {
    const result = await context.startAttempt({
      attempt: attemptPlan.attempt,
      fallback,
      model: configuredModel,
      remainingMs,
      signal: context.signal,
      timeoutMs,
    });
    if (await consumeProviderStream(context, state, fallback, result.stream)) {
      return true;
    }
    if (!state.committed) {
      throw new Error("AI provider returned no usable output");
    }
    context.writer.write({ finishReason: state.finishReason, type: "finish" });
    await safelyRecordTelemetry(context.onTelemetry, {
      fallback,
      feature: context.feature,
      finishReason: state.finishReason,
      inputTokens: usageNumber(state.totalUsage, "inputTokens"),
      latencyMs: context.now() - context.startedAt,
      model: state.selectedModel,
      outputTokens: usageNumber(state.totalUsage, "outputTokens"),
      terminalState: "completed",
    });
    return true;
  } catch (error) {
    executionState.lastError = error instanceof Error ? error : new Error(String(error));
    if (context.signal?.aborted) {
      await recordInterruptedAttempt(context, state, fallback);
      return true;
    }
    if (state.committed) {
      await recordCommittedAttemptFailure(context, state, fallback, executionState.lastError);
      return true;
    }
    return false;
  }
}

async function failProviderExecution(
  context: ProviderExecutionContext,
  state: ProviderExecutionState
): Promise<never> {
  await safelyRecordTelemetry(context.onTelemetry, {
    fallback: state.lastFallback,
    feature: context.feature,
    latencyMs: context.now() - context.startedAt,
    model: state.lastModel,
    terminalState: "failed",
  });
  throw state.lastError;
}

async function runProviderModels(
  context: ProviderExecutionContext,
  state: ProviderExecutionState,
  index: number
): Promise<void> {
  const configuredModel = context.models[index];
  if (configuredModel === undefined) {
    return failProviderExecution(context, state);
  }
  const attemptPlan = planProviderAttempt({
    index,
    minimumAttemptMs: context.minimumAttemptMs,
    model: configuredModel,
    now: context.now(),
    providerAttemptTimeoutMs: context.providerAttemptTimeoutMs,
    startedAt: context.startedAt,
    totalTimeoutMs: context.totalTimeoutMs,
  });
  if (!attemptPlan) {
    state.lastError = new Error("AI route budget exhausted", { cause: state.lastError });
    return failProviderExecution(context, state);
  }
  if (context.signal?.aborted) {
    const attemptState: ProviderAttemptState = {
      bufferedChunks: [],
      committed: false,
      selectedModel: configuredModel,
    };
    await recordInterruptedAttempt(context, attemptState, index > 0);
    return;
  }
  state.lastFallback = attemptPlan.fallback;
  state.lastModel = configuredModel;
  if (await runProviderAttempt(context, state, configuredModel, attemptPlan)) {
    return;
  }
  return runProviderModels(context, state, index + 1);
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
      const context: ProviderExecutionContext = {
        feature,
        minimumAttemptMs,
        models,
        now,
        onError,
        onTelemetry,
        providerAttemptTimeoutMs,
        signal,
        startAttempt,
        startedAt: now(),
        totalTimeoutMs,
        writer,
      };
      writer.write({ messageId: responseMessageId, type: "start" });
      await runProviderModels(
        context,
        {
          lastError: new Error("No AI provider was attempted"),
          lastFallback: models.length > 1,
          lastModel: models.at(-1) ?? "unconfigured",
        },
        0
      );
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
