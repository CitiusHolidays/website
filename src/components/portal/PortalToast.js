"use client";

import { AnimatePresence, m } from "motion/react";
import { createContext, use, useState } from "react";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const PortalToastContext = createContext(null);

function ToastItem({ toast, onDismiss }) {
  const toneClass =
    toast.tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : toast.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-brand-border bg-white text-brand-dark";

  return (
    <m.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      aria-live="polite"
      className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClass}`}
      exit={{ opacity: 0, scale: 0.98, y: -4 }}
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      layout
      role="status"
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between gap-3">
        <span>{toast.message}</span>
        <button
          aria-label="Dismiss notification"
          className="shrink-0 font-semibold text-xs opacity-70 transition hover:opacity-100"
          onClick={() => onDismiss(toast.id)}
          type="button"
        >
          Dismiss
        </button>
      </div>
    </m.div>
  );
}

export function PortalToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = (id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const push = (message, tone = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current.slice(-4), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000);
    return id;
  };

  const api = {
    error: (message) => push(message, "error"),
    info: (message) => push(message, "info"),
    success: (message) => push(message, "success"),
  };

  return (
    <PortalToastContext.Provider value={api}>
      {children}
      <section
        aria-label="Toast messages"
        className={`pointer-events-none fixed right-4 bottom-4 ${PORTAL_Z.toast} flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0`}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} onDismiss={dismiss} toast={toast} />
          ))}
        </AnimatePresence>
      </section>
    </PortalToastContext.Provider>
  );
}

export function usePortalToast() {
  const ctx = use(PortalToastContext);
  if (!ctx) {
    throw new Error("usePortalToast must be used within PortalToastProvider");
  }
  return ctx;
}
