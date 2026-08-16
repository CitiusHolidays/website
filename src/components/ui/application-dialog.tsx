"use client";

import {
  type ComponentProps,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { isRuntimeFunction, isRuntimeObject } from "../../lib/runtimeValues";
import { AlertDialog as BaseAlertDialog, Dialog as BaseDialog } from "./foundation/base";

type EmptyFocusTarget = ReturnType<() => void>;
type InitialFocusTarget =
  | false
  | { current: HTMLElement | null }
  | (() => false | HTMLElement | null | EmptyFocusTarget);

function resolveInitialFocusTarget(
  target: InitialFocusTarget | null | undefined
): HTMLElement | null {
  if (isRuntimeFunction(target)) {
    const resolved = target();
    return resolved instanceof HTMLElement ? resolved : null;
  }
  if (target && isRuntimeObject(target) && "current" in target) {
    return target.current;
  }
  return null;
}

function resolveEligibleApplicationFocusOrigin(
  candidate: EventTarget | null,
  hiddenTrigger: HTMLElement | null
): HTMLElement | null {
  if (
    !(candidate instanceof HTMLElement && candidate.isConnected) ||
    candidate === document.body ||
    candidate === document.documentElement ||
    candidate === hiddenTrigger ||
    candidate.tagName === "NEXTJS-PORTAL" ||
    candidate.closest("nextjs-portal") ||
    candidate.closest('[role="menu"]') ||
    candidate.hidden ||
    candidate.getAttribute("aria-hidden") === "true" ||
    candidate.closest('[aria-hidden="true"]') ||
    ("disabled" in candidate && candidate.disabled)
  ) {
    return null;
  }
  if (
    !candidate.matches(
      'button, [href], input, select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
    )
  ) {
    return null;
  }
  return candidate;
}

function scheduleTriggerlessOpen(
  hiddenTrigger: HTMLButtonElement | null,
  captureOrigin: (candidate: EventTarget | null) => HTMLElement | null,
  open: () => void
) {
  let openTimer: number | null = null;
  let fallbackTimer: number | null = null;
  let listeningForOrigin = false;
  const stopListening = () => {
    if (listeningForOrigin) {
      document.removeEventListener("focusin", handleFocusIn);
      listeningForOrigin = false;
    }
  };
  const requestOpen = () => {
    if (openTimer !== null) {
      return;
    }
    openTimer = window.setTimeout(open, 0);
  };
  const handleFocusIn = (event: FocusEvent) => {
    if (!captureOrigin(event.target)) {
      return;
    }
    stopListening();
    if (fallbackTimer !== null) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    requestOpen();
  };

  if (captureOrigin(document.activeElement)) {
    requestOpen();
  } else {
    listeningForOrigin = true;
    document.addEventListener("focusin", handleFocusIn);
    fallbackTimer = window.setTimeout(() => {
      captureOrigin(document.activeElement);
      stopListening();
      requestOpen();
    }, 250);
  }

  return () => {
    stopListening();
    if (openTimer !== null) {
      window.clearTimeout(openTimer);
    }
    if (fallbackTimer !== null) {
      window.clearTimeout(fallbackTimer);
    }
    if (document.activeElement === hiddenTrigger) {
      hiddenTrigger?.blur();
    }
  };
}

function scheduleFocusCompatibility(
  resolveTarget: () => HTMLElement | null,
  shouldMoveFocus: () => boolean
) {
  const timers = [0, 50, 250].map((delay) =>
    window.setTimeout(() => {
      const target = resolveTarget();
      if (target?.isConnected && shouldMoveFocus()) {
        target.focus({ preventScroll: true });
      }
    }, delay)
  );
  return () => {
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
  };
}

export interface ControlledDialogProps {
  backdropClassName?: string;
  backdropRender?: ComponentProps<typeof BaseDialog.Backdrop>["render"];
  backdropStyle?: ComponentProps<typeof BaseDialog.Backdrop>["style"];
  children: ReactNode;
  closeDisabled?: boolean;
  escapeDisabled?: boolean;
  initialFocus?: InitialFocusTarget;
  modal?: ComponentProps<typeof BaseDialog.Root>["modal"];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  panelClassName?: string;
  panelStyle?: ComponentProps<"div">["style"];
  popupClassName?: string;
  popupFinalFocus?: InitialFocusTarget;
  popupRef?: Ref<HTMLDivElement>;
  popupRender?: ComponentProps<typeof BaseDialog.Popup>["render"];
  popupStyle?: ComponentProps<typeof BaseDialog.Popup>["style"];
  triggerless?: boolean;
  viewportClassName?: string;
  viewportStyle?: ComponentProps<typeof BaseDialog.Viewport>["style"];
}

interface ApplicationDialogHandle {
  close: () => void;
  readonly isOpen: boolean;
}

interface ApplicationDialogActions {
  unmount: () => void;
}

interface ApplicationDialogChangeDetails {
  cancel: () => void;
  reason: string;
}

function useControlledDialogLifecycle<Actions extends ApplicationDialogActions>({
  closeDisabled,
  escapeDisabled,
  handle,
  initialFocus,
  onOpenChange,
  open,
  popupFinalFocus,
  triggerIdSuffix,
  triggerless,
}: {
  closeDisabled: boolean;
  escapeDisabled: boolean;
  handle: ApplicationDialogHandle;
  initialFocus: InitialFocusTarget | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  popupFinalFocus: InitialFocusTarget | undefined;
  triggerIdSuffix: string;
  triggerless: boolean;
}) {
  const actionsRef = useRef<Actions | null>(null);
  const triggerId = `${useId().replaceAll(":", "")}-${triggerIdSuffix}`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const syncingExternalStateRef = useRef(false);
  const resolveLatestInitialFocus = useEffectEvent(() => resolveInitialFocusTarget(initialFocus));

  const handleOpenChange = useCallback(
    (nextOpen: boolean, details: ApplicationDialogChangeDetails) => {
      if (!nextOpen && (closeDisabled || (escapeDisabled && details.reason === "escape-key"))) {
        details.cancel();
      } else if (!syncingExternalStateRef.current) {
        onOpenChange(nextOpen);
      }
    },
    [closeDisabled, escapeDisabled, onOpenChange]
  );
  const resolveCapturedFinalFocus = useCallback(() => {
    const origin = originRef.current;
    if (!(origin?.isConnected && !("disabled" in origin && origin.disabled))) {
      return false;
    }
    return origin;
  }, []);
  const handleOpenChangeComplete = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        const { activeElement, body } = document;
        const target = resolveInitialFocusTarget(initialFocus);
        if (
          target?.isConnected &&
          (activeElement === originRef.current ||
            activeElement === body ||
            activeElement === triggerRef.current)
        ) {
          target.focus({ preventScroll: true });
        }
        return;
      }
      const target = resolveInitialFocusTarget(popupFinalFocus) ?? resolveCapturedFinalFocus();
      if (
        target instanceof HTMLElement &&
        target.isConnected &&
        (document.activeElement === document.body || !document.activeElement?.isConnected)
      ) {
        target.focus({ preventScroll: true });
      }
    },
    [initialFocus, popupFinalFocus, resolveCapturedFinalFocus]
  );

  useEffect(() => {
    if (!triggerless) {
      return;
    }
    if (!open) {
      syncingExternalStateRef.current = true;
      if (handle.isOpen && actionsRef.current) {
        handle.close();
      }
      syncingExternalStateRef.current = false;
      const cancelFocus = scheduleFocusCompatibility(
        () => {
          const captured = resolveCapturedFinalFocus();
          return (
            resolveInitialFocusTarget(popupFinalFocus) ??
            (captured instanceof HTMLElement ? captured : null)
          );
        },
        () => document.activeElement === document.body || !document.activeElement?.isConnected
      );
      return cancelFocus;
    }
    originRef.current = null;
    let cancelFocus: () => void = () => undefined;
    const cancelOpen = scheduleTriggerlessOpen(
      triggerRef.current,
      (candidate) => {
        const origin = resolveEligibleApplicationFocusOrigin(candidate, triggerRef.current);
        if (origin) {
          originRef.current = origin;
        }
        return origin;
      },
      () => {
        syncingExternalStateRef.current = true;
        if (!handle.isOpen) {
          triggerRef.current?.click();
        }
        syncingExternalStateRef.current = false;
        cancelFocus();
        cancelFocus = scheduleFocusCompatibility(
          resolveLatestInitialFocus,
          () =>
            document.activeElement === originRef.current ||
            document.activeElement === document.body ||
            document.activeElement === triggerRef.current
        );
      }
    );
    return () => {
      cancelOpen();
      cancelFocus();
    };
  }, [handle, open, popupFinalFocus, resolveCapturedFinalFocus, triggerless]);

  return {
    actionsRef,
    handleOpenChange,
    handleOpenChangeComplete,
    resolveCapturedFinalFocus,
    triggerId,
    triggerRef,
  };
}

export function ControlledDialog({
  backdropClassName,
  backdropRender,
  backdropStyle,
  children,
  closeDisabled = false,
  escapeDisabled = false,
  initialFocus,
  modal = true,
  onOpenChange,
  open,
  panelClassName,
  panelStyle,
  popupClassName,
  popupFinalFocus,
  popupRef,
  popupRender,
  popupStyle,
  triggerless = false,
  viewportClassName,
  viewportStyle,
}: ControlledDialogProps) {
  const [handle] = useState(() => BaseDialog.createHandle());
  const {
    actionsRef,
    handleOpenChange,
    handleOpenChangeComplete,
    resolveCapturedFinalFocus,
    triggerId,
    triggerRef,
  } = useControlledDialogLifecycle<BaseDialog.Root.Actions>({
    closeDisabled,
    escapeDisabled,
    handle,
    initialFocus,
    onOpenChange,
    open,
    popupFinalFocus,
    triggerIdSuffix: "controlled-dialog-trigger",
    triggerless,
  });

  const finalFocus = popupFinalFocus ?? (triggerless ? resolveCapturedFinalFocus : popupFinalFocus);
  const popup = (
    <BaseDialog.Popup
      aria-hidden={open ? undefined : "true"}
      aria-modal={modal && open ? "true" : undefined}
      className={cn("data-ending-style:pointer-events-none", popupClassName)}
      finalFocus={finalFocus}
      inert={open ? undefined : true}
      initialFocus={initialFocus}
      ref={popupRef}
      render={popupRender}
      style={popupStyle}
    >
      {children}
    </BaseDialog.Popup>
  );

  return (
    <>
      {triggerless ? (
        <BaseDialog.Trigger
          aria-hidden="true"
          handle={handle}
          hidden
          id={triggerId}
          ref={triggerRef}
          tabIndex={-1}
          type="button"
        />
      ) : null}
      <BaseDialog.Root
        actionsRef={actionsRef}
        disablePointerDismissal={closeDisabled}
        handle={triggerless ? handle : undefined}
        modal={modal}
        onOpenChange={handleOpenChange}
        onOpenChangeComplete={handleOpenChangeComplete}
        open={triggerless ? undefined : open}
        triggerId={triggerless ? triggerId : undefined}
      >
        <BaseDialog.Portal>
          <BaseDialog.Viewport className={viewportClassName} style={viewportStyle}>
            <BaseDialog.Backdrop
              className={cn("data-ending-style:pointer-events-none", backdropClassName)}
              render={backdropRender}
              style={backdropStyle}
            />
            {panelClassName || panelStyle ? (
              <div className={panelClassName} style={panelStyle}>
                {popup}
              </div>
            ) : (
              popup
            )}
          </BaseDialog.Viewport>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </>
  );
}

export type ControlledAlertDialogProps = Omit<
  ControlledDialogProps,
  "backdropRender" | "backdropStyle" | "popupFinalFocus" | "popupRender" | "popupStyle"
> & {
  backdropRender?: ComponentProps<typeof BaseAlertDialog.Backdrop>["render"];
  backdropStyle?: ComponentProps<typeof BaseAlertDialog.Backdrop>["style"];
  popupFinalFocus?: InitialFocusTarget;
  popupRender?: ComponentProps<typeof BaseAlertDialog.Popup>["render"];
  popupStyle?: ComponentProps<typeof BaseAlertDialog.Popup>["style"];
};

export function ControlledAlertDialog({
  backdropClassName,
  backdropRender,
  backdropStyle,
  children,
  closeDisabled = false,
  escapeDisabled = false,
  initialFocus,
  onOpenChange,
  open,
  panelClassName,
  panelStyle,
  popupClassName,
  popupFinalFocus,
  popupRef,
  popupRender,
  popupStyle,
  triggerless = false,
  viewportClassName,
  viewportStyle,
}: ControlledAlertDialogProps) {
  const [handle] = useState(() => BaseAlertDialog.createHandle());
  const {
    actionsRef,
    handleOpenChange,
    handleOpenChangeComplete,
    resolveCapturedFinalFocus,
    triggerId,
    triggerRef,
  } = useControlledDialogLifecycle<BaseAlertDialog.Root.Actions>({
    closeDisabled,
    escapeDisabled,
    handle,
    initialFocus,
    onOpenChange,
    open,
    popupFinalFocus,
    triggerIdSuffix: "controlled-alert-trigger",
    triggerless,
  });

  const finalFocus = popupFinalFocus ?? (triggerless ? resolveCapturedFinalFocus : popupFinalFocus);
  const popup = (
    <BaseAlertDialog.Popup
      aria-hidden={open ? undefined : "true"}
      aria-modal={open ? "true" : undefined}
      className={cn("data-ending-style:pointer-events-none", popupClassName)}
      finalFocus={finalFocus}
      inert={open ? undefined : true}
      initialFocus={initialFocus}
      ref={popupRef}
      render={popupRender}
      style={popupStyle}
    >
      {children}
    </BaseAlertDialog.Popup>
  );

  return (
    <>
      {triggerless ? (
        <BaseAlertDialog.Trigger
          aria-hidden="true"
          handle={handle}
          hidden
          id={triggerId}
          ref={triggerRef}
          tabIndex={-1}
          type="button"
        />
      ) : null}
      <BaseAlertDialog.Root
        actionsRef={actionsRef}
        handle={triggerless ? handle : undefined}
        onOpenChange={handleOpenChange}
        onOpenChangeComplete={handleOpenChangeComplete}
        open={triggerless ? undefined : open}
        triggerId={triggerless ? triggerId : undefined}
      >
        <BaseAlertDialog.Portal>
          <BaseAlertDialog.Viewport className={viewportClassName} style={viewportStyle}>
            <BaseAlertDialog.Backdrop
              className={cn("data-ending-style:pointer-events-none", backdropClassName)}
              render={backdropRender}
              style={backdropStyle}
            />
            {panelClassName || panelStyle ? (
              <div className={panelClassName} style={panelStyle}>
                {popup}
              </div>
            ) : (
              popup
            )}
          </BaseAlertDialog.Viewport>
        </BaseAlertDialog.Portal>
      </BaseAlertDialog.Root>
    </>
  );
}

export const ControlledDialogClose = BaseDialog.Close;
export const ControlledDialogTitle = BaseDialog.Title;
export const ControlledAlertDialogClose = BaseAlertDialog.Close;
export const ControlledAlertDialogDescription = BaseAlertDialog.Description;
export const ControlledAlertDialogTitle = BaseAlertDialog.Title;
