"use client";

import { Compass, Minus, Trash2 } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { ControlledDialog, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";
import { PlusIcon, useAnimatedIconTrigger, XIcon } from "./AnimatedLucideIcons";
import { ChatbotComposer } from "./ChatbotComposer";
import { ChatbotAnnouncement, ChatbotMessageList, ChatbotSuggestions } from "./ChatbotMessages";
import { ConciergeContactHandoff } from "./ConciergeContactHandoff";
import TurnstileWidget from "./TurnstileWidget";
import { useChatbotConversation } from "./useChatbotConversation";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

function HeaderAction({ children, iconRef, label, onClick, reference }) {
  const iconTrigger = useAnimatedIconTrigger(iconRef);
  return (
    <button
      aria-label={label}
      className="inline-flex size-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
      onClick={onClick}
      ref={reference}
      title={label}
      type="button"
      {...iconTrigger}
    >
      {children}
    </button>
  );
}

function ChatbotPanelHeader({
  closeButtonRef,
  messages,
  isMinimized,
  onClear,
  onToggleMinimize,
  onClose,
}) {
  const closeIconRef = useRef(null);
  const expandIconRef = useRef(null);
  return (
    <header className="flex flex-shrink-0 items-center justify-between border-slate-200 border-b bg-white px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#0e2238] text-white shadow-sm"
        >
          <Compass className="size-5" />
        </span>
        <div className="min-w-0">
          <ControlledDialogTitle className="truncate font-heading font-semibold text-[15px] text-slate-950 tracking-[-0.01em]">
            Citius Concierge
          </ControlledDialogTitle>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {messages.length > 0 ? (
          <HeaderAction label="Clear conversation" onClick={onClear}>
            <Trash2 aria-hidden="true" className="size-4" />
          </HeaderAction>
        ) : null}
        <HeaderAction
          iconRef={expandIconRef}
          label={isMinimized ? "Expand chat" : "Minimize chat"}
          onClick={onToggleMinimize}
        >
          {isMinimized ? (
            <PlusIcon aria-hidden="true" ref={expandIconRef} size={16} />
          ) : (
            <Minus aria-hidden="true" className="size-4" />
          )}
        </HeaderAction>
        <HeaderAction
          iconRef={closeIconRef}
          label="Close chat"
          onClick={onClose}
          reference={closeButtonRef}
        >
          <XIcon aria-hidden="true" ref={closeIconRef} size={16} />
        </HeaderAction>
      </div>
    </header>
  );
}

function chatPanelHeightClass(isMinimized, avoidsMobileBottomBar) {
  if (isMinimized) {
    return "h-[72px]";
  }
  if (avoidsMobileBottomBar) {
    return "safe-area-mobile-bottom-bar-panel";
  }
  return "h-[min(680px,calc(100dvh-1rem))]";
}

export function ChatbotWindow({ avoidsMobileBottomBar = false, isOpen, onClose, openerRef }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [turnstileGeneration, setTurnstileGeneration] = useState(0);
  const shouldReduceMotion = !!useReducedMotion();
  const closeButtonRef = useRef(null);
  const announcedTerminalKeys = useRef(new Set());
  const turnstileTokenRef = useRef("");
  const readTurnstileToken = () => turnstileTokenRef.current;
  const handleTurnstileVerify = (token) => {
    turnstileTokenRef.current = token;
  };
  const clearTurnstileToken = () => {
    turnstileTokenRef.current = "";
  };
  const consumeTurnstileToken = () => {
    turnstileTokenRef.current = "";
    setTurnstileGeneration((current) => current + 1);
  };
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
    regenerateLastResponse,
    retryLastResponse,
    setInput,
  } = useChatbotConversation({
    getTurnstileToken: readTurnstileToken,
    onTurnstileConsumed: consumeTurnstileToken,
    turnstileRequired: Boolean(TURNSTILE_SITE_KEY),
  });

  const handleClose = () => {
    cancelActiveRequest();
    onClose();
  };
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      handleClose();
    }
  };
  const toggleMinimized = () => setIsMinimized((current) => !current);
  const handleClear = () => {
    announcedTerminalKeys.current.clear();
    clearConversation();
  };

  return (
    <ControlledDialog
      backdropClassName="chatbot-dialog-backdrop pointer-events-auto fixed inset-0 bg-slate-950/5 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none"
      initialFocus={closeButtonRef}
      onOpenChange={handleOpenChange}
      open={isOpen}
      popupClassName={`safe-area-fixed-panel pointer-events-auto fixed z-50 flex w-[calc(100vw-1rem)] max-w-[440px] origin-bottom-right flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8f7f4] shadow-[0_28px_90px_rgba(15,23,42,0.22)] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-[starting-style]:opacity-0 data-[starting-style]:[transform:translateY(12px)_scale(0.98)] data-[ending-style]:opacity-0 data-[ending-style]:[transform:translateY(12px)_scale(0.98)] motion-reduce:data-[starting-style]:[transform:none] motion-reduce:data-[ending-style]:[transform:none] ${
        avoidsMobileBottomBar ? "mobile-bottom-bar-offset" : ""
      } ${chatPanelHeightClass(isMinimized, avoidsMobileBottomBar)}`}
      popupFinalFocus={openerRef}
      popupRender={
        <m.div
          animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }}
          id="citius-concierge-dialog"
          initial={{
            opacity: 0,
            transform: shouldReduceMotion ? "none" : "translate3d(0, 10px, 0) scale(0.98)",
          }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: PUBLIC_EASE_OUT }}
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
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
            ref={messagesContainerRef}
          >
            <div className={messages.length === 0 ? "p-4 sm:p-5" : "p-4 sm:p-5"}>
              {messages.length === 0 ? <ChatbotSuggestions onSelectPrompt={setInput} /> : null}
              <ChatbotMessageList
                errorMessage={errorMessage}
                isLoading={isLoading}
                messages={messages}
                onRegenerate={regenerateLastResponse}
                onRetry={retryLastResponse}
              />
            </div>
          </div>

          <ConciergeContactHandoff />
          {TURNSTILE_SITE_KEY ? (
            <div className="pointer-events-auto absolute inset-x-2 bottom-20 z-10 flex justify-center">
              <TurnstileWidget
                appearance="interaction-only"
                key={turnstileGeneration}
                onError={clearTurnstileToken}
                onExpire={clearTurnstileToken}
                onVerify={handleTurnstileVerify}
                siteKey={TURNSTILE_SITE_KEY}
              />
            </div>
          ) : null}
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
