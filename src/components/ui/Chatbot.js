"use client";

import { motion, AnimatePresence, easeInOut } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { X, MessageCircle, Send, Trash2, Sparkles } from "lucide-react";
import parse from 'html-react-parser';
import DOMPurify from 'dompurify';

// Function to render content with safe HTML parsing
const renderFormattedText = (text, isStreaming = false) => {
  if (!text) return null;

  // During streaming, show plain text without HTML parsing to prevent flickering
  if (isStreaming) {
    // Strip HTML tags and show raw text
    const plainText = text.replace(/<[^>]*>/g, '');
    return <div className="whitespace-pre-wrap leading-relaxed">{plainText}</div>;
  }

  // After streaming completes, sanitize and parse HTML
  try {
    const sanitizedHTML = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote', 'span', 'div'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
    });
    
    return (
      <div className="formatted-content whitespace-pre-wrap leading-relaxed">
        {parse(sanitizedHTML)}
      </div>
    );
  } catch (error) {
    console.error('Error parsing HTML:', error);
    return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>;
  }
};

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputRows, setInputRows] = useState(1);
  const textareaRef = useRef(null);

  useEffect(() => {
    const savedMessages = localStorage.getItem("citius-chat-history");
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (error) {
        console.error("Error loading chat history:", error);
        localStorage.removeItem("citius-chat-history");
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("citius-chat-history", JSON.stringify(messages));
    }
  }, [messages]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    const lines = value.split("\n").length;
    const maxRows = 3;
    const newRows = Math.min(Math.max(1, lines), maxRows);
    setInputRows(newRows);
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

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setInputRows(1);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        parts: [{ type: "text", text: "" }],
        createdAt: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Mark streaming as complete
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    parts: [{ type: "text", text: accumulatedText }],
                    isStreaming: false,
                  }
                : msg
            )
          );
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Update message with streaming flag
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  parts: [{ type: "text", text: accumulatedText }],
                  isStreaming: true,
                }
              : msg
          )
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Sorry, I encountered an error. Please try again.",
          },
        ],
        createdAt: new Date(),
        isStreaming: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem("citius-chat-history");
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
      });
    }
  }, [messages, isLoading]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  const minimizeChat = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <>
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ease: easeInOut }}
          className="fixed bottom-6 right-6 z-50 animate-bounce bg-green-600 hover:bg-green-600/90 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group hover:scale-115"
          onClick={toggleChat}
        >
          <MessageCircle
            size={24}
            className="group-hover:rotate-12 transition-transform duration-300"
          />
          {/* <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full animate-pulse" /> */}
        </motion.button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              height: isMinimized ? "80px" : "650px"
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
              height: { duration: 0.4, ease: easeInOut }
            }}
            className="fixed bottom-6 right-6 z-50 w-[400px] bg-white rounded-2xl shadow-2xl border border-brand-border/50 overflow-hidden backdrop-blur-sm flex flex-col origin-bottom-right"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-green-600 text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Travel Assistant</h3>
                  <p className="text-xs text-white/90">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={clearHistory}
                    className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/20 rounded-full"
                    title="Clear chat history"
                  >
                    <Trash2 size={16} />
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={minimizeChat}
                  className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-sm relative overflow-hidden"
                >
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={isMinimized ? "minimized" : "maximized"}
                      initial={{ opacity: 0, y: -10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.8 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      {isMinimized ? "+" : "−"}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleChat}
                  className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/20 rounded-full"
                >
                  <X size={16} />
                </motion.button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!isMinimized && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="flex flex-col flex-1 min-h-0"
                >
                  <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50/50 to-white"
                  >
                    <div
                      className={
                        messages.length === 0 ? "p-6" : "p-6 space-y-4"
                      }
                    >
                      {messages.length === 0 ? (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="text-center mt-8"
                        >
                          <div className="w-16 h-16 bg-citius-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <MessageCircle
                              size={32}
                              className="text-citius-blue"
                            />
                          </div>
                          <h4 className="text-lg font-semibold text-brand-dark mb-2">
                            Welcome! 👋
                          </h4>
                          <p className="text-sm text-brand-muted leading-relaxed max-w-xs mx-auto">
                            I&apos;m your travel assistant. Ask me anything
                            about destinations, travel tips, or planning your
                            next adventure!
                          </p>
                          <div className="mt-6 space-y-2">
                            <button
                              onClick={() =>
                                setInput(
                                  "What are the best destinations for summer?"
                                )
                              }
                              className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 border border-brand-border rounded-xl text-sm text-brand-dark transition-colors"
                            >
                              ✈️ Best summer destinations
                            </button>
                            <button
                              onClick={() =>
                                setInput("How do I plan a budget trip?")
                              }
                              className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 border border-brand-border rounded-xl text-sm text-brand-dark transition-colors"
                            >
                              💰 Budget travel tips
                            </button>
                            <button
                              onClick={() =>
                                setInput(
                                  "What are the most popular destinations?"
                                )
                              }
                              className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 border border-brand-border rounded-xl text-sm text-brand-dark transition-colors"
                            >
                              🌟 Popular destinations
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <>
                          {messages.map((message) => (
                            <motion.div
                              key={message.id}
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.2 }}
                              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[96%] px-4 py-3 rounded-2xl ${
                                  message.role === "user"
                                    ? "bg-green-600 text-white rounded-br-md shadow-sm ml-auto"
                                    : "bg-gray-100 text-gray-800 border border-gray-200 rounded-bl-md shadow-sm mr-auto"
                                }`}
                              >
                                {message.parts.map((part, i) => (
                                  <div
                                    key={`${message.id}-${i}`}
                                    className="text-sm"
                                  >
                                    {part.type === "text" && renderFormattedText(part.text, message.isStreaming)}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          ))}
                          {isLoading && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex justify-start"
                            >
                              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md border border-gray-200 shadow-sm mr-auto">
                                <div className="flex gap-1 items-center">
                                  <motion.div
                                    className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{
                                      duration: 1,
                                      repeat: Number.POSITIVE_INFINITY,
                                      ease: "easeInOut",
                                    }}
                                  />
                                  <motion.div
                                    className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{
                                      duration: 1,
                                      repeat: Number.POSITIVE_INFINITY,
                                      ease: "easeInOut",
                                      delay: 0.2,
                                    }}
                                  />
                                  <motion.div
                                    className="w-1.5 h-1.5 bg-gray-400 rounded-full"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{
                                      duration: 1,
                                      repeat: Number.POSITIVE_INFINITY,
                                      ease: "easeInOut",
                                      delay: 0.4,
                                    }}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <div className="p-4 bg-white border-t border-brand-border/50 flex-shrink-0">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Ask about destinations, tips..."
                        rows={inputRows}
                        className="flex-1 px-4 py-3 border text-brand-dark placeholder:text-brand-muted border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-citius-blue/20 focus:border-citius-blue transition-all bg-gray-50/50 focus:bg-white text-sm resize-none overflow-y-auto"
                        style={{
                          minHeight: "48px",
                          maxHeight:
                            inputRows > 1 ? `${inputRows * 24 + 24}px` : "48px",
                        }}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                          }
                        }}
                      />
                      <motion.button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-green-600 hover:bg-green-600/90 text-white p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm hover:shadow-md self-end"
                      >
                        <Send size={18} />
                      </motion.button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
