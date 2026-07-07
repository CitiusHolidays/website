"use client";

import { Send } from "lucide-react";
import { m } from "motion/react";

export function ChatbotComposer({ input, inputRows, isLoading, onInputChange, onSubmit }) {
  return (
    <div className="flex-shrink-0 border-brand-border/50 border-t bg-white p-4">
      <form className="flex gap-2" onSubmit={onSubmit}>
        <textarea
          aria-label="Chat message"
          className="min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-brand-border bg-gray-50/50 px-4 py-3 text-brand-dark text-sm transition-all placeholder:text-brand-muted focus:border-citius-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-citius-blue/20"
          disabled={isLoading}
          onChange={onInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
          placeholder="Destinations, MICE, spiritual trails, or proposal handoff…"
          rows={inputRows}
          style={{
            maxHeight: inputRows > 1 ? `${inputRows * 24 + 24}px` : "48px",
            minHeight: "48px",
          }}
          value={input}
        />
        <m.button
          aria-label="Send message"
          className="shrink-0 self-end rounded-xl bg-citius-blue p-3 text-white shadow-sm transition-all hover:bg-citius-blue/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          disabled={isLoading || !input.trim()}
          type="submit"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Send aria-hidden="true" size={18} />
        </m.button>
      </form>
    </div>
  );
}
