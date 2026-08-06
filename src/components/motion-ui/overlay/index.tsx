"use client";

import { type MotionProps, type MotionStyle, type MotionValue, m } from "motion/react";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { getFocusableElements, restoreFocusAfterOverlayTeardown } from "./focus";

export interface FocusTrapOptions {
  active: boolean;
  container: RefObject<HTMLElement | null>;
  inertSiblingsOf?: RefObject<HTMLElement | null>;
  initialFocus?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
  restoreFocus?: boolean;
  restoreFocusTarget?: RefObject<HTMLElement | null>;
}

interface InertSiblingSnapshot {
  ariaHidden: string | null;
  element: HTMLElement;
  inert: boolean;
}

function makeSiblingsInert(element: HTMLElement | null): () => void {
  const parent = element?.parentElement;
  if (!(element && parent)) {
    return () => undefined;
  }
  const snapshots: InertSiblingSnapshot[] = Array.from(parent.children)
    .filter(
      (sibling): sibling is HTMLElement => sibling instanceof HTMLElement && sibling !== element
    )
    .map((sibling) => ({
      ariaHidden: sibling.getAttribute("aria-hidden"),
      element: sibling,
      inert: sibling.hasAttribute("inert"),
    }));

  for (const snapshot of snapshots) {
    snapshot.element.setAttribute("aria-hidden", "true");
    snapshot.element.setAttribute("inert", "");
  }

  return () => {
    for (const snapshot of snapshots) {
      if (snapshot.ariaHidden === null) {
        snapshot.element.removeAttribute("aria-hidden");
      } else {
        snapshot.element.setAttribute("aria-hidden", snapshot.ariaHidden);
      }
      if (!snapshot.inert) {
        snapshot.element.removeAttribute("inert");
      }
    }
  };
}

function trapTabFocus(event: KeyboardEvent, node: HTMLElement | null): void {
  if (event.key !== "Tab" || !node) {
    return;
  }
  const focusables = getFocusableElements(node);
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }
  const [first] = focusables;
  const last = focusables.at(-1);
  const { activeElement } = document;
  const focusIsInside = node.contains(activeElement);
  if (event.shiftKey && (activeElement === first || !focusIsInside)) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && (activeElement === last || !focusIsInside)) {
    event.preventDefault();
    first.focus();
  }
}

export function useFocusTrap({
  active,
  container,
  inertSiblingsOf,
  initialFocus,
  onEscape,
  restoreFocus = true,
  restoreFocusTarget,
}: FocusTrapOptions): void {
  const onEscapeRef = useRef(onEscape);
  const pendingRestoreCancelRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) {
      return;
    }
    pendingRestoreCancelRef.current?.();
    pendingRestoreCancelRef.current = null;
    const node = container.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusRestoreTarget = restoreFocusTarget?.current ?? previouslyFocused;
    const fallbackRoot =
      focusRestoreTarget?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? null;
    const restoreInertSiblings = makeSiblingsInert(inertSiblingsOf?.current ?? null);

    const raf = requestAnimationFrame(() => {
      const target = initialFocus?.current ?? getFocusableElements(node)[0] ?? node;
      target?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current?.();
        return;
      }
      trapTabFocus(event, node);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      restoreInertSiblings();
      if (restoreFocus) {
        pendingRestoreCancelRef.current = restoreFocusAfterOverlayTeardown(
          focusRestoreTarget,
          fallbackRoot
        );
      }
    };
  }, [active, container, inertSiblingsOf, initialFocus, restoreFocus, restoreFocusTarget]);
}

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [active]);
}

export interface BackdropProps
  extends Pick<MotionProps, "animate" | "exit" | "initial" | "transition"> {
  children?: ReactNode;
  className?: string;
  label?: string;
  onClick?: () => void;
  opacity?: number | MotionValue<number>;
  style?: MotionStyle;
}

export function Backdrop({
  animate,
  children,
  className,
  exit,
  initial,
  label,
  onClick,
  opacity,
  style,
  transition,
}: BackdropProps) {
  const mergedStyle: MotionStyle = opacity === undefined ? { ...style } : { ...style, opacity };
  const surfaceClass = `absolute inset-0 ${className ?? "bg-black"}`;

  if (label) {
    return (
      <m.button
        animate={animate}
        aria-label={label}
        className={surfaceClass}
        exit={exit}
        initial={initial}
        onClick={onClick}
        style={mergedStyle}
        transition={transition}
        type="button"
      >
        {children}
      </m.button>
    );
  }

  return (
    <m.div
      animate={animate}
      aria-hidden="true"
      className={surfaceClass}
      exit={exit}
      initial={initial}
      onClick={onClick}
      style={mergedStyle}
      transition={transition}
    >
      {children}
    </m.div>
  );
}
