// biome-ignore-all lint/performance/noJsxPropsBind: React Compiler memoizes local handlers and render props.
"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { PORTAL_Z } from "@/lib/portal/zIndex";

interface PortalActionMenuProps {
  align?: "left" | "right";
  "aria-label": string;
  children: ReactNode;
  contentClassName?: string;
  fitContent?: boolean;
  header?: ReactNode;
  menuClassName?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  trigger: (props: {
    "aria-controls": string;
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
    onClick: () => void;
    ref: RefObject<HTMLButtonElement | null>;
  }) => ReactElement;
}

export function PortalActionMenu({
  align = "right",
  "aria-label": ariaLabel,
  children,
  contentClassName = "flex flex-col gap-1 p-2",
  fitContent = false,
  header,
  menuClassName = "",
  onOpenChange,
  open,
  trigger,
}: PortalActionMenuProps) {
  const shouldReduceMotion = useReducedMotion();
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ opacity: 0 });
  const onOpenChangeEvent = useEffectEvent(onOpenChange);

  const closeAndRestoreFocus = () => {
    onOpenChange(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const triggerRect = buttonRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }
      const viewportPadding = 8;
      const maxWidth = window.innerWidth - viewportPadding * 2;

      if (fitContent) {
        setMenuStyle({
          left: align === "left" ? Math.max(viewportPadding, triggerRect.left) : undefined,
          maxHeight: `calc(100vh - ${triggerRect.bottom + viewportPadding * 2}px)`,
          maxWidth,
          opacity: 1,
          right: align === "right" ? window.innerWidth - triggerRect.right : undefined,
          top: triggerRect.bottom + viewportPadding,
          width: "max-content",
        });
        return;
      }

      const menuWidth = Math.min(260, maxWidth);
      const preferredLeft = align === "right" ? triggerRect.right - menuWidth : triggerRect.left;
      const left = Math.min(
        Math.max(viewportPadding, preferredLeft),
        window.innerWidth - menuWidth - viewportPadding
      );
      setMenuStyle({
        left,
        maxHeight: `calc(100vh - ${triggerRect.bottom + viewportPadding * 2}px)`,
        opacity: 1,
        top: triggerRect.bottom + viewportPadding,
        width: menuWidth,
      });
    };

    updatePosition();
    requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus()
    );
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChangeEvent(false);
        requestAnimationFrame(() => buttonRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, fitContent, open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") || []
    );
    if (items.length === 0) {
      return;
    }
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === "ArrowDown"
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const toggle = () => onOpenChange(!open);
  const menuOriginClass = align === "right" ? "origin-top-right" : "origin-top-left";

  return (
    <div className="relative">
      {trigger({
        "aria-controls": menuId,
        "aria-expanded": open,
        "aria-haspopup": "menu",
        onClick: toggle,
        ref: buttonRef,
      })}

      {typeof document === "undefined"
        ? null
        : createPortal(
            <AnimatePresence>
              {open ? (
                <>
                  <button
                    aria-label={`Close ${ariaLabel}`}
                    className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
                    onClick={closeAndRestoreFocus}
                    tabIndex={-1}
                    type="button"
                  />
                  <m.div
                    animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
                    aria-label={ariaLabel}
                    className={`fixed ${PORTAL_Z.dropdown} ${menuOriginClass} overflow-hidden rounded-2xl border border-brand-border bg-white text-brand-dark shadow-xl ${menuClassName}`}
                    exit={{
                      opacity: 0,
                      transform: shouldReduceMotion ? "none" : "translateY(6px) scale(0.98)",
                      transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] },
                    }}
                    id={menuId}
                    initial={{
                      opacity: 0,
                      transform: shouldReduceMotion ? "none" : "translateY(6px) scale(0.98)",
                    }}
                    onKeyDown={handleMenuKeyDown}
                    ref={menuRef}
                    role="menu"
                    style={menuStyle}
                    transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                  >
                    {header ? (
                      <div className="border-brand-border border-b px-4 py-3">{header}</div>
                    ) : null}
                    <div className={`${contentClassName} overflow-y-auto`}>{children}</div>
                  </m.div>
                </>
              ) : null}
            </AnimatePresence>,
            document.body
          )}
    </div>
  );
}
