"use client";

import { MoreHorizontal, X } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { PORTAL_Z } from "@/lib/portal/zIndex";

interface ActionElementProps {
  "aria-label"?: string;
  children?: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  role?: string;
}

type ActionElement = ReactElement<ActionElementProps>;
type OptionalAction = ActionElement | false | null | undefined;

interface QueryRowActionsProps {
  label: string;
  overflowActions?: OptionalAction[];
  primaryAction?: OptionalAction;
}

function isActionElement(action: OptionalAction): action is ActionElement {
  return isValidElement<ActionElementProps>(action);
}

function actionKey(action: ActionElement): string {
  return String(
    action.key || action.props["aria-label"] || action.props.children || "query-action"
  );
}

function withActionClass(action: OptionalAction, className: string): ReactElement | null {
  if (!isActionElement(action)) {
    return null;
  }
  return cloneElement(action, {
    className: `${action.props.className || ""} ${className}`.trim(),
  });
}

function dialogFocusableElements(dialog: HTMLElement | null): HTMLElement[] {
  if (!dialog) {
    return [];
  }
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

export function QueryRowActions({
  label,
  overflowActions = [],
  primaryAction,
}: QueryRowActionsProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const actions = overflowActions.filter(isActionElement);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => moreButtonRef.current?.focus());
  }, []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocus();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = dialogFocusableElements(dialogRef.current);
      const [first] = focusable;
      const last = focusable.at(-1);
      if (!(first && last)) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeAndRestoreFocus, open]);

  const sheet =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              aria-label={`Close actions for ${label}`}
              className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-brand-dark/15`}
              onClick={closeAndRestoreFocus}
              type="button"
            />
            <div
              className={`fixed inset-0 ${PORTAL_Z.dropdown} pointer-events-none grid place-items-center pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]`}
            >
              <div
                aria-labelledby={titleId}
                aria-modal="true"
                className="pointer-events-auto w-full max-w-80 rounded-2xl border border-brand-border bg-white p-4 shadow-2xl"
                ref={dialogRef}
                role="dialog"
              >
                <div className="flex items-start justify-between gap-3 border-brand-border/70 border-b pb-3">
                  <div>
                    <p className="font-bold text-[length:var(--portal-label-size)] text-citius-orange uppercase tracking-[0.14em]">
                      Query actions
                    </p>
                    <h2
                      className="mt-1 font-heading font-semibold text-base text-brand-dark"
                      id={titleId}
                    >
                      {label}
                    </h2>
                  </div>
                  <button
                    aria-label={`Close actions for ${label}`}
                    className="grid size-11 place-items-center rounded-full text-brand-muted hover:bg-brand-light hover:text-brand-dark"
                    onClick={closeAndRestoreFocus}
                    ref={closeButtonRef}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2" role="menu">
                  {actions.map((action) =>
                    cloneElement(action, {
                      className:
                        `${action.props.className || ""} min-h-11 w-full justify-start`.trim(),
                      key: actionKey(action),
                      onClick: (event: MouseEvent<HTMLElement>) => {
                        action.props.onClick?.(event);
                        setOpen(false);
                        requestAnimationFrame(() => {
                          const { activeElement } = document;
                          if (
                            !activeElement ||
                            activeElement === document.body ||
                            !document.contains(activeElement)
                          ) {
                            moreButtonRef.current?.focus();
                          }
                        });
                      },
                      role: "menuitem",
                    })
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="flex items-center gap-2">
      {withActionClass(primaryAction, "min-h-11 whitespace-nowrap md:min-h-8")}
      {actions.length > 0 ? (
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`More actions for ${label}`}
          className="portal-small-btn min-h-11 px-3 md:min-h-8"
          onClick={toggle}
          ref={moreButtonRef}
          type="button"
        >
          <MoreHorizontal size={15} />
          <span className="sr-only sm:not-sr-only">More</span>
        </button>
      ) : null}
      {sheet}
    </div>
  );
}
