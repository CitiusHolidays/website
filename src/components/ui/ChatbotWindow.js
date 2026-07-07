"use client";

import { Compass, Trash2, X } from "lucide-react";
import { AnimatePresence, easeInOut, m } from "motion/react";
import { useEffect, useEffectEvent, useState } from "react";
import { ChatbotComposer } from "./ChatbotComposer";
import { ChatbotMessageList, ChatbotSuggestions } from "./ChatbotMessages";
import { useChatbotConversation } from "./useChatbotConversation";

function ChatbotPanelHeader({ messages, isMinimized, onClear, onToggleMinimize, onClose }) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between bg-citius-blue px-4 py-3 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <div className="flex size-8 items-center justify-center rounded-full bg-white/15">
            <Compass aria-hidden="true" className="text-white" size={16} />
          </div>
          <span
            aria-hidden="true"
            className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-citius-blue bg-emerald-400"
          />
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-sm">Citius Concierge</h3>
          <p className="truncate text-white/80 text-xs">Citius Holidays</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {messages.length > 0 && (
          <m.button
            aria-label="Clear chat history"
            className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            onClick={onClear}
            title="Clear chat history"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Trash2 size={16} />
          </m.button>
        )}
        <m.button
          aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
          className="relative flex size-6 items-center justify-center overflow-hidden rounded-full p-1.5 text-sm text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          onClick={onToggleMinimize}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <AnimatePresence mode="wait">
            <m.span
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute inset-0 flex items-center justify-center"
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              key={isMinimized ? "minimized" : "maximized"}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {isMinimized ? "+" : "−"}
            </m.span>
          </AnimatePresence>
        </m.button>
        <m.button
          aria-label="Close chat"
          className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
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
    errorMessage,
    messagesContainerRef,
    updateMessages,
    handleInputChange,
    handleSubmit,
    setInput,
  } = useChatbotConversation();

  const handleEscapeClose = useEffectEvent(() => {
    onClose();
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        handleEscapeClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <m.div
        animate={{
          height: isMinimized ? "80px" : "min(650px, 85dvh)",
          opacity: 1,
          scale: 1,
        }}
        aria-label="Citius Concierge chat"
        className="fixed right-4 bottom-4 left-4 z-50 flex w-auto max-w-[400px] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-brand-border/50 bg-white shadow-2xl backdrop-blur-sm sm:right-6 sm:bottom-6 sm:left-auto sm:w-[400px]"
        exit={{ opacity: 0, scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.95 }}
        role="dialog"
        transition={{
          damping: 25,
          height: { duration: 0.4, ease: easeInOut },
          stiffness: 400,
          type: "spring",
        }}
      >
        <ChatbotPanelHeader
          isMinimized={isMinimized}
          messages={messages}
          onClear={() => updateMessages([])}
          onClose={onClose}
          onToggleMinimize={() => setIsMinimized(!isMinimized)}
        />

        <AnimatePresence mode="wait">
          {!isMinimized && (
            <m.div
              animate={{ height: "auto", opacity: 1 }}
              className="flex min-h-0 flex-1 flex-col"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div
                className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-50/80 to-white"
                ref={messagesContainerRef}
              >
                <div
                  className={messages.length === 0 ? "p-6" : "space-y-3 p-4 sm:space-y-4 sm:p-5"}
                >
                  {messages.length === 0 ? (
                    <ChatbotSuggestions onSelectPrompt={setInput} />
                  ) : (
                    <ChatbotMessageList
                      errorMessage={errorMessage}
                      isLoading={isLoading}
                      messages={messages}
                    />
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
