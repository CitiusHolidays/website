"use client";

import { m } from "motion/react";
import DOMPurify from "dompurify";
import parse from "html-react-parser";
import { MessageCircle } from "lucide-react";

function renderFormattedText(text, isStreaming = false) {
  if (!text) return null;

  if (isStreaming) {
    const plainText = text.replace(/<[^>]*>/g, "");
    return <div className="whitespace-pre-wrap leading-relaxed">{plainText}</div>;
  }

  try {
    const sanitizedHTML = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "a",
        "code",
        "pre",
        "blockquote",
        "span",
        "div",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class", "id"],
    });

    return (
      <div className="formatted-content whitespace-pre-wrap leading-relaxed">
        {parse(sanitizedHTML)}
      </div>
    );
  } catch (error) {
    console.error("Error parsing HTML:", error);
    return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>;
  }
}

export function ChatbotSuggestions({ onSelectPrompt }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="text-center mt-8"
    >
      <div className="size-16 bg-citius-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <MessageCircle size={32} className="text-citius-blue" />
      </div>
      <h4 className="text-lg font-semibold text-brand-dark mb-2">Welcome! 👋</h4>
      <p className="text-sm text-brand-muted leading-relaxed max-w-xs mx-auto">
        I&apos;m your travel assistant. Ask me anything about destinations, travel tips, or planning
        your next adventure!
      </p>
      <div className="mt-6 space-y-2">
        {[
          ["What are the best destinations for summer?", "✈️ Best summer destinations"],
          ["How do I plan a budget trip?", "💰 Budget travel tips"],
          ["What are the most popular destinations?", "🌟 Popular destinations"],
        ].map(([prompt, label]) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 border border-brand-border rounded-xl text-sm text-brand-dark transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </m.div>
  );
}

export function ChatbotMessageList({ messages, isLoading }) {
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
            className={`max-w-[96%] px-4 py-3 rounded-2xl ${
              message.role === "user"
                ? "bg-green-600 text-white rounded-br-md shadow-sm ml-auto"
                : "bg-gray-100 text-gray-800 border border-gray-200 rounded-bl-md shadow-sm mr-auto"
            }`}
          >
            {message.parts.map((part) => (
              <div key={`${message.id}-${part.type}-${part.text}`} className="text-sm">
                {part.type === "text" && renderFormattedText(part.text, message.isStreaming)}
              </div>
            ))}
          </div>
        </m.div>
      ))}
      {isLoading && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md border border-gray-200 shadow-sm mr-auto">
            <div className="flex gap-1 items-center">
              {[0, 0.2, 0.4].map((delay) => (
                <m.div
                  key={delay}
                  className="size-1.5 bg-gray-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                    delay,
                  }}
                />
              ))}
            </div>
          </div>
        </m.div>
      )}
    </>
  );
}
