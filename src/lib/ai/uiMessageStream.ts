import { isJsonObject, type JsonObject, type JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "../runtimeValues";

const SSE_EVENT_BOUNDARY_PATTERN = /\r?\n\r?\n/;
const SSE_LINE_PATTERN = /\r?\n/;
export type ClientAiTerminalState =
  | "generating"
  | "complete"
  | "cancelled"
  | "interrupted"
  | "failed";

export interface ClientAiTextPart {
  id: string;
  text: string;
  type: "text";
}

export interface ClientAiReasoningPart {
  id: string;
  status: "streaming" | "complete";
  text: string;
  type: "reasoning";
}

export interface ClientAiToolPart {
  errorText?: string;
  id: string;
  input?: unknown;
  inputText?: string;
  output?: unknown;
  status:
    | "input-streaming"
    | "input-available"
    | "input-error"
    | "output-available"
    | "output-error"
    | "output-denied";
  toolName: string;
  type: "tool";
}

export interface ClientAiStatusPart {
  id: string;
  status: "working" | "complete";
  text: string;
  type: "status";
}

export interface ClientAiErrorPart {
  id: string;
  text: string;
  type: "error";
}

export type ClientAiPart =
  | ClientAiTextPart
  | ClientAiReasoningPart
  | ClientAiToolPart
  | ClientAiStatusPart
  | ClientAiErrorPart;

export interface ClientAiMessage {
  finishReason?: string;
  id: string;
  parts: ClientAiPart[];
  requestId: string;
  requestReference?: string;
  role: "assistant";
  terminalState: ClientAiTerminalState;
}

interface ConsumeUiMessageSseOptions {
  messageId: string;
  onMessage?: (message: ClientAiMessage) => void;
  requestReference?: string;
  response: Response;
  signal?: AbortSignal;
}

export interface ConsumeUiMessageSseResult {
  message: ClientAiMessage;
  streamedVisibleText: boolean;
  streamHadError: boolean;
}

function eventRecord(event: JsonValue): JsonObject | null {
  return isJsonObject(event) ? event : null;
}

function stringField(event: JsonObject, key: string) {
  const value = event[key];
  return isRuntimeString(value) ? value : undefined;
}

function upsertPart(message: ClientAiMessage, part: ClientAiPart): ClientAiMessage {
  const index = message.parts.findIndex(
    (candidate) => candidate.id === part.id && candidate.type === part.type
  );
  if (index < 0) {
    return { ...message, parts: [...message.parts, part] };
  }
  const parts = [...message.parts];
  parts[index] = part;
  return { ...message, parts };
}

function existingPart<Part extends ClientAiPart["type"]>(
  message: ClientAiMessage,
  type: Part,
  id: string
): Extract<ClientAiPart, { type: Part }> | undefined {
  return message.parts.find(
    (part): part is Extract<ClientAiPart, { type: Part }> => part.type === type && part.id === id
  );
}

function nextPartId(message: ClientAiMessage, type: ClientAiPart["type"]) {
  return `${type}-${message.parts.filter((part) => part.type === type).length + 1}`;
}

export function createClientAiMessage(id: string, requestReference?: string): ClientAiMessage {
  const message: ClientAiMessage = {
    id,
    parts: [],
    requestId: id,
    role: "assistant",
    terminalState: "generating",
  };
  if (requestReference) {
    message.requestReference = requestReference;
  }
  return message;
}

export function markClientAiMessageTerminal(
  message: ClientAiMessage,
  terminalState: ClientAiTerminalState
): ClientAiMessage {
  return { ...message, terminalState };
}

function applyTextStreamEvent(current: ClientAiMessage, event: JsonObject, type: string) {
  const id = stringField(event, "id");
  if (!id) {
    return current;
  }
  const existing = existingPart(current, "text", id);
  const delta = type === "text-delta" ? (stringField(event, "delta") ?? "") : "";
  return upsertPart(current, {
    id,
    text: `${existing?.text ?? ""}${delta}`,
    type: "text",
  });
}

function applyReasoningStreamEvent(current: ClientAiMessage, event: JsonObject, type: string) {
  const id = stringField(event, "id");
  if (!id) {
    return current;
  }
  const existing = existingPart(current, "reasoning", id);
  const delta = type === "reasoning-delta" ? (stringField(event, "delta") ?? "") : "";
  return upsertPart(current, {
    id,
    status: type === "reasoning-end" ? "complete" : "streaming",
    text: `${existing?.text ?? ""}${delta}`,
    type: "reasoning",
  });
}

function completeLastStatus(current: ClientAiMessage) {
  let lastStatus: ClientAiStatusPart | undefined;
  for (let index = current.parts.length - 1; index >= 0; index -= 1) {
    const part = current.parts[index];
    if (part.type === "status") {
      lastStatus = part;
      break;
    }
  }
  return lastStatus
    ? upsertPart(current, { ...lastStatus, status: "complete", text: "Response prepared" })
    : current;
}

function applyToolStreamEvent(current: ClientAiMessage, event: JsonObject, type: string) {
  const id = stringField(event, "toolCallId");
  if (!id) {
    return current;
  }
  const existing = existingPart(current, "tool", id);
  const base: ClientAiToolPart = {
    id,
    status: existing?.status ?? "input-streaming",
    toolName: stringField(event, "toolName") ?? existing?.toolName ?? "Citius travel data",
    type: "tool",
    ...existing,
  };
  if (type === "tool-input-start") {
    return upsertPart(current, { ...base, status: "input-streaming" });
  }
  if (type === "tool-input-delta") {
    return upsertPart(current, {
      ...base,
      inputText: `${base.inputText ?? ""}${stringField(event, "inputTextDelta") ?? ""}`,
      status: "input-streaming",
    });
  }
  if (type === "tool-input-available") {
    return upsertPart(current, { ...base, input: event.input, status: "input-available" });
  }
  if (type === "tool-input-error") {
    return upsertPart(current, {
      ...base,
      errorText: stringField(event, "errorText"),
      input: event.input,
      status: "input-error",
    });
  }
  if (type === "tool-output-available") {
    return upsertPart(current, { ...base, output: event.output, status: "output-available" });
  }
  if (type === "tool-output-error") {
    return upsertPart(current, {
      ...base,
      errorText: stringField(event, "errorText"),
      status: "output-error",
    });
  }
  return type === "tool-output-denied"
    ? upsertPart(current, { ...base, status: "output-denied" })
    : current;
}

const TERMINAL_STREAM_EVENT_TYPES = new Set(["abort", "error", "finish"]);

function applyTerminalStreamEvent(
  current: ClientAiMessage,
  event: JsonObject,
  type: string
): ClientAiMessage {
  if (type === "error") {
    const errorText =
      stringField(event, "errorText") ??
      stringField(event, "message") ??
      "The AI service could not complete this response.";
    const text = current.requestReference
      ? `${errorText} Reference: ${current.requestReference}`
      : errorText;
    return upsertPart(
      { ...current, terminalState: "failed" },
      { id: nextPartId(current, "error"), text, type: "error" }
    );
  }
  if (type === "abort") {
    const reason = stringField(event, "reason");
    const cancelled = reason === "cancelled" || reason === "user-cancelled";
    return { ...current, terminalState: cancelled ? "cancelled" : "interrupted" };
  }
  return {
    ...current,
    finishReason: stringField(event, "finishReason"),
    terminalState: current.terminalState === "generating" ? "complete" : current.terminalState,
  };
}

export function applyClientAiStreamEvent(
  current: ClientAiMessage,
  rawEvent: JsonValue
): ClientAiMessage {
  const event = eventRecord(rawEvent);
  const type = event ? stringField(event, "type") : undefined;
  if (!(event && type)) {
    return current;
  }

  if (type === "start") {
    return {
      ...current,
      id: stringField(event, "messageId") ?? current.id,
      terminalState: "generating",
    };
  }

  if (type === "text-start" || type === "text-delta" || type === "text-end") {
    return applyTextStreamEvent(current, event, type);
  }

  if (type === "reasoning-start" || type === "reasoning-delta" || type === "reasoning-end") {
    return applyReasoningStreamEvent(current, event, type);
  }

  if (type === "start-step") {
    return upsertPart(current, {
      id: nextPartId(current, "status"),
      status: "working",
      text: "Preparing your response",
      type: "status",
    });
  }

  if (type === "finish-step") {
    return completeLastStatus(current);
  }

  if (type.startsWith("tool-")) {
    return applyToolStreamEvent(current, event, type);
  }

  if (TERMINAL_STREAM_EVENT_TYPES.has(type)) {
    return applyTerminalStreamEvent(current, event, type);
  }

  return current;
}

export function hasVisibleClientAiText(message: ClientAiMessage): boolean {
  return message.parts.some((part) => part.type === "text" && part.text.trim().length > 0);
}

function parseSseEvent(eventText: string): JsonValue | null {
  const data = eventText
    .split(SSE_LINE_PATTERN)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data || data === "[DONE]") {
    return null;
  }
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function streamFailureTerminalState(
  signal: AbortSignal | undefined,
  message: ClientAiMessage
): ClientAiTerminalState {
  if (signal?.aborted) {
    return "cancelled";
  }
  return hasVisibleClientAiText(message) ? "interrupted" : "failed";
}

export async function consumeUiMessageSse({
  messageId,
  onMessage,
  requestReference,
  response,
  signal,
}: ConsumeUiMessageSseOptions): Promise<ConsumeUiMessageSseResult> {
  if (!response.body) {
    throw new Error("AI response did not include a stream");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let message = createClientAiMessage(messageId, requestReference);

  const consumeEvent = (eventText: string) => {
    const event = parseSseEvent(eventText);
    if (!event) {
      return;
    }
    message = applyClientAiStreamEvent(message, event);
    onMessage?.(message);
  };

  const readRemainingStream = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(SSE_EVENT_BOUNDARY_PATTERN);
    buffer = events.pop() ?? "";
    for (const eventText of events) {
      consumeEvent(eventText);
    }
    return readRemainingStream();
  };

  try {
    await readRemainingStream();
    buffer += decoder.decode();
    if (buffer.trim()) {
      consumeEvent(buffer);
    }
  } catch {
    const terminalState = streamFailureTerminalState(signal, message);
    message = markClientAiMessageTerminal(message, terminalState);
    onMessage?.(message);
  }

  if (message.terminalState === "generating") {
    message = markClientAiMessageTerminal(
      message,
      hasVisibleClientAiText(message) ? "interrupted" : "failed"
    );
    onMessage?.(message);
  }

  return {
    message,
    streamedVisibleText: hasVisibleClientAiText(message),
    streamHadError: message.terminalState === "failed",
  };
}
