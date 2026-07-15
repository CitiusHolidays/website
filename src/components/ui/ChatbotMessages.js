"use client";

import { Building2, Compass, FileText, Mountain } from "lucide-react";
import { m } from "motion/react";
import { MessageResponse } from "@/components/ai-elements/message";

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
          <m.span
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
            className="size-1.5 rounded-full bg-brand-muted/60"
            key={delay}
            transition={{
              delay,
              duration: 1,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
            }}
          />
        ))}
      </span>
      Curating…
    </span>
  );
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
      <p className="text-brand-muted text-xs" role="status">
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
      <p className="text-brand-muted text-xs" role="status">
        {complete ? `${label} checked` : `Checking ${label}…`}
      </p>
    );
  }
  if (part.type === "status") {
    return part.status === "working" ? (
      <p className="text-brand-muted text-xs" role="status">
        {part.text}…
      </p>
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
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 text-center"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.1 }}
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
            key={prompt}
            onClick={() => onSelectPrompt(prompt)}
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
  const lastMessage = messages[messages.length - 1];
  const hasStreamingAssistant = lastMessage?.role === "assistant" && isLoading;
  const showCuratingBubble = isLoading && !hasStreamingAssistant;
  const hasStructuredError = lastMessage?.parts?.some((part) => part.type === "error");

  return (
    <>
      {messages.map((message) => (
        <m.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          key={message.id}
          transition={{ duration: 0.2 }}
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
      {showCuratingBubble && (
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
          initial={{ opacity: 0, y: 10 }}
        >
          <div className="mr-auto rounded-2xl rounded-bl-md border border-brand-border/60 bg-gray-50 px-4 py-3 shadow-sm">
            <CuratingIndicator />
          </div>
        </m.div>
      )}
      {errorMessage && !hasStructuredError && (
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
          initial={{ opacity: 0, y: 10 }}
        >
          <div className="mr-auto rounded-2xl rounded-bl-md border border-red-100 bg-red-50 px-4 py-3 text-red-700 text-sm shadow-sm">
            {errorMessage}
          </div>
        </m.div>
      )}
    </>
  );
}
