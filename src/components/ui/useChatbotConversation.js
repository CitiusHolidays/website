"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyClientAiStreamEvent,
  createClientAiMessage,
  markClientAiMessageTerminal,
} from "@/lib/ai/uiMessageStream";
import { streamChatResponse } from "./chatbotStream";

const CHAT_HISTORY_KEY = "citius-chat-history:v4";

function loadStoredMessages() {
  if (typeof window === "undefined") {
    return [];
  }
  const savedMessages = localStorage.getItem(CHAT_HISTORY_KEY);
  if (!savedMessages) {
    return [];
  }

  try {
    const parsedMessages = JSON.parse(savedMessages);
    return Array.isArray(parsedMessages)
      ? parsedMessages.flatMap((message, messageIndex) => {
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
              terminalState:
                message.role === "assistant"
                  ? message.terminalState === "generating"
                    ? "interrupted"
                    : message.terminalState || "complete"
                  : undefined,
            },
          ];
        })
      : [];
  } catch (error) {
    console.error("Error loading chat history:", error);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    return [];
  }
}

function persistMessages(messages) {
  if (typeof window === "undefined") {
    return;
  }
  if (messages.length > 0) {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  } else {
    localStorage.removeItem(CHAT_HISTORY_KEY);
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

export function useChatbotConversation() {
  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(false);
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputRows, setInputRows] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");

  const updateMessages = (updater) => {
    setMessages((previous) => (typeof updater === "function" ? updater(previous) : updater));
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    const lines = value.split("\n").length;
    setInputRows(Math.min(Math.max(1, lines), 3));
  };

  const runRequest = async (requestMessages, userMessage) => {
    if (abortControllerRef.current) {
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
              errorText: "Sorry, I encountered an error. Please try again.",
              type: "error",
            });
          })
        );
        if (!abortController.signal.aborted) {
          console.error("Error sending message:", error);
          setErrorMessage("Sorry, I encountered an error. Please try again.");
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
      setErrorMessage("Citius Concierge could not complete that response. Please try again.");
    }

    finishRequest();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    const userMessage = createUserMessage(text);
    const requestMessages = [...messages, userMessage];
    setInput("");
    setInputRows(1);
    await runRequest(requestMessages, userMessage);
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

  const retryLastResponse = async () => {
    if (isLoading) {
      return;
    }
    const assistantIndex = messages.findLastIndex(
      (message) =>
        message.role === "assistant" &&
        ["cancelled", "failed", "interrupted"].includes(message.terminalState)
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
    retryLastResponse,
    setInput,
    updateMessages,
  };
}
