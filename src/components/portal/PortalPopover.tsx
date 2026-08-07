// biome-ignore-all lint/performance/noJsxPropsBind: React Compiler memoizes the facade render adapters.
"use client";

import { m, useReducedMotion } from "motion/react";
import type { ReactElement, ReactNode, RefObject } from "react";
import { useId } from "react";
import { Popover as BasePopover } from "@/components/ui/foundation/base";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import { cn } from "@/lib/utils";

interface PortalPopoverProps {
  align?: "left" | "right";
  "aria-label": string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sideOffset?: number;
  trigger: (props: {
    "aria-controls": string;
    "aria-expanded": boolean;
    "aria-haspopup": "dialog";
    onClick: () => void;
    ref: RefObject<HTMLButtonElement | null>;
  }) => ReactElement;
}

export function PortalPopover({
  align = "right",
  "aria-label": ariaLabel,
  children,
  className,
  contentClassName,
  onOpenChange,
  open,
  sideOffset = 8,
  trigger,
}: PortalPopoverProps) {
  const shouldReduceMotion = useReducedMotion();
  const popupId = useId();
  const triggerId = useId();

  return (
    <BasePopover.Root
      modal={false}
      onOpenChange={onOpenChange}
      open={open}
      triggerId={open ? triggerId : null}
    >
      <div className="relative">
        <BasePopover.Trigger
          id={triggerId}
          render={(baseProps, state) =>
            trigger({
              ...baseProps,
              "aria-controls": popupId,
              "aria-expanded": state.open,
              "aria-haspopup": "dialog",
              onClick: baseProps.onClick as () => void,
              ref: baseProps.ref as RefObject<HTMLButtonElement | null>,
            })
          }
        />
      </div>
      <BasePopover.Portal>
        <BasePopover.Backdrop
          className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
          render={<button aria-label={`Close ${ariaLabel}`} tabIndex={-1} type="button" />}
        />
        <BasePopover.Positioner
          align={align === "right" ? "end" : "start"}
          className={PORTAL_Z.dropdown}
          collisionAvoidance={{ align: "shift", fallbackAxisSide: "none", side: "shift" }}
          collisionPadding={8}
          positionMethod="fixed"
          side="bottom"
          sideOffset={sideOffset}
        >
          <BasePopover.Popup
            aria-label={ariaLabel}
            className={cn(
              "max-h-[var(--available-height)] origin-top-right overflow-hidden border border-brand-border bg-white text-brand-dark shadow-xl",
              className
            )}
            id={popupId}
            initialFocus={false}
            render={
              <m.div
                animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
                initial={{
                  opacity: 0,
                  transform: shouldReduceMotion ? "none" : "translateY(6px) scale(0.98)",
                }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              />
            }
          >
            <div className={contentClassName}>{children}</div>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
