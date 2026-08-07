"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { createContext, use, useCallback, useEffect, useId, useRef, useState } from "react";
import { HoldToDeleteButton } from "@/components/motion-ui/hold-to-delete";
import {
  ControlledAlertDialog,
  ControlledAlertDialogClose,
  ControlledAlertDialogDescription,
  ControlledAlertDialogTitle,
} from "@/components/ui/application-dialog";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const PortalConfirmContext = createContext(null);
const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function visibleError(error) {
  return error?.data || error?.message || "The action could not be completed. Please try again.";
}

function canReceiveRestoredFocus(element) {
  if (!element?.isConnected || element.getAttribute("aria-disabled") === "true") {
    return false;
  }
  return !("disabled" in element && element.disabled === true);
}

export function PortalConfirmProvider({ children }) {
  const shouldReduceMotion = useReducedMotion();
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);
  const originRef = useRef(null);
  const fallbackRootRef = useRef(null);
  const cancelRef = useRef(null);
  const actionInFlightRef = useRef(false);
  const stateRef = useRef(null);
  const HOLD_SECONDS = shouldReduceMotion ? 0.6 : 2;
  const errorId = `${useId().replaceAll(":", "")}-confirm-error`;
  const isOpen = Boolean(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const finish = useCallback((result) => {
    if (actionInFlightRef.current) {
      return;
    }
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    resolve?.(result);
  }, []);

  const confirm = useCallback(
    ({ title, message, confirmLabel = "Confirm", danger = false, onConfirm }) =>
      new Promise((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        originRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        fallbackRootRef.current =
          originRef.current?.closest?.('[role="dialog"], [role="alertdialog"]') ?? null;
        actionInFlightRef.current = false;
        setState({ confirmLabel, danger, error: "", message, onConfirm, pending: false, title });
      }),
    []
  );

  const runConfirmAction = useCallback(async () => {
    const { current } = stateRef;
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
  }, [finish]);

  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen) {
        finish(false);
      }
    },
    [finish]
  );
  const handleConfirm = useCallback(() => {
    runConfirmAction();
  }, [runConfirmAction]);
  const retainFocusOnBackdropPointerDown = useCallback((event) => {
    event.preventDefault();
  }, []);
  const resolveFinalFocus = useCallback(() => {
    if (canReceiveRestoredFocus(originRef.current)) {
      return originRef.current;
    }
    const fallback = Array.from(
      fallbackRootRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) ?? []
    ).find(canReceiveRestoredFocus);
    return fallback ?? (fallbackRootRef.current?.isConnected ? fallbackRootRef.current : false);
  }, []);
  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
      actionInFlightRef.current = false;
    },
    []
  );

  return (
    <PortalConfirmContext.Provider value={{ active: isOpen, confirm }}>
      <div className="contents">{children}</div>
      <ControlledAlertDialog
        backdropClassName="portal-confirm-backdrop absolute inset-0 bg-brand-dark/55"
        backdropRender={<div onPointerDown={retainFocusOnBackdropPointerDown} />}
        closeDisabled={Boolean(state?.pending)}
        initialFocus={cancelRef}
        onOpenChange={handleOpenChange}
        open={isOpen}
        popupClassName="relative w-full max-w-md rounded-2xl border border-brand-border bg-white p-6 shadow-xl"
        popupFinalFocus={resolveFinalFocus}
        popupRender={<div data-testid="portal-confirm-dialog" />}
        triggerless
        viewportClassName={`fixed inset-0 ${PORTAL_Z.confirm} grid place-items-center p-4`}
      >
        {state ? (
          <>
            <ControlledAlertDialogTitle className="font-heading font-semibold text-citius-blue text-lg">
              {state.title}
            </ControlledAlertDialogTitle>
            <ControlledAlertDialogDescription className="mt-2 text-brand-muted text-sm">
              {state.message}
            </ControlledAlertDialogDescription>
            <AnimatePresence>
              {state.error ? (
                <m.p
                  animate={{ opacity: 1 }}
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
                  exit={{ opacity: 0 }}
                  id={errorId}
                  initial={{ opacity: 0 }}
                  key="portal-confirm-error"
                  role="alert"
                >
                  {state.error}
                </m.p>
              ) : null}
            </AnimatePresence>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <ControlledAlertDialogClose
                className="portal-small-btn min-h-11"
                data-testid="portal-confirm-cancel"
                disabled={state.pending}
                ref={cancelRef}
                type="button"
              >
                Cancel
              </ControlledAlertDialogClose>
              {state.danger ? (
                <HoldToDeleteButton
                  data-testid="portal-confirm-hold"
                  disabled={state.pending}
                  holdSeconds={HOLD_SECONDS}
                  key={state.error ? `retry-${state.error}` : "hold"}
                  onConfirm={handleConfirm}
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
                  onClick={handleConfirm}
                  type="button"
                >
                  {state.pending ? `${state.confirmLabel}…` : state.confirmLabel}
                </button>
              )}
            </div>
          </>
        ) : null}
      </ControlledAlertDialog>
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

export function usePortalConfirmActive() {
  return use(PortalConfirmContext)?.active ?? false;
}
