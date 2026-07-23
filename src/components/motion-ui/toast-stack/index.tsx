"use client";

import { AnimatePresence, m } from "motion/react";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  type ReactNode,
} from "react";
import { useMotionUITheme, useMotionUITransition } from "@/components/motion-ui/ui-theme";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

interface ToastStackContextValue {
  calm: boolean;
  maxVisible: number;
  stackOffsetY: number;
  stackOpacity: number;
  stackScale: number;
  still: boolean;
}

const ToastStackContext = createContext<ToastStackContextValue | null>(null);
const ToastIndexContext = createContext(0);

interface ToastVisibility {
  isVisible: boolean;
}

const ToastVisibilityContext = createContext<ToastVisibility>({ isVisible: true });

export function useToast(): ToastVisibility {
  return useContext(ToastVisibilityContext);
}

export interface ToastProps {
  children?: ReactNode;
  className?: string;
}

export function Toast({ children, className }: ToastProps) {
  const ctx = useContext(ToastStackContext);
  if (!ctx) {
    throw new Error("Toast must be rendered inside <ToastStack>.");
  }
  const index = useContext(ToastIndexContext);
  const { maxVisible, stackOffsetY, stackScale, stackOpacity, calm, still } = ctx;
  const theme = useMotionUITheme();

  const settle = useMotionUITransition("ui");
  const exit = useMotionUITransition("snap");

  const isVisible = index < maxVisible;
  const y = -index * stackOffsetY;
  const scale = 1 - index * stackScale;
  const opacity = isVisible ? 1 - index * stackOpacity : 0;

  const enterRise = calm ? 0 : theme.travel.section;
  const exitDrop = calm ? 0 : theme.travel.enter;

  return (
    <ToastVisibilityContext.Provider value={{ isVisible }}>
      <m.div
        animate={{ opacity, transform: `translateY(${y}px) scale(${scale})` }}
        aria-hidden={isVisible ? undefined : true}
        className={cx("absolute bottom-0 left-0 w-full origin-bottom", className)}
        exit={
          still
            ? { opacity: 0, transition: { duration: 0 } }
            : {
                opacity: 0,
                transform: `translateY(${exitDrop}px) scale(${calm ? 1 : 0.8})`,
                transition: { ...exit, type: "tween" },
              }
        }
        initial={
          still
            ? false
            : {
                opacity: 0,
                transform: `translateY(${enterRise}px) scale(${calm ? 1 : 0.85})`,
              }
        }
        style={{
          pointerEvents: isVisible ? "auto" : "none",
          zIndex: maxVisible - index,
        }}
        transition={{ ...settle, delay: calm ? 0 : index * theme.stagger.tight }}
      >
        {children}
      </m.div>
    </ToastVisibilityContext.Provider>
  );
}

export interface ToastStackProps {
  children?: ReactNode;
  className?: string;
  maxVisible?: number;
  stackOffsetY?: number;
  stackOpacity?: number;
  stackScale?: number;
}

export function ToastStack({
  children,
  className,
  maxVisible = 4,
  stackOffsetY = 10,
  stackScale = 0.06,
  stackOpacity = 0.2,
}: ToastStackProps) {
  const theme = useMotionUITheme();
  const still = theme.motionMode === "off";
  const calm = theme.motionMode === "calm";

  const contextValue: ToastStackContextValue = {
    calm,
    maxVisible,
    stackOffsetY,
    stackOpacity,
    stackScale,
    still,
  };

  const items = Children.toArray(children)
    .filter(isValidElement)
    .slice(0, maxVisible + 2);

  return (
    <div
      className={cx(
        "pointer-events-none fixed inset-x-0 bottom-6 mx-auto w-[min(22rem,calc(100vw-2rem))]",
        className
      )}
      style={{ zIndex: maxVisible }}
    >
      <ToastStackContext.Provider value={contextValue}>
        <AnimatePresence initial={false}>
          {items.map((child, index) => (
            <ToastIndexContext.Provider key={child.key ?? index} value={index}>
              {child}
            </ToastIndexContext.Provider>
          ))}
        </AnimatePresence>
      </ToastStackContext.Provider>
    </div>
  );
}
