// biome-ignore-all lint/performance/noJsxPropsBind: React Compiler memoizes the facade render adapters.
"use client";

import { m, useReducedMotion } from "motion/react";
import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";
import { useId } from "react";
import { Popover as BasePopover } from "@/components/ui/foundation/base";
import { portalOverlayMotion } from "@/lib/portal/portalMotion";
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
  const popupOriginClass = align === "right" ? "origin-top-right" : "origin-top-left";
  const overlayMotion = portalOverlayMotion(
    !!shouldReduceMotion,
    align === "right" ? "top-right" : "top-left",
    0.15
  );

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
          render={(baseProps, state) => {
            // SAFETY: Base UI's trigger render props are emitted for the button trigger declared by this component.
            const onClick = baseProps.onClick as () => void;
            // SAFETY: the supplied trigger ref and Base UI both target the same HTMLButtonElement.
            const ref = baseProps.ref as RefObject<HTMLButtonElement | null>;
            return trigger({
              ...baseProps,
              "aria-controls": popupId,
              "aria-expanded": state.open,
              "aria-haspopup": "dialog",
              onClick,
              ref,
            });
          }}
        />
      </div>
      <BasePopover.Portal>
        <BasePopover.Backdrop
          className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent data-ending-style:pointer-events-none`}
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
            aria-hidden={open ? undefined : "true"}
            aria-label={ariaLabel}
            className={cn(
              `max-h-[var(--available-height)] ${popupOriginClass} overflow-hidden border border-brand-border bg-white text-brand-dark shadow-xl`,
              className
            )}
            id={popupId}
            inert={open ? undefined : true}
            initialFocus={false}
            render={(props, state) => {
              // SAFETY: Base UI supplies div-compatible popup props; Motion differs only in ref variance.
              const motionProps = props as ComponentProps<typeof m.div>;
              return (
                <m.div
                  {...motionProps}
                  animate={state.open ? overlayMotion.visible : overlayMotion.hidden}
                  initial={overlayMotion.hidden}
                  transition={overlayMotion.transition}
                />
              );
            }}
          >
            <div className={contentClassName}>{children}</div>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
