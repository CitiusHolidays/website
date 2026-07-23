"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { createContext, use, useReducer } from "react";
import { portalMotionTransition } from "@/lib/portal/portalMotion";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const PortalToastContext = createContext(null);

function toastReducer(state, action) {
  if (action.type === "dismiss") {
    return state.filter((toast) => toast.id !== action.id);
  }
  if (action.type === "enqueue") {
    return [...state.slice(-4), action.toast];
  }
  return state;
}

function ToastItem({ toast, onDismiss }) {
  const shouldReduceMotion = useReducedMotion();
  const settledTransform = "translateY(0) scale(1)";
  const offscreenTransform = shouldReduceMotion ? settledTransform : "translateY(100%) scale(0.98)";
  const enterTransition = portalMotionTransition(shouldReduceMotion, undefined, "ui");
  const exitTransition = portalMotionTransition(shouldReduceMotion, undefined, "snap");

  const toneClass =
    toast.tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : toast.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-brand-border bg-white text-brand-dark";

  return (
    <m.div
      animate={{ opacity: 1, transform: settledTransform }}
      aria-live="polite"
      className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClass}`}
      exit={{
        opacity: 0,
        transform: offscreenTransform,
        transition: exitTransition,
      }}
      initial={{ opacity: 0, transform: offscreenTransform }}
      role="status"
      transition={enterTransition}
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
  const [toasts, dispatchToasts] = useReducer(toastReducer, []);

  const dismiss = (id) => {
    dispatchToasts({ id, type: "dismiss" });
  };

  const enqueueToast = (message, tone = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    dispatchToasts({ toast: { id, message, tone }, type: "enqueue" });
    window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000);
    return id;
  };

  const api = {
    error: (message) => enqueueToast(message, "error"),
    info: (message) => enqueueToast(message, "info"),
    success: (message) => enqueueToast(message, "success"),
  };

  return (
    <PortalToastContext.Provider value={api}>
      {children}
      <section
        aria-label="Toast messages"
        className={`portal-toast-safe-area pointer-events-none fixed ${PORTAL_Z.toast} flex w-auto max-w-sm flex-col gap-2 sm:w-full`}
      >
        <AnimatePresence>
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
