"use client";

import { m as motion } from "motion/react";
import { createContext, use, useRef, useState } from "react";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const PortalConfirmContext = createContext(null);

export function PortalConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = ({ title, message, confirmLabel = "Confirm", danger = false }) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ title, message, confirmLabel, danger });
    });
  };

  const finish = (result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  };

  const api = { confirm };

  return (
    <PortalConfirmContext.Provider value={api}>
      {children}
      {state && (
        <div
          className={`fixed inset-0 ${PORTAL_Z.confirm} grid place-items-center bg-brand-dark/40 p-4`}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="portal-confirm-title"
            aria-describedby="portal-confirm-message"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 shadow-xl"
          >
            <h2
              id="portal-confirm-title"
              className="font-heading text-lg font-semibold text-citius-blue"
            >
              {state.title}
            </h2>
            <p id="portal-confirm-message" className="mt-2 text-sm text-brand-muted">
              {state.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className="portal-small-btn" onClick={() => finish(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={state.danger ? "portal-danger-btn" : "portal-primary-btn"}
                onClick={() => finish(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </PortalConfirmContext.Provider>
  );
}

export function usePortalConfirm() {
  const ctx = use(PortalConfirmContext);
  if (!ctx) {
    throw new Error("usePortalConfirm must be used within PortalConfirmProvider");
  }
  return ctx;
}
