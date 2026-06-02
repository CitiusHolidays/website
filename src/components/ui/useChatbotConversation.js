"use client";

import { useEffect, useRef, useState } from "react";

const CHAT_HISTORY_KEY = "citius-chat-history:v1";

function loadStoredMessages() {
  if (typeof window === "undefined") return [];
  const savedMessages = localStorage.getItem(CHAT_HISTORY_KEY);
  if (!savedMessages) return [];
  try {
    return JSON.parse(savedMessages);
  } catch (error) {
    console.error("Error loading chat history:", error);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    return [];
  }
}

export function useChatbotConversation() {
  const messagesContainerRef = useRef(null);
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputRows, setInputRows] = useState(1);

  const updateMessages = (updater) => {
    setMessages((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      if (typeof window !== "undefined") {
        if (next.length > 0) {
          localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(next));
        } else {
          localStorage.removeItem(CHAT_HISTORY_KEY);
        }
      }
      return next;
    });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    const lines = value.split("\n").length;
    setInputRows(Math.min(Math.max(1, lines), 3));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      parts: [{ type: "text", text: input }],
      createdAt: new Date(),
    };

    updateMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setInputRows(1);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) {
        updateMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            parts: [
              { type: "text", text: "Sorry, I'm having trouble connecting. Please try again." },
            ],
            createdAt: new Date(),
          },
        ]);
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        updateMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            parts: [{ type: "text", text: "No response stream was available. Please try again." }],
            createdAt: new Date(),
          },
        ]);
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        parts: [{ type: "text", text: "" }],
        createdAt: new Date(),
        isStreaming: true,
      };

      updateMessages((prev) => [...prev, assistantMessage]);

      let accumulatedText = "";

      const readNextChunk = async () => {
        const { done, value } = await reader.read();

        if (done) {
          updateMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    parts: [{ type: "text", text: accumulatedText }],
                    isStreaming: false,
                  }
                : msg,
            ),
          );
          return;
        }

        accumulatedText += decoder.decode(value, { stream: true });
        updateMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  parts: [{ type: "text", text: accumulatedText }],
                  isStreaming: true,
                }
              : msg,
          ),
        );
        await readNextChunk();
      };

      await readNextChunk();
    } catch (error) {
      console.error("Error sending message:", error);
      updateMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          parts: [{ type: "text", text: "Sorry, I encountered an error. Please try again." }],
          createdAt: new Date(),
          isStreaming: false,
        },
      ]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
    }
  });

  return {
    messages,
    input,
    isLoading,
    inputRows,
    messagesContainerRef,
    updateMessages,
    handleInputChange,
    handleSubmit,
    setInput,
  };
}
