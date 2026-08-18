"use client";

import { Compass, Minus, Plus, Trash2, X } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { ControlledDialog, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";
import { ChatbotComposer } from "./ChatbotComposer";
import { ChatbotAnnouncement, ChatbotMessageList, ChatbotSuggestions } from "./ChatbotMessages";
import { ConciergeContactHandoff } from "./ConciergeContactHandoff";
import { useChatbotConversation } from "./useChatbotConversation";

function ChatbotPanelHeader({
  closeButtonRef,
  messages,
  isMinimized,
  onClear,
  onToggleMinimize,
  onClose,
}) {
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
          <ControlledDialogTitle className="truncate font-semibold text-sm">
            Citius Concierge
          </ControlledDialogTitle>
          <p className="truncate text-white/80 text-xs">Citius Holidays</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {messages.length > 0 ? (
          <button
            aria-label="Clear chat history"
            className="flex size-7 items-center justify-center rounded-full text-white/80 transition-[background-color,color,transform] duration-150 hover:bg-white/15 hover:text-white active:scale-[0.97]"
            onClick={onClear}
            title="Clear chat history"
            type="button"
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        ) : null}
        <button
          aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
          className="relative flex size-7 items-center justify-center overflow-hidden rounded-full text-white/80 transition-[background-color,color,transform] duration-150 hover:bg-white/15 hover:text-white active:scale-[0.97]"
          onClick={onToggleMinimize}
          type="button"
        >
          {isMinimized ? (
            <Plus aria-hidden="true" size={16} />
          ) : (
            <Minus aria-hidden="true" size={16} />
          )}
        </button>
        <button
          aria-label="Close chat"
          className="flex size-7 items-center justify-center rounded-full text-white/80 transition-[background-color,color,transform] duration-150 hover:bg-white/15 hover:text-white active:scale-[0.97]"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}

function chatPanelHeightClass(isMinimized, avoidsMobileBottomBar) {
  if (isMinimized) {
    return "h-20";
  }
  if (avoidsMobileBottomBar) {
    return "safe-area-mobile-bottom-bar-panel";
  }
  return "h-[min(650px,85dvh)]";
}

export function ChatbotWindow({ avoidsMobileBottomBar = false, isOpen, onClose, openerRef }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const shouldReduceMotion = !!useReducedMotion();
  const closeButtonRef = useRef(null);
  const announcedTerminalKeys = useRef(new Set());
  const {
    messages,
    input,
    isLoading,
    inputRows,
    errorMessage,
    messagesContainerRef,
    cancelActiveRequest,
    clearConversation,
    handleInputChange,
    handleSubmit,
    retryLastResponse,
    setInput,
  } = useChatbotConversation();

  const handleClose = useCallback(() => {
    cancelActiveRequest();
    onClose();
  }, [cancelActiveRequest, onClose]);
  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen) {
        handleClose();
      }
    },
    [handleClose]
  );
  const toggleMinimized = useCallback(() => setIsMinimized((current) => !current), []);
  const handleClear = useCallback(() => {
    announcedTerminalKeys.current.clear();
    clearConversation();
  }, [clearConversation]);

  const panelHeightClass = chatPanelHeightClass(isMinimized, avoidsMobileBottomBar);

  return (
    <ControlledDialog
      backdropClassName="pointer-events-auto fixed inset-0 bg-transparent"
      initialFocus={closeButtonRef}
      onOpenChange={handleOpenChange}
      open={isOpen}
      popupClassName={`safe-area-fixed-panel pointer-events-auto fixed z-50 flex w-auto max-w-[400px] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-brand-border/50 bg-white shadow-2xl transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-[starting-style]:opacity-0 data-[starting-style]:[transform:scale(0.95)] data-[ending-style]:opacity-0 data-[ending-style]:[transform:scale(0.95)] motion-reduce:data-[starting-style]:[transform:none] motion-reduce:data-[ending-style]:[transform:none] sm:w-[400px] ${
        avoidsMobileBottomBar ? "mobile-bottom-bar-offset" : ""
      } ${panelHeightClass}`}
      popupFinalFocus={openerRef}
      popupRender={
        <m.div
          animate={{ opacity: 1, transform: "scale(1)" }}
          id="citius-concierge-dialog"
          initial={{
            opacity: 0,
            transform: shouldReduceMotion ? "none" : "scale(0.95)",
          }}
          transition={{ duration: 0.2, ease: PUBLIC_EASE_OUT }}
        />
      }
      triggerless
      viewportClassName="pointer-events-none fixed inset-0 z-50"
    >
      <ChatbotPanelHeader
        closeButtonRef={closeButtonRef}
        isMinimized={isMinimized}
        messages={messages}
        onClear={handleClear}
        onClose={handleClose}
        onToggleMinimize={toggleMinimized}
      />

      <ChatbotAnnouncement
        announcedTerminalKeys={announcedTerminalKeys}
        errorMessage={errorMessage}
        isActive={isOpen && !isMinimized}
        isLoading={isLoading}
        messages={messages}
      />

      {isMinimized ? null : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-slate-50/80 to-white"
            ref={messagesContainerRef}
          >
            <div className={messages.length === 0 ? "p-6" : "space-y-3 p-4 sm:space-y-4 sm:p-5"}>
              {messages.length === 0 ? <ChatbotSuggestions onSelectPrompt={setInput} /> : null}
              <ChatbotMessageList
                errorMessage={errorMessage}
                isLoading={isLoading}
                messages={messages}
                onRetry={retryLastResponse}
              />
            </div>
          </div>

          <ConciergeContactHandoff />
          <ChatbotComposer
            input={input}
            inputRows={inputRows}
            isLoading={isLoading}
            onCancel={cancelActiveRequest}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </ControlledDialog>
  );
}
