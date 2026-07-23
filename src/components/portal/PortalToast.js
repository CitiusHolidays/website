"use client";

import { createContext, use, useReducer } from "react";
import { Toast, ToastStack, useToast } from "@/components/motion-ui/toast-stack";
import { useMotionUITransition } from "@/components/motion-ui/ui-theme";
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

function ToastDismissButton({ onDismiss, toastId }) {
  const { isVisible } = useToast();
  return (
    <button
      aria-label="Dismiss notification"
      className="shrink-0 font-semibold text-xs opacity-70 transition hover:opacity-100"
      onClick={() => onDismiss(toastId)}
      tabIndex={isVisible ? undefined : -1}
      type="button"
    >
      Dismiss
    </button>
  );
}

function ToastItem({ toast, onDismiss }) {
  const successTransition = useMotionUITransition("lively");

  const toneClass =
    toast.tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : toast.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-brand-border bg-white text-brand-dark";

  return (
    <Toast>
      <div
        aria-live="polite"
        className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClass}`}
        role="status"
        style={toast.tone === "success" ? { transition: successTransition } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <span>{toast.message}</span>
          <ToastDismissButton onDismiss={onDismiss} toastId={toast.id} />
        </div>
      </div>
    </Toast>
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
      <ToastStack
        className={`portal-toast-safe-area ${PORTAL_Z.toast}`}
        maxVisible={5}
        stackOffsetY={8}
        stackOpacity={0.15}
        stackScale={0.04}
      >
        {[...toasts].reverse().map((toast) => (
          <ToastItem key={toast.id} onDismiss={dismiss} toast={toast} />
        ))}
      </ToastStack>
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
