"use client";

import { Building2, Compass, FileText, Mountain } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";

const CHATBOT_SUGGESTIONS = [
  {
    icon: Building2,
    label: "Corporate offsite or MICE planning",
    prompt:
      "We need a premium MICE programme for about 80 people. Can you outline what Citius typically handles and what details you would need from us?",
  },
  {
    icon: Compass,
    label: "Destination shortlist for a retreat",
    prompt:
      "Help me shortlist destinations for a leadership retreat in Q4. We want something premium, not too far from India, with strong hotels and experiences.",
  },
  {
    icon: Mountain,
    label: "Kailash and spiritual trail programmes",
    prompt:
      "What should we know about Kailash Mansarovar and other spiritual trail options with Citius?",
  },
  {
    icon: FileText,
    label: "Hand off for a tailored proposal",
    prompt:
      "We are ready for a tailored proposal. What information should we share so the Citius team can take over?",
  },
];

function CuratingIndicator() {
  return (
    <span className="inline-flex items-center gap-2 text-brand-muted text-sm">
      <span aria-hidden="true" className="flex items-center gap-1">
        {[0, 0.2, 0.4].map((delay) => (
          <span
            className="chatbot-curating-dot size-1.5 rounded-full bg-brand-muted/60"
            key={delay}
            style={{ "--chatbot-curating-delay": `${delay}s` }}
          />
        ))}
      </span>
      Curating…
    </span>
  );
}

function useChatbotEntrance() {
  const shouldReduceMotion = !!useReducedMotion();
  return {
    animate: { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
    initial: {
      opacity: 0,
      transform: shouldReduceMotion ? "none" : "translate3d(0, 10px, 0) scale(0.98)",
    },
    transition: { duration: shouldReduceMotion ? 0 : 0.18, ease: PUBLIC_EASE_OUT },
  };
}

function getMessagePartKey(message, part) {
  return `${message.id}-${part.type}-${part.id}`;
}

function getTextParts(message) {
  return Array.isArray(message.parts) ? message.parts.filter((part) => part.type === "text") : [];
}

function hasVisibleText(message) {
  return getTextParts(message).some((part) => part.text?.trim());
}

function getMessageText(message) {
  return getTextParts(message)
    .flatMap((part) => {
      const text = part.text?.trim();
      return text ? [text] : [];
    })
    .join("\n");
}

function getTerminalAnnouncement(message, messages) {
  if (message.terminalState === "complete") {
    const completedResponseCount = messages.filter(
      (candidate) => candidate.role === "assistant" && candidate.terminalState === "complete"
    ).length;
    const responseText = getMessageText(message);
    return responseText
      ? `Citius Concierge response ${completedResponseCount}: ${responseText}`
      : `Citius Concierge response ${completedResponseCount} is ready.`;
  }
  if (message.terminalState === "cancelled") {
    return "Citius Concierge response was cancelled.";
  }
  if (["failed", "interrupted"].includes(message.terminalState)) {
    return "Citius Concierge response could not be completed.";
  }
  return "";
}

export function ChatbotAnnouncement({
  announcedTerminalKeys,
  errorMessage,
  isActive,
  isLoading,
  messages,
}) {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!isActive) {
      setAnnouncement("");
      return;
    }

    const lastMessage = messages.at(-1);
    if (isLoading) {
      setAnnouncement("Citius Concierge is preparing a response.");
      return;
    }

    if (errorMessage) {
      const errorKey = lastMessage
        ? `${lastMessage.id}:${lastMessage.terminalState || "error"}:error`
        : `error:${errorMessage}`;
      if (announcedTerminalKeys.current.has(errorKey)) {
        setAnnouncement("");
        return;
      }
      announcedTerminalKeys.current.add(errorKey);
      setAnnouncement("Citius Concierge response could not be completed.");
      return;
    }

    if (lastMessage?.role === "assistant" && lastMessage.terminalState) {
      const terminalKey = `${lastMessage.id}:${lastMessage.terminalState}`;
      if (announcedTerminalKeys.current.has(terminalKey)) {
        setAnnouncement("");
        return;
      }

      const nextAnnouncement = getTerminalAnnouncement(lastMessage, messages);

      if (nextAnnouncement) {
        announcedTerminalKeys.current.add(terminalKey);
        setAnnouncement(nextAnnouncement);
        return;
      }
    }

    setAnnouncement("");
  }, [announcedTerminalKeys, errorMessage, isActive, isLoading, messages]);

  return (
    <div aria-atomic="true" className="sr-only" role="status">
      {announcement}
    </div>
  );
}

const TOOL_LABELS = {
  getCitiusContactOptions: "Citius contact options",
  getCitiusProfile: "Citius company details",
  getPilgrimageProgramDetails: "pilgrimage programme details",
  searchCitiusOfferings: "Citius travel options",
};

function AssistantStructuredPart({ part }) {
  if (part.type === "text") {
    return (
      <MessageResponse className="chatbot-formatted break-words text-sm leading-relaxed [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-brand-dark [&_h3]:text-sm [&_h3]:first:mt-0 [&_li]:mb-0.5 [&_ol]:my-1 [&_p:last-child]:mb-0 [&_p]:mb-1.5 [&_ul]:my-1">
        {part.text}
      </MessageResponse>
    );
  }
  if (part.type === "reasoning") {
    return (
      <p className="text-brand-muted text-xs">
        {part.status === "complete"
          ? "Relevant travel details considered"
          : "Considering relevant travel details…"}
      </p>
    );
  }
  if (part.type === "tool") {
    const label = TOOL_LABELS[part.toolName] || "Citius travel details";
    const complete = part.status === "output-available";
    return (
      <p className="text-brand-muted text-xs">
        {complete ? `${label} checked` : `Checking ${label}…`}
      </p>
    );
  }
  if (part.type === "status") {
    return part.status === "working" ? (
      <p className="text-brand-muted text-xs">{part.text}…</p>
    ) : null;
  }
  if (part.type === "error") {
    return <p className="text-red-700 text-sm">{part.text}</p>;
  }
  return null;
}

function TerminalNotice({ message, onRetry }) {
  const copy = {
    cancelled: "Response cancelled.",
    failed: "Response failed before it could finish.",
    interrupted: "Response interrupted before completion.",
  }[message.terminalState];
  if (!copy) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-brand-border/60 border-t pt-2 text-xs">
      <span className="text-brand-muted">{copy}</span>
      <button
        className="font-medium text-citius-blue underline-offset-2 hover:underline"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}

export function ChatbotSuggestions({ onSelectPrompt }) {
  const entrance = useChatbotEntrance();
  const selectPrompt = useCallback(
    (event) => onSelectPrompt(event.currentTarget.dataset.prompt),
    [onSelectPrompt]
  );
  return (
    <m.div
      animate={entrance.animate}
      className="mt-4 text-center"
      initial={entrance.initial}
      transition={{ ...entrance.transition, delay: 0.1 }}
    >
      <h4 className="mb-2 font-semibold text-brand-dark text-lg">Citius Concierge</h4>
      <p className="mx-auto max-w-xs text-brand-muted text-sm leading-relaxed">
        Premium travel guidance for MICE, curated destinations, spiritual trails, and handing you
        over to our specialists with a clear brief.
      </p>
      <p className="mx-auto mt-2 max-w-xs text-brand-muted text-xs">
        Please do not include passport, payment, or other sensitive personal information.
      </p>
      <div className="mt-5 space-y-2">
        {CHATBOT_SUGGESTIONS.map(({ prompt, label, icon: Icon }) => (
          <button
            className="flex w-full items-start gap-3 rounded-xl border border-brand-border bg-white px-4 py-3 text-left text-brand-dark text-sm transition-colors hover:bg-gray-50"
            data-prompt={prompt}
            key={prompt}
            onClick={selectPrompt}
            type="button"
          >
            <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-citius-blue" size={16} />
            <span className="min-w-0 break-words">{label}</span>
          </button>
        ))}
      </div>
    </m.div>
  );
}

export function ChatbotMessageList({ messages, isLoading, errorMessage, onRetry }) {
  const entrance = useChatbotEntrance();
  const lastMessage = messages.at(-1);
  const hasStreamingAssistant = lastMessage?.role === "assistant" && isLoading;
  const showCuratingBubble = isLoading && !hasStreamingAssistant;
  const hasStructuredError = lastMessage?.parts?.some((part) => part.type === "error");
  return (
    <div
      aria-busy={isLoading ? "true" : "false"}
      aria-label="Citius Concierge conversation"
      aria-live="off"
      className="space-y-3 sm:space-y-4"
      role="log"
    >
      {messages.map((message) => (
        <m.div
          animate={entrance.animate}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          initial={entrance.initial}
          key={message.id}
          transition={entrance.transition}
        >
          <div
            className={`min-w-0 max-w-[96%] rounded-2xl px-4 py-3 ${
              message.role === "user"
                ? "ml-auto rounded-br-md bg-citius-blue text-white shadow-sm"
                : "mr-auto rounded-bl-md border border-brand-border/60 bg-gray-50 text-brand-dark shadow-sm"
            }`}
          >
            {message.role === "assistant" &&
            isLoading &&
            message.id === lastMessage?.id &&
            !hasVisibleText(message) ? (
              <CuratingIndicator />
            ) : (
              <>
                {(message.parts || []).map((part) => (
                  <div className="min-w-0 text-sm" key={getMessagePartKey(message, part)}>
                    {message.role === "user" && part.type === "text" ? (
                      <div className="whitespace-pre-wrap break-words leading-relaxed">
                        {part.text}
                      </div>
                    ) : (
                      <AssistantStructuredPart part={part} />
                    )}
                  </div>
                ))}
                {message.role === "assistant" && message.id === lastMessage?.id ? (
                  <TerminalNotice message={message} onRetry={onRetry} />
                ) : null}
              </>
            )}
          </div>
        </m.div>
      ))}
      {showCuratingBubble ? (
        <m.div
          animate={entrance.animate}
          className="flex justify-start"
          initial={entrance.initial}
          transition={entrance.transition}
        >
          <div className="mr-auto rounded-2xl rounded-bl-md border border-brand-border/60 bg-gray-50 px-4 py-3 shadow-sm">
            <CuratingIndicator />
          </div>
        </m.div>
      ) : null}
      {errorMessage && !hasStructuredError ? (
        <m.div
          animate={entrance.animate}
          className="flex justify-start"
          initial={entrance.initial}
          transition={entrance.transition}
        >
          <div className="mr-auto rounded-2xl rounded-bl-md border border-red-100 bg-red-50 px-4 py-3 text-red-700 text-sm shadow-sm">
            {errorMessage}
          </div>
        </m.div>
      ) : null}
    </div>
  );
}
