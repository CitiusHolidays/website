"use client";

import { Send } from "lucide-react";
import { m } from "motion/react";

export function ChatbotComposer({ input, inputRows, isLoading, onInputChange, onSubmit }) {
  return (
    <div className="p-4 bg-white border-t border-brand-border/50 flex-shrink-0">
      <form onSubmit={onSubmit} className="flex gap-2">
        <textarea
          value={input}
          onChange={onInputChange}
          aria-label="Chat message"
          placeholder="Destinations, MICE, spiritual trails, or proposal handoff…"
          rows={inputRows}
          className="flex-1 min-w-0 px-4 py-3 border text-brand-dark placeholder:text-brand-muted border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-citius-blue/20 focus:border-citius-blue transition-all bg-gray-50/50 focus:bg-white text-sm resize-none overflow-y-auto"
          style={{
            minHeight: "48px",
            maxHeight: inputRows > 1 ? `${inputRows * 24 + 24}px` : "48px",
          }}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
        />
        <m.button
          type="submit"
          disabled={isLoading || !input.trim()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-citius-blue hover:bg-citius-blue/90 text-white p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm hover:shadow-md self-end shrink-0"
          aria-label="Send message"
        >
          <Send size={18} aria-hidden="true" />
        </m.button>
      </form>
    </div>
  );
}
