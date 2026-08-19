"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyClientAiStreamEvent,
  createClientAiMessage,
  markClientAiMessageTerminal,
} from "@/lib/ai/uiMessageStream";
import { isRuntimeFunction, isRuntimeObject, isRuntimeString } from "../../lib/runtimeValues";
import { streamChatResponse } from "./chatbotStream";

const CONCIERGE_REQUEST_FAILURE =
  "Citius Concierge could not complete that response. Please try again.";
const CONCIERGE_SECURITY_PENDING = "Complete the security check before asking Citius Concierge.";

const CHAT_HISTORY_KEY = "citius-chat-history:v5";
const MAX_STORED_MESSAGES = 20;
const MAX_STORED_PART_CHARS = 8000;
const MAX_STORED_HISTORY_CHARS = 96_000;

function restoredAssistantTerminalState(message) {
  if (message.role !== "assistant") {
    return;
  }
  if (message.terminalState === "generating") {
    return "interrupted";
  }
  return message.terminalState || "complete";
}

export function boundStoredMessages(messages) {
  const bounded = messages.slice(-MAX_STORED_MESSAGES).map((message) => ({
    ...message,
    parts: Array.isArray(message.parts)
      ? message.parts.flatMap((part) => {
          if (!(part && isRuntimeObject(part))) {
            return [];
          }
          if (!isRuntimeString(part.text)) {
            return [part];
          }
          return [{ ...part, text: part.text.slice(0, MAX_STORED_PART_CHARS) }];
        })
      : [],
  }));

  while (bounded.length > 1 && JSON.stringify(bounded).length > MAX_STORED_HISTORY_CHARS) {
    bounded.shift();
  }
  return bounded;
}

function loadStoredMessages() {
  if (!("window" in globalThis)) {
    return [];
  }
  const savedMessages = window.sessionStorage.getItem(CHAT_HISTORY_KEY);
  if (!savedMessages) {
    return [];
  }

  try {
    const parsedMessages = JSON.parse(savedMessages);
    return Array.isArray(parsedMessages)
      ? boundStoredMessages(
          parsedMessages.flatMap((message, messageIndex) => {
            if (!(message && (message.role === "assistant" || message.role === "user"))) {
              return [];
            }
            const parts = Array.isArray(message.parts)
              ? message.parts.map((part, partIndex) => ({
                  ...part,
                  id: part?.id || `${message.role}-${messageIndex}-part-${partIndex}`,
                }))
              : [];
            return [
              {
                ...message,
                parts,
                requestId: message.requestId || message.id,
                terminalState: restoredAssistantTerminalState(message),
              },
            ];
          })
        )
      : [];
  } catch (error) {
    console.error("Error loading chat history:", error);
    window.sessionStorage.removeItem(CHAT_HISTORY_KEY);
    return [];
  }
}

function persistMessages(messages) {
  if (!("window" in globalThis)) {
    return;
  }
  const bounded = boundStoredMessages(messages);
  if (bounded.length > 0) {
    window.sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(bounded));
  } else {
    window.sessionStorage.removeItem(CHAT_HISTORY_KEY);
  }
}

function createUserMessage(text) {
  const id = `user-${crypto.randomUUID()}`;
  return {
    id,
    parts: [{ id: `${id}-text`, text, type: "text" }],
    role: "user",
  };
}

export function useChatbotConversation({
  getTurnstileToken,
  onTurnstileConsumed,
  turnstileRequired = false,
} = {}) {
  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(false);
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputRows, setInputRows] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");

  const updateMessages = (updater) => {
    setMessages((previous) => (isRuntimeFunction(updater) ? updater(previous) : updater));
  };

  const handleInputChange = (e) => {
    const { value } = e.target;
    setInput(value);
    const lines = value.split("\n").length;
    setInputRows(Math.min(Math.max(1, lines), 3));
  };

  const currentTurnstileToken = () => getTurnstileToken?.() || "";

  const runRequest = async (requestMessages, userMessage, providedTurnstileToken) => {
    if (abortControllerRef.current) {
      return;
    }
    const turnstileToken = providedTurnstileToken || currentTurnstileToken();
    if (turnstileRequired && !turnstileToken) {
      setErrorMessage(CONCIERGE_SECURITY_PENDING);
      return;
    }
    const assistantId = `assistant-${crypto.randomUUID()}`;
    const assistantMessage = createClientAiMessage(assistantId);
    setMessages([...requestMessages, assistantMessage]);
    setErrorMessage("");
    setIsLoading(true);

    const abortController = new AbortController();
    const activeRequest = { assistantId, controller: abortController };
    abortControllerRef.current = activeRequest;

    const finishRequest = () => {
      if (abortControllerRef.current === activeRequest) {
        abortControllerRef.current = null;
      }
      if (mountedRef.current) {
        setIsLoading(false);
      }
    };

    const result = await streamChatResponse({
      assistantId,
      messages: requestMessages,
      onMessage: (nextAssistantMessage) => {
        if (!(mountedRef.current && abortControllerRef.current === activeRequest)) {
          return;
        }
        setMessages((currentMessages) => {
          const existingIndex = currentMessages.findIndex(
            (message) =>
              message.requestId === assistantId ||
              message.id === assistantId ||
              message.id === nextAssistantMessage.id
          );
          if (existingIndex < 0) {
            return currentMessages;
          }
          const nextMessages = [...currentMessages];
          nextMessages[existingIndex] = nextAssistantMessage;
          return nextMessages;
        });
      },
      onStreamError: (message) => {
        if (mountedRef.current && abortControllerRef.current === activeRequest) {
          setErrorMessage(() => message);
        }
      },
      signal: abortController.signal,
      turnstileToken,
      userMessage,
    }).catch((error) => {
      if (mountedRef.current && abortControllerRef.current === activeRequest) {
        const terminalState = abortController.signal.aborted ? "cancelled" : "failed";
        setMessages((currentMessages) =>
          currentMessages.map((message) => {
            if (message.requestId !== assistantId) {
              return message;
            }
            if (terminalState === "cancelled") {
              return markClientAiMessageTerminal(message, terminalState);
            }
            return applyClientAiStreamEvent(message, {
              errorText: CONCIERGE_REQUEST_FAILURE,
              type: "error",
            });
          })
        );
        if (!abortController.signal.aborted) {
          console.error("Error sending message:", error);
          setErrorMessage(CONCIERGE_REQUEST_FAILURE);
        }
      }
      return null;
    });

    if (
      mountedRef.current &&
      abortControllerRef.current === activeRequest &&
      result &&
      !result.streamedVisibleText &&
      !result.streamHadError &&
      result.message.terminalState === "complete"
    ) {
      setErrorMessage(CONCIERGE_REQUEST_FAILURE);
    }

    finishRequest();
    if (turnstileToken) {
      onTurnstileConsumed?.();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }
    const turnstileToken = currentTurnstileToken();
    if (turnstileRequired && !turnstileToken) {
      setErrorMessage(CONCIERGE_SECURITY_PENDING);
      return;
    }

    const userMessage = createUserMessage(text);
    const requestMessages = [...messages, userMessage];
    setInput("");
    setInputRows(1);
    await runRequest(requestMessages, userMessage, turnstileToken);
  };

  const cancelActiveRequest = () => {
    const activeRequest = abortControllerRef.current;
    if (!activeRequest) {
      return;
    }
    abortControllerRef.current = null;
    activeRequest.controller.abort("user-cancelled");
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.requestId === activeRequest.assistantId
          ? markClientAiMessageTerminal(message, "cancelled")
          : message
      )
    );
    setIsLoading(false);
  };

  const clearConversation = () => {
    cancelActiveRequest();
    setMessages([]);
    setErrorMessage("");
  };

  const rerunLastResponse = async (terminalStates) => {
    if (isLoading) {
      return;
    }
    const terminalStateSet = new Set(terminalStates);
    const assistantIndex = messages.findLastIndex(
      (message) => message.role === "assistant" && terminalStateSet.has(message.terminalState)
    );
    if (assistantIndex !== messages.length - 1) {
      return;
    }
    const userMessage = messages
      .slice(0, assistantIndex)
      .findLast((message) => message.role === "user");
    if (!userMessage) {
      return;
    }
    await runRequest(messages.slice(0, assistantIndex), userMessage);
  };

  const retryLastResponse = async () =>
    await rerunLastResponse(["cancelled", "failed", "interrupted"]);

  const regenerateLastResponse = async () =>
    await rerunLastResponse(["complete", "cancelled", "failed", "interrupted"]);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.controller.abort("component-unmounted");
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!messagesContainerRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });
  });

  return {
    cancelActiveRequest,
    clearConversation,
    errorMessage,
    handleInputChange,
    handleSubmit,
    input,
    inputRows,
    isLoading,
    messages,
    messagesContainerRef,
    regenerateLastResponse,
    retryLastResponse,
    setInput,
    updateMessages,
  };
}
