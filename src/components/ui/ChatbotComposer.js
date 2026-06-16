"use client";

import { m } from "motion/react";
import { Send } from "lucide-react";

export function ChatbotComposer({ input, inputRows, isLoading, onInputChange, onSubmit }) {
  return (
    <div className="p-4 bg-white border-t border-brand-border/50 flex-shrink-0">
      <form onSubmit={onSubmit} className="flex gap-2">
        <textarea
          value={input}
          onChange={onInputChange}
          aria-label="Chat message"
          placeholder="Ask about destinations, tips…"
          rows={inputRows}
          className="flex-1 px-4 py-3 border text-brand-dark placeholder:text-brand-muted border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-citius-blue/20 focus:border-citius-blue transition-all bg-gray-50/50 focus:bg-white text-sm resize-none overflow-y-auto"
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
          className="bg-green-600 hover:bg-green-600/90 text-white p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm hover:shadow-md self-end"
        >
          <Send size={18} />
        </m.button>
      </form>
    </div>
  );
}
