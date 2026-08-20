"use client";

import { ArrowUp, Square } from "lucide-react";
import { useCallback } from "react";

export function shouldSubmitChatKey(event) {
  const isComposing = event.isComposing || event.nativeEvent?.isComposing;
  return event.key === "Enter" && !event.shiftKey && !isComposing;
}

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
      if (shouldSubmitChatKey(event)) {
        event.preventDefault();
        onSubmit(event);
      }
    },
    [onSubmit]
  );

  return (
    <div className="flex-shrink-0 border-slate-200 border-t bg-[#f8f7f4] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pt-4">
      <form
        className="rounded-[20px] border border-slate-300 bg-white p-2 shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition-[border-color,box-shadow] focus-within:border-citius-blue focus-within:shadow-[0_8px_30px_rgba(32,91,141,0.12)]"
        onSubmit={onSubmit}
      >
        <label className="sr-only" htmlFor="citius-concierge-message">
          Ask Citius Concierge about your journey
        </label>
        <textarea
          aria-label="Chat message"
          className="block min-h-11 w-full resize-none overflow-y-auto bg-transparent px-2 py-2 text-[16px] text-slate-900 leading-6 placeholder:text-slate-400 focus:outline-none sm:text-[15px]"
          disabled={isLoading}
          id="citius-concierge-message"
          onChange={onInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Tell us what you are imagining…"
          rows={inputRows}
          style={{ maxHeight: inputRows > 1 ? `${inputRows * 24 + 20}px` : "44px" }}
          value={input}
        />
        <div className="flex items-center justify-between gap-3 border-slate-100 border-t px-1 pt-2">
          <p className="hidden text-[11px] text-slate-400 sm:block">
            Enter to send · Shift + Enter for a new line
          </p>
          <p className="text-[11px] text-slate-400 sm:hidden">Keep personal documents private</p>
          {isLoading ? (
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-4 font-medium text-sm text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
              onClick={onCancel}
              type="button"
            >
              <Square aria-hidden="true" className="size-3 fill-current" />
              Stop
            </button>
          ) : (
            <button
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0e2238] text-white shadow-sm transition-[background-color,transform] hover:bg-citius-blue focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:active:scale-100"
              disabled={!input.trim()}
              type="submit"
            >
              <ArrowUp aria-hidden="true" className="size-5" />
              <span className="sr-only">Send message</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
