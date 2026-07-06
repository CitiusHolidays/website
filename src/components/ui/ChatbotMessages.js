"use client";

import { Building2, Compass, FileText, Mountain } from "lucide-react";
import { m } from "motion/react";
import { MessageResponse } from "@/components/ai-elements/message";

const CHATBOT_SUGGESTIONS = [
  {
    prompt:
      "We need a premium MICE programme for about 80 people. Can you outline what Citius typically handles and what details you would need from us?",
    label: "Corporate offsite or MICE planning",
    icon: Building2,
  },
  {
    prompt:
      "Help me shortlist destinations for a leadership retreat in Q4. We want something premium, not too far from India, with strong hotels and experiences.",
    label: "Destination shortlist for a retreat",
    icon: Compass,
  },
  {
    prompt:
      "What should we know about Kailash Mansarovar and other spiritual trail options with Citius?",
    label: "Kailash and spiritual trail programmes",
    icon: Mountain,
  },
  {
    prompt:
      "We are ready for a tailored proposal. What information should we share so the Citius team can take over?",
    label: "Hand off for a tailored proposal",
    icon: FileText,
  },
];

function CuratingIndicator() {
  return (
    <span className="inline-flex items-center gap-2 text-brand-muted text-sm">
      <span className="flex gap-1 items-center" aria-hidden="true">
        {[0, 0.2, 0.4].map((delay) => (
          <m.span
            key={delay}
            className="size-1.5 bg-brand-muted/60 rounded-full"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              delay,
            }}
          />
        ))}
      </span>
      Curating…
    </span>
  );
}

function getMessagePartKey(message, part) {
  return `${message.id}-${part.type}-${part.text || part.toolCallId || "empty"}`;
}

function getTextParts(message) {
  return Array.isArray(message.parts) ? message.parts.filter((part) => part.type === "text") : [];
}

function hasVisibleText(message) {
  return getTextParts(message).some((part) => part.text?.trim());
}

export function ChatbotSuggestions({ onSelectPrompt }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="text-center mt-4"
    >
      <h4 className="text-lg font-semibold text-brand-dark mb-2">Citius Concierge</h4>
      <p className="text-sm text-brand-muted leading-relaxed max-w-xs mx-auto">
        Premium travel guidance for MICE, curated destinations, spiritual trails, and handing you
        over to our specialists with a clear brief.
      </p>
      <div className="mt-5 space-y-2">
        {CHATBOT_SUGGESTIONS.map(({ prompt, label, icon: Icon }) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 border border-brand-border rounded-xl text-sm text-brand-dark transition-colors flex items-start gap-3"
          >
            <Icon size={16} className="text-citius-blue shrink-0 mt-0.5" aria-hidden="true" />
            <span className="min-w-0 break-words">{label}</span>
          </button>
        ))}
      </div>
    </m.div>
  );
}

export function ChatbotMessageList({ messages, isLoading, errorMessage }) {
  const lastMessage = messages[messages.length - 1];
  const hasStreamingAssistant = lastMessage?.role === "assistant" && isLoading;
  const showCuratingBubble = isLoading && !hasStreamingAssistant;

  return (
    <>
      {messages.map((message) => (
        <m.div
          key={message.id}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2 }}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[96%] min-w-0 px-4 py-3 rounded-2xl ${
              message.role === "user"
                ? "bg-citius-blue text-white rounded-br-md shadow-sm ml-auto"
                : "bg-gray-50 text-brand-dark border border-brand-border/60 rounded-bl-md shadow-sm mr-auto"
            }`}
          >
            {message.role === "assistant" &&
            isLoading &&
            message.id === lastMessage?.id &&
            !hasVisibleText(message) ? (
              <CuratingIndicator />
            ) : (
              getTextParts(message).map((part) => (
                <div key={getMessagePartKey(message, part)} className="min-w-0 text-sm">
                  {message.role === "user" ? (
                    <div className="whitespace-pre-wrap leading-relaxed break-words">
                      {part.text}
                    </div>
                  ) : (
                    <MessageResponse className="chatbot-formatted text-sm leading-relaxed break-words [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-brand-dark [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:first:mt-0 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:mb-0.5">
                      {part.text}
                    </MessageResponse>
                  )}
                </div>
              ))
            )}
          </div>
        </m.div>
      ))}
      {showCuratingBubble && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="bg-gray-50 px-4 py-3 rounded-2xl rounded-bl-md border border-brand-border/60 shadow-sm mr-auto">
            <CuratingIndicator />
          </div>
        </m.div>
      )}
      {errorMessage && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="bg-red-50 px-4 py-3 rounded-2xl rounded-bl-md border border-red-100 text-sm text-red-700 shadow-sm mr-auto">
            {errorMessage}
          </div>
        </m.div>
      )}
    </>
  );
}
