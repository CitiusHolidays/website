"use client";

import { useEffect, useRef, useState } from "react";
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
    return Array.isArray(parsedMessages) ? parsedMessages : [];
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
  return {
    id: `user-${Date.now()}`,
    parts: [{ text, type: "text" }],
    role: "user",
  };
}

function createAssistantMessage(id, text) {
  return {
    id,
    parts: [{ text, type: "text" }],
    role: "assistant",
  };
}

function upsertAssistantText(messages, assistantId, text) {
  const existingIndex = messages.findIndex((message) => message.id === assistantId);
  const assistantMessage = createAssistantMessage(assistantId, text);
  if (existingIndex === -1) {
    return [...messages, assistantMessage];
  }

  const nextMessages = [...messages];
  nextMessages[existingIndex] = assistantMessage;
  return nextMessages;
}

export function useChatbotConversation() {
  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    const userMessage = createUserMessage(text);
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setInputRows(1);
    setErrorMessage("");
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const finishRequest = () => {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    };

    const assistantId = `assistant-${Date.now()}`;

    const result = await streamChatResponse({
      assistantId,
      messages: nextMessages,
      onStreamError: (message) => {
        setErrorMessage(message);
      },
      onTextDelta: (visibleText) => {
        setMessages((currentMessages) =>
          upsertAssistantText(currentMessages, assistantId, visibleText)
        );
      },
      signal: abortController.signal,
      userMessage,
    }).catch((error) => {
      if (abortController.signal.aborted) {
        return null;
      }
      console.error("Error sending message:", error);
      setErrorMessage("Sorry, I encountered an error. Please try again.");
      return null;
    });

    if (result && !result.streamedVisibleText && !result.streamHadError) {
      setErrorMessage("Citius Concierge could not complete that response. Please try again.");
    }

    finishRequest();
  };

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

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
    errorMessage,
    handleInputChange,
    handleSubmit,
    input,
    inputRows,
    isLoading,
    messages,
    messagesContainerRef,
    setInput,
    updateMessages,
  };
}
