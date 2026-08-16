"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef } from "react";
import { toast as sonnerToast, Toaster } from "@/components/ui/foundation/toast";
import { PORTAL_Z, PORTAL_Z_INDEX } from "@/lib/portal/zIndex";

/**
 * @typedef {object} PortalToastApi
 * @property {(message: string) => string} error
 * @property {(message: string) => string} info
 * @property {(message: string) => string} success
 */

/** @type {import("react").Context<PortalToastApi | null>} */
const PortalToastContext = createContext(null);

const TOASTER_ID = "portal";
const MAX_VISIBLE_TOASTS = 5;
const PORTAL_TOAST_DURATION = {
  error: Number.POSITIVE_INFINITY,
  info: 5000,
  success: 5000,
};
const SONNER_TOAST_BY_TONE = {
  error: sonnerToast.error,
  info: sonnerToast.info,
  success: sonnerToast.success,
};
const PORTAL_TOAST_ICONS = {
  error: null,
  info: null,
  success: null,
};
const PORTAL_TOAST_OFFSET = {
  bottom: "max(1rem, var(--safe-area-inset-bottom))",
  right: "max(1rem, var(--safe-area-inset-right))",
};
const PORTAL_TOAST_MOBILE_OFFSET = {
  bottom: "max(1rem, var(--safe-area-inset-bottom))",
  left: "max(1rem, var(--safe-area-inset-left))",
  right: "max(1rem, var(--safe-area-inset-right))",
};
const PORTAL_TOASTER_STYLE = {
  "--width": "min(22rem, calc(100vw - 2rem))",
  zIndex: PORTAL_Z_INDEX.toast,
};
const PORTAL_TOAST_OPTIONS = {
  classNames: {
    content: "portal-sonner-content",
    title: "portal-sonner-title",
    toast: "portal-sonner-toast",
  },
  unstyled: true,
};

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ToastDismissButton({ dismissToast, toastId }) {
  const handleDismiss = useCallback(() => dismissToast(toastId), [dismissToast, toastId]);

  return (
    <button
      aria-label="Dismiss notification"
      className="portal-sonner-dismiss"
      onClick={handleDismiss}
      type="button"
    >
      Dismiss
    </button>
  );
}

export function PortalToastProvider({ children }) {
  const activeToastIdsRef = useRef([]);
  const pendingToastsRef = useRef([]);
  const showToastRef = useRef(null);

  const retireToast = useCallback((id) => {
    if (!activeToastIdsRef.current.includes(id)) {
      return;
    }
    activeToastIdsRef.current = activeToastIdsRef.current.filter((activeId) => activeId !== id);
    queueMicrotask(() => {
      const nextToast = pendingToastsRef.current.shift();
      if (nextToast) {
        showToastRef.current?.(nextToast);
      }
    });
  }, []);

  const dismissToast = useCallback(
    (id) => {
      retireToast(id);
      sonnerToast.dismiss(id);
    },
    [retireToast]
  );

  const showToast = useCallback(
    ({ id, message, tone }) => {
      activeToastIdsRef.current.push(id);
      const handleRemoval = () => retireToast(id);

      SONNER_TOAST_BY_TONE[tone](<span>{message}</span>, {
        action: <ToastDismissButton dismissToast={dismissToast} toastId={id} />,
        duration: PORTAL_TOAST_DURATION[tone],
        id,
        onAutoClose: handleRemoval,
        onDismiss: handleRemoval,
        toasterId: TOASTER_ID,
      });
      return id;
    },
    [dismissToast, retireToast]
  );
  showToastRef.current = showToast;

  const enqueueToast = useCallback(
    (message, tone) => {
      const toastEntry = { id: createToastId(), message, tone };
      if (activeToastIdsRef.current.length >= MAX_VISIBLE_TOASTS) {
        pendingToastsRef.current.push(toastEntry);
        return toastEntry.id;
      }
      return showToast(toastEntry);
    },
    [showToast]
  );

  const api = useMemo(
    () => ({
      error: (message) => enqueueToast(message, "error"),
      info: (message) => enqueueToast(message, "info"),
      success: (message) => enqueueToast(message, "success"),
    }),
    [enqueueToast]
  );

  useEffect(
    () => () => {
      for (const id of activeToastIdsRef.current) {
        sonnerToast.dismiss(id);
      }
      activeToastIdsRef.current = [];
      pendingToastsRef.current = [];
    },
    []
  );

  return (
    <PortalToastContext.Provider value={api}>
      {children}
      <Toaster
        className={`portal-toast-safe-area ${PORTAL_Z.toast}`}
        containerAriaLabel="Portal notifications"
        expand={false}
        gap={8}
        icons={PORTAL_TOAST_ICONS}
        id={TOASTER_ID}
        mobileOffset={PORTAL_TOAST_MOBILE_OFFSET}
        offset={PORTAL_TOAST_OFFSET}
        position="bottom-right"
        style={PORTAL_TOASTER_STYLE}
        toastOptions={PORTAL_TOAST_OPTIONS}
        visibleToasts={MAX_VISIBLE_TOASTS}
      />
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
