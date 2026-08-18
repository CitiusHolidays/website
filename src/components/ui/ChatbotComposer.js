"use client";

import { Send, Square } from "lucide-react";
import { useCallback } from "react";

export function ChatbotComposer({
  input,
  inputRows,
  isLoading,
  onCancel,
  onInputChange,
  onSubmit,
}) {
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        onSubmit(event);
      }
    },
    [onSubmit]
  );

  return (
    <div className="flex-shrink-0 border-brand-border/50 border-t bg-white p-4">
      <form className="flex gap-2" onSubmit={onSubmit}>
        <textarea
          aria-label="Chat message"
          className="min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-brand-border bg-gray-50/50 px-4 py-3 text-brand-dark text-sm transition-[border-color,background-color,box-shadow] placeholder:text-brand-muted focus:border-citius-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-citius-blue/20"
          disabled={isLoading}
          onChange={onInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Destinations, MICE, spiritual trails, or proposal handoff…"
          rows={inputRows}
          style={{
            maxHeight: inputRows > 1 ? `${inputRows * 24 + 24}px` : "48px",
            minHeight: "48px",
          }}
          value={input}
        />
        {isLoading ? (
          <button
            aria-label="Cancel response"
            className="inline-flex shrink-0 items-center gap-2 self-end rounded-xl border border-citius-blue px-3 py-3 font-medium text-citius-blue text-sm transition-[background-color,transform] duration-150 hover:bg-citius-blue/5 active:scale-[0.97]"
            onClick={onCancel}
            type="button"
          >
            <Square aria-hidden="true" className="size-4 fill-current" />
            <span className="hidden sm:inline">Cancel</span>
          </button>
        ) : (
          <button
            aria-label="Send message"
            className="shrink-0 self-end rounded-xl bg-citius-blue p-3 text-white shadow-sm transition-[background-color,box-shadow,opacity,transform] duration-150 hover:bg-citius-blue/90 hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
            disabled={!input.trim()}
            type="submit"
          >
            <Send aria-hidden="true" size={18} />
          </button>
        )}
      </form>
    </div>
  );
}
