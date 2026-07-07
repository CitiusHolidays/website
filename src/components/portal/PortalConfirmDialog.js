"use client";

import { m } from "motion/react";
import { createContext, use, useRef, useState } from "react";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const PortalConfirmContext = createContext(null);

export function PortalConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = ({ title, message, confirmLabel = "Confirm", danger = false }) =>
    new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ confirmLabel, danger, message, title });
    });

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
          <m.div
            animate={{ opacity: 1, scale: 1 }}
            aria-describedby="portal-confirm-message"
            aria-labelledby="portal-confirm-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.96 }}
            role="alertdialog"
            transition={{ duration: 0.2 }}
          >
            <h2
              className="font-heading font-semibold text-citius-blue text-lg"
              id="portal-confirm-title"
            >
              {state.title}
            </h2>
            <p className="mt-2 text-brand-muted text-sm" id="portal-confirm-message">
              {state.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button className="portal-small-btn" onClick={() => finish(false)} type="button">
                Cancel
              </button>
              <button
                className={state.danger ? "portal-danger-btn" : "portal-primary-btn"}
                onClick={() => finish(true)}
                type="button"
              >
                {state.confirmLabel}
              </button>
            </div>
          </m.div>
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
