"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { createContext, use, useEffect, useId, useRef, useState } from "react";
import { HoldToDeleteButton } from "@/components/motion-ui/hold-to-delete";
import { useScrollLock } from "@/components/motion-ui/overlay";
import {
  PORTAL_MODAL_VISIBLE_TRANSFORM,
  portalModalExitTransform,
  portalModalHiddenTransform,
  portalMotionTransition,
} from "@/lib/portal/portalMotion";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const PortalConfirmContext = createContext(null);
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visibleError(error) {
  return error?.data || error?.message || "The action could not be completed. Please try again.";
}

export function PortalConfirmProvider({ children }) {
  const shouldReduceMotion = useReducedMotion();
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);
  const originRef = useRef(null);
  const backgroundRef = useRef(null);
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const actionInFlightRef = useRef(false);
  const stateRef = useRef(null);
  const HOLD_SECONDS = shouldReduceMotion ? 0.6 : 2;
  const titleId = `${useId().replaceAll(":", "")}-confirm-title`;
  const messageId = `${useId().replaceAll(":", "")}-confirm-message`;
  const errorId = `${useId().replaceAll(":", "")}-confirm-error`;
  const isOpen = Boolean(state);
  useScrollLock(isOpen);
  const dialogTransform = PORTAL_MODAL_VISIBLE_TRANSFORM;
  const dialogHiddenTransform = portalModalHiddenTransform(shouldReduceMotion);
  const dialogExitTransform = portalModalExitTransform(shouldReduceMotion);
  const modalTransition = portalMotionTransition(shouldReduceMotion);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const restoreOriginFocus = () => {
    const origin = originRef.current;
    originRef.current = null;
    queueMicrotask(() => {
      if (origin?.isConnected) {
        origin.focus();
      }
    });
  };

  const finish = (result) => {
    if (actionInFlightRef.current) {
      return;
    }
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    resolve?.(result);
    restoreOriginFocus();
  };

  const confirm = ({ title, message, confirmLabel = "Confirm", danger = false, onConfirm }) =>
    new Promise((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      originRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      actionInFlightRef.current = false;
      setState({ confirmLabel, danger, error: "", message, onConfirm, pending: false, title });
    });

  const runConfirmAction = async () => {
    const current = stateRef.current;
    if (!(current && !actionInFlightRef.current)) {
      return;
    }
    if (!current.onConfirm) {
      finish(true);
      return;
    }
    actionInFlightRef.current = true;
    setState((previous) => (previous ? { ...previous, error: "", pending: true } : previous));
    try {
      await current.onConfirm();
      actionInFlightRef.current = false;
      finish(true);
    } catch (error) {
      actionInFlightRef.current = false;
      setState((previous) =>
        previous ? { ...previous, error: visibleError(error), pending: false } : previous
      );
      queueMicrotask(() => cancelRef.current?.focus());
    }
  };

  useEffect(() => {
    const background = backgroundRef.current;
    if (!isOpen) {
      background?.removeAttribute("inert");
      background?.removeAttribute("aria-hidden");
      return;
    }
    background?.setAttribute("inert", "");
    background?.setAttribute("aria-hidden", "true");
    queueMicrotask(() => cancelRef.current?.focus());
    return () => {
      background?.removeAttribute("inert");
      background?.removeAttribute("aria-hidden");
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
      actionInFlightRef.current = false;
      restoreOriginFocus();
    },
    []
  );

  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape" && !state?.pending) {
      event.preventDefault();
      finish(false);
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])];
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const dialogLayer = (
    <AnimatePresence>
      {state ? (
        <m.div
          animate={{ opacity: 1 }}
          className={`fixed inset-0 ${PORTAL_Z.confirm} grid place-items-center bg-brand-dark/55 p-4`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key="portal-confirm-backdrop"
          transition={modalTransition}
        >
          <m.div
            animate={{ opacity: 1, transform: dialogTransform }}
            aria-describedby={`${messageId}${state.error ? ` ${errorId}` : ""}`}
            aria-labelledby={titleId}
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 shadow-xl"
            data-testid="portal-confirm-dialog"
            exit={{
              opacity: 0,
              transform: shouldReduceMotion ? dialogTransform : dialogExitTransform,
            }}
            initial={{ opacity: 0, transform: dialogHiddenTransform }}
            key="portal-confirm-panel"
            onKeyDown={handleDialogKeyDown}
            ref={dialogRef}
            role="alertdialog"
            tabIndex={-1}
            transition={modalTransition}
          >
            <h2 className="font-heading font-semibold text-citius-blue text-lg" id={titleId}>
              {state.title}
            </h2>
            <p className="mt-2 text-brand-muted text-sm" id={messageId}>
              {state.message}
            </p>
            {state.error ? (
              <p
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
                id={errorId}
                role="alert"
              >
                {state.error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                className="portal-small-btn min-h-11"
                data-testid="portal-confirm-cancel"
                disabled={state.pending}
                onClick={() => finish(false)}
                ref={cancelRef}
                type="button"
              >
                Cancel
              </button>
              {state.danger ? (
                <HoldToDeleteButton
                  aria-describedby={messageId}
                  data-testid="portal-confirm-hold"
                  disabled={state.pending}
                  holdSeconds={HOLD_SECONDS}
                  key={state.error ? `retry-${state.error}` : "hold"}
                  onConfirm={() => {
                    void runConfirmAction();
                  }}
                >
                  {state.pending
                    ? `${state.confirmLabel}…`
                    : `Hold to ${state.confirmLabel.toLowerCase()}`}
                </HoldToDeleteButton>
              ) : (
                <button
                  className="portal-primary-btn min-h-11"
                  data-testid="portal-confirm-submit"
                  disabled={state.pending}
                  onClick={() => {
                    void runConfirmAction();
                  }}
                  type="button"
                >
                  {state.pending ? `${state.confirmLabel}…` : state.confirmLabel}
                </button>
              )}
            </div>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <PortalConfirmContext.Provider value={{ confirm }}>
      <div className="contents" ref={backgroundRef}>
        {children}
      </div>
      {dialogLayer}
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
