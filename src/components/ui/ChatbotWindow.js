"use client";

import { Sparkles, Trash2, X } from "lucide-react";
import { AnimatePresence, easeInOut, m } from "motion/react";
import { useState } from "react";
import { ChatbotComposer } from "./ChatbotComposer";
import { ChatbotMessageList, ChatbotSuggestions } from "./ChatbotMessages";
import { useChatbotConversation } from "./useChatbotConversation";

function ChatbotPanelHeader({ messages, isMinimized, onClear, onToggleMinimize, onClose }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-green-600 text-white flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="size-8 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="absolute bottom-0 right-0 size-2.5 bg-green-400 rounded-full border-2 border-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Travel Assistant</h3>
          <p className="text-xs text-white/90">Online</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {messages.length > 0 && (
          <m.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClear}
            className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/20 rounded-full"
            title="Clear chat history"
          >
            <Trash2 size={16} />
          </m.button>
        )}
        <m.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onToggleMinimize}
          className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/20 rounded-full size-6 flex items-center justify-center text-sm relative overflow-hidden"
        >
          <AnimatePresence mode="wait">
            <m.span
              key={isMinimized ? "minimized" : "maximized"}
              initial={{ opacity: 0, y: -10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {isMinimized ? "+" : "−"}
            </m.span>
          </AnimatePresence>
        </m.button>
        <m.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/20 rounded-full"
        >
          <X size={16} />
        </m.button>
      </div>
    </div>
  );
}

export function ChatbotWindow({ isOpen, onClose }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const {
    messages,
    input,
    isLoading,
    inputRows,
    messagesContainerRef,
    updateMessages,
    handleInputChange,
    handleSubmit,
    setInput,
  } = useChatbotConversation();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <m.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{
          scale: 1,
          opacity: 1,
          height: isMinimized ? "80px" : "min(650px, 85dvh)",
        }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
          height: { duration: 0.4, ease: easeInOut },
        }}
        className="fixed bottom-4 right-4 left-4 z-50 flex w-auto max-w-[400px] flex-col overflow-hidden rounded-2xl border border-brand-border/50 bg-white shadow-2xl backdrop-blur-sm origin-bottom-right sm:bottom-6 sm:left-auto sm:right-6 sm:w-[400px]"
      >
        <ChatbotPanelHeader
          messages={messages}
          isMinimized={isMinimized}
          onClear={() => updateMessages([])}
          onToggleMinimize={() => setIsMinimized(!isMinimized)}
          onClose={onClose}
        />

        <AnimatePresence mode="wait">
          {!isMinimized && (
            <m.div
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
                <div className={messages.length === 0 ? "p-6" : "p-6 space-y-4"}>
                  {messages.length === 0 ? (
                    <ChatbotSuggestions onSelectPrompt={setInput} />
                  ) : (
                    <ChatbotMessageList messages={messages} isLoading={isLoading} />
                  )}
                </div>
              </div>

              <ChatbotComposer
                input={input}
                inputRows={inputRows}
                isLoading={isLoading}
                onInputChange={handleInputChange}
                onSubmit={handleSubmit}
              />
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </AnimatePresence>
  );
}
