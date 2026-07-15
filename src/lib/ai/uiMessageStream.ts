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
  role: "assistant";
  terminalState: ClientAiTerminalState;
}

interface ConsumeUiMessageSseOptions {
  messageId: string;
  onMessage?: (message: ClientAiMessage) => void;
  response: Response;
  signal?: AbortSignal;
}

export interface ConsumeUiMessageSseResult {
  message: ClientAiMessage;
  streamedVisibleText: boolean;
  streamHadError: boolean;
}

function eventRecord(event: unknown): Record<string, unknown> | null {
  return event && typeof event === "object" ? (event as Record<string, unknown>) : null;
}

function stringField(event: Record<string, unknown>, key: string) {
  const value = event[key];
  return typeof value === "string" ? value : undefined;
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

export function createClientAiMessage(id: string): ClientAiMessage {
  return {
    id,
    parts: [],
    requestId: id,
    role: "assistant",
    terminalState: "generating",
  };
}

export function markClientAiMessageTerminal(
  message: ClientAiMessage,
  terminalState: ClientAiTerminalState
): ClientAiMessage {
  return { ...message, terminalState };
}

export function applyClientAiStreamEvent(
  current: ClientAiMessage,
  rawEvent: unknown
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

  if (type === "reasoning-start" || type === "reasoning-delta" || type === "reasoning-end") {
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

  if (type === "start-step") {
    return upsertPart(current, {
      id: nextPartId(current, "status"),
      status: "working",
      text: "Preparing your response",
      type: "status",
    });
  }

  if (type === "finish-step") {
    let lastStatus: ClientAiStatusPart | undefined;
    for (let index = current.parts.length - 1; index >= 0; index -= 1) {
      const part = current.parts[index];
      if (part.type === "status") {
        lastStatus = part;
        break;
      }
    }
    if (!lastStatus || lastStatus.type !== "status") {
      return current;
    }
    return upsertPart(current, { ...lastStatus, status: "complete", text: "Response prepared" });
  }

  if (type.startsWith("tool-")) {
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
      ...(existing ?? {}),
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
    if (type === "tool-output-denied") {
      return upsertPart(current, { ...base, status: "output-denied" });
    }
  }

  if (type === "error") {
    const text =
      stringField(event, "errorText") ??
      stringField(event, "message") ??
      "The AI service could not complete this response.";
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

  if (type === "finish") {
    return {
      ...current,
      finishReason: stringField(event, "finishReason"),
      terminalState: current.terminalState === "generating" ? "complete" : current.terminalState,
    };
  }

  return current;
}

export function hasVisibleClientAiText(message: ClientAiMessage): boolean {
  return message.parts.some((part) => part.type === "text" && part.text.trim().length > 0);
}

function parseSseEvent(eventText: string): unknown | null {
  const data = eventText
    .split(/\r?\n/)
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

export async function consumeUiMessageSse({
  messageId,
  onMessage,
  response,
  signal,
}: ConsumeUiMessageSseOptions): Promise<ConsumeUiMessageSseResult> {
  if (!response.body) {
    throw new Error("AI response did not include a stream");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let message = createClientAiMessage(messageId);

  const consumeEvent = (eventText: string) => {
    const event = parseSseEvent(eventText);
    if (!event) {
      return;
    }
    message = applyClientAiStreamEvent(message, event);
    onMessage?.(message);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const eventText of events) {
        consumeEvent(eventText);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      consumeEvent(buffer);
    }
  } catch {
    const terminalState = signal?.aborted
      ? "cancelled"
      : hasVisibleClientAiText(message)
        ? "interrupted"
        : "failed";
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
