"use client";

import { AnimatePresence, m as motion } from "motion/react";
import { createContext, useContext, useState } from "react";

const PortalToastContext = createContext(null);

function ToastItem({ toast, onDismiss }) {
  const toneClass =
    toast.tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : toast.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-brand-border bg-white text-brand-dark";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <span>{toast.message}</span>
        <button
          type="button"
          className="shrink-0 text-xs font-semibold opacity-70 transition hover:opacity-100"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
        >
          Dismiss
        </button>
      </div>
    </motion.div>
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
    success: (message) => push(message, "success"),
    error: (message) => push(message, "error"),
    info: (message) => push(message, "info"),
  };

  return (
    <PortalToastContext.Provider value={api}>
      {children}
      <section
        aria-label="Toast messages"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </section>
    </PortalToastContext.Provider>
  );
}

export function usePortalToast() {
  const ctx = useContext(PortalToastContext);
  if (!ctx) {
    throw new Error("usePortalToast must be used within PortalToastProvider");
  }
  return ctx;
}
