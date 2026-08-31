"use client";

import {
  ArrowUpRight,
  Building2,
  Check,
  Compass,
  FileText,
  Mountain,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";
import { CONCIERGE_TAB_HISTORY_POLICY } from "./useChatbotConversation";

const REQUEST_REFERENCE_PATTERN = /\sReference:\s([A-Za-z0-9][A-Za-z0-9._:-]{0,79})$/;

const CHATBOT_SUGGESTIONS = [
  {
    icon: Building2,
    label: "Shape a leadership retreat",
    prompt:
      "Help me shortlist destinations for a leadership offsite in Q4, with good hotels and local programme add-ons.",
  },
  {
    icon: Compass,
    label: "Explore a destination",
    prompt:
      "I want to explore a destination with Citius. Ask me the most useful questions before you suggest where to go.",
  },
  {
    icon: Mountain,
    label: "Plan a pilgrimage route",
    prompt:
      "What should I know before planning Kailash Mansarovar or another pilgrimage route with Citius?",
  },
  {
    icon: FileText,
    label: "Prepare an advisor brief",
    prompt:
      "Help me prepare a concise travel brief that I can confirm before sending it to a Citius advisor.",
  },
];

function splitErrorReference(message) {
  const match = message.match(REQUEST_REFERENCE_PATTERN);
  if (!match) {
    return { message, reference: "" };
  }
  return {
    message: message.slice(0, match.index).trim(),
    reference: match[1] || "",
  };
}

function CuratingIndicator() {
  return (
    <div className="flex items-center gap-3 text-slate-600 text-sm">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full bg-[#eef2f6]"
      >
        <Sparkles className="size-3.5 text-citius-blue" />
      </span>
      <span>
        <span className="block font-medium text-slate-800">Preparing your answer</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs">
          {[0, 0.2, 0.4].map((delay) => (
            <span
              className="chatbot-curating-dot size-1 rounded-full bg-slate-400"
              key={delay}
              style={{ "--chatbot-curating-delay": `${delay}s` }}
            />
          ))}
          Using Citius travel guidance
        </span>
      </span>
    </div>
  );
}

function useChatbotEntrance() {
  const shouldReduceMotion = !!useReducedMotion();
  return {
    animate: { opacity: 1, transform: "translate3d(0, 0, 0)" },
    initial: {
      opacity: 0,
      transform: shouldReduceMotion ? "none" : "translate3d(0, 8px, 0)",
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

function unseenErrorAnnouncement(lastMessage, errorMessage, announcedTerminalKeys) {
  const errorKey = lastMessage
    ? `${lastMessage.id}:${lastMessage.terminalState || "error"}:error`
    : `error:${errorMessage}`;
  if (announcedTerminalKeys.current.has(errorKey)) {
    return "";
  }
  announcedTerminalKeys.current.add(errorKey);
  return "Citius Concierge response could not be completed.";
}

function unseenTerminalAnnouncement(lastMessage, messages, announcedTerminalKeys) {
  if (!(lastMessage?.role === "assistant" && lastMessage.terminalState)) {
    return "";
  }
  const terminalKey = `${lastMessage.id}:${lastMessage.terminalState}`;
  if (announcedTerminalKeys.current.has(terminalKey)) {
    return "";
  }
  const nextAnnouncement = getTerminalAnnouncement(lastMessage, messages);
  if (nextAnnouncement) {
    announcedTerminalKeys.current.add(terminalKey);
  }
  return nextAnnouncement;
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
      setAnnouncement(unseenErrorAnnouncement(lastMessage, errorMessage, announcedTerminalKeys));
      return;
    }

    setAnnouncement(unseenTerminalAnnouncement(lastMessage, messages, announcedTerminalKeys));
  }, [announcedTerminalKeys, errorMessage, isActive, isLoading, messages]);

  return (
    <div aria-atomic="true" className="sr-only" role="status">
      {announcement}
    </div>
  );
}

const TOOL_LABELS = {
  getCitiusContactOptions: "Citius contact details",
  getCitiusProfile: "Citius company facts",
  getPilgrimageProgramDetails: "Published pilgrimage details",
  searchCitiusOfferings: "Citius travel options",
};

function ActivityRow({ complete, label }) {
  return (
    <div className="my-2 flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-slate-600 text-xs">
      <span
        aria-hidden="true"
        className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
          complete ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-citius-blue"
        }`}
      >
        {complete ? <Check className="size-3" /> : <Sparkles className="size-3" />}
      </span>
      {label}
    </div>
  );
}

function ErrorCopy({ text }) {
  const details = splitErrorReference(text);
  return (
    <div className="space-y-2">
      <p className="text-red-900 text-sm leading-relaxed">{details.message}</p>
      {details.reference ? (
        <p className="font-mono text-[11px] text-red-800/80">Reference {details.reference}</p>
      ) : null}
    </div>
  );
}

function AssistantStructuredPart({ part }) {
  if (part.type === "text") {
    return (
      <MessageResponse className="chatbot-formatted break-words text-[15px] text-slate-800 leading-6 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:font-semibold [&_h3]:text-[15px] [&_h3]:text-slate-950 [&_h3]:first:mt-0 [&_li]:mb-1 [&_ol]:my-2 [&_p:last-child]:mb-0 [&_p]:mb-2.5 [&_ul]:my-2">
        {part.text}
      </MessageResponse>
    );
  }
  if (part.type === "reasoning") {
    return (
      <ActivityRow
        complete={part.status === "complete"}
        label={
          part.status === "complete" ? "Relevant details checked" : "Checking relevant details"
        }
      />
    );
  }
  if (part.type === "tool") {
    const label = TOOL_LABELS[part.toolName] || "Citius travel details";
    const complete = part.status === "output-available";
    return (
      <ActivityRow
        complete={complete}
        label={complete ? `${label} checked` : `Checking ${label}`}
      />
    );
  }
  if (part.type === "status") {
    return part.status === "working" ? <ActivityRow complete={false} label={part.text} /> : null;
  }
  if (part.type === "error") {
    return <ErrorCopy text={part.text} />;
  }
  return null;
}

function ResponseActions({ message, onRegenerate, onRetry }) {
  if (message.terminalState === "complete") {
    return (
      <button
        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-slate-600 text-xs transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
        onClick={onRegenerate}
        type="button"
      >
        <RefreshCw aria-hidden="true" className="size-3.5" />
        Regenerate response
      </button>
    );
  }

  const copy = {
    cancelled: "Response stopped.",
    failed: "Response failed before it could finish.",
    interrupted: "Connection interrupted before completion.",
  }[message.terminalState];
  if (!copy) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-slate-200 border-t pt-3 text-xs">
      <span className="text-slate-600">{copy}</span>
      <button
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3 font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
        onClick={onRetry}
        type="button"
      >
        <RefreshCw aria-hidden="true" className="size-3.5" />
        Retry response
      </button>
    </div>
  );
}

export function ChatbotSuggestions({ onSelectPrompt }) {
  const entrance = useChatbotEntrance();
  const selectPrompt = (event) => onSelectPrompt(event.currentTarget.dataset.prompt);
  return (
    <m.div animate={entrance.animate} initial={entrance.initial} transition={entrance.transition}>
      <div className="rounded-[22px] bg-[#0e2238] px-5 py-4 text-white shadow-[0_20px_60px_rgba(14,34,56,0.16)]">
        <p className="max-w-sm text-pretty text-sm text-white/80 leading-6">
          Start with a destination, a date, or a rough idea. The Concierge will help you turn it
          into a clear travel brief.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-white/60 text-xs">
          <Sparkles aria-hidden="true" className="size-3" />
          Bounded history in this tab
        </p>
        <div className="mt-3 space-y-2 border-white/15 border-t pt-3 text-white/75 text-xs leading-5">
          <p>
            This tab keeps up to {CONCIERGE_TAB_HISTORY_POLICY.maxMessages} messages in browser
            session storage until you clear the conversation or the tab session ends.
          </p>
          <p>
            By sending a question, Citius processes the conversation to filter it; only the filtered
            copy goes to OpenRouter and a selected model provider to generate the reply. Their
            processing and retention terms may apply and remain under privacy review.
          </p>
          <p>
            Citius records only outcome, latency, grounding, model, fallback, and token-count
            telemetry—not prompt or reply text—and schedules it for deletion after 30 days.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {CHATBOT_SUGGESTIONS.map(({ prompt, label, icon: Icon }) => (
          <button
            className="group flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 text-sm shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2 motion-reduce:hover:translate-y-0"
            data-prompt={prompt}
            key={prompt}
            onClick={selectPrompt}
            type="button"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2f6] text-citius-blue">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1 break-words font-medium">{label}</span>
            <ArrowUpRight
              aria-hidden="true"
              className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
            />
          </button>
        ))}
      </div>
      <p className="mx-auto mt-4 max-w-sm text-center text-slate-500 text-xs leading-5">
        Recognizable contact, passport, payment, and secret patterns are removed before sending, but
        filters can miss sensitive data. Do not enter it here. Contact details are added to an
        advisor request only through the separate handoff after you consent.
      </p>
    </m.div>
  );
}

function AssistantMessage({ isLoading, isLast, message, onRegenerate, onRetry }) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#0e2238] text-white"
      >
        <Compass className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="mb-2 font-semibold text-slate-600 text-xs">Citius Concierge</p>
        {isLoading && !hasVisibleText(message) ? (
          <CuratingIndicator />
        ) : (
          <>
            {(message.parts || []).map((part) => (
              <div className="min-w-0" key={getMessagePartKey(message, part)}>
                <AssistantStructuredPart part={part} />
              </div>
            ))}
            {isLast ? (
              <ResponseActions message={message} onRegenerate={onRegenerate} onRetry={onRetry} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function ChatbotMessageList({ messages, isLoading, errorMessage, onRetry, onRegenerate }) {
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
      className="space-y-6"
      role="log"
    >
      {messages.map((message) => (
        <m.div
          animate={entrance.animate}
          initial={entrance.initial}
          key={message.id}
          transition={entrance.transition}
        >
          {message.role === "user" ? (
            <div className="ml-auto max-w-[88%] rounded-[20px] rounded-br-md bg-[#0e2238] px-4 py-3 text-[15px] text-white leading-6 shadow-sm">
              {(message.parts || []).map((part) =>
                part.type === "text" ? (
                  <p
                    className="whitespace-pre-wrap break-words"
                    key={getMessagePartKey(message, part)}
                  >
                    {part.text}
                  </p>
                ) : null
              )}
            </div>
          ) : (
            <AssistantMessage
              isLast={message.id === lastMessage?.id}
              isLoading={isLoading && message.id === lastMessage?.id}
              message={message}
              onRegenerate={onRegenerate}
              onRetry={onRetry}
            />
          )}
        </m.div>
      ))}
      {showCuratingBubble ? (
        <m.div
          animate={entrance.animate}
          initial={entrance.initial}
          transition={entrance.transition}
        >
          <CuratingIndicator />
        </m.div>
      ) : null}
      {errorMessage && !hasStructuredError ? (
        <m.div
          animate={entrance.animate}
          className="rounded-2xl border border-red-200 bg-red-50 p-4"
          initial={entrance.initial}
          transition={entrance.transition}
        >
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red-700" />
            <div className="min-w-0 flex-1">
              <ErrorCopy text={errorMessage} />
              <button
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-red-900 px-3 font-medium text-white text-xs transition-colors hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-red-900 focus-visible:outline-offset-2"
                onClick={onRetry}
                type="button"
              >
                <RefreshCw aria-hidden="true" className="size-3.5" />
                Retry response
              </button>
            </div>
          </div>
        </m.div>
      ) : null}
    </div>
  );
}
