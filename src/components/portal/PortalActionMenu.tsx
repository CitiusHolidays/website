// biome-ignore-all lint/performance/noJsxPropsBind: React Compiler memoizes the facade render adapters.
"use client";

import {
  Children,
  type CSSProperties,
  isValidElement,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useId,
  useRef,
} from "react";
import { Menu as BaseMenu } from "@/components/ui/foundation/base";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import { cn } from "@/lib/utils";

interface PortalActionMenuProps {
  align?: "left" | "right";
  "aria-label": string;
  children: ReactNode;
  contentClassName?: string;
  fitContent?: boolean;
  header?: ReactNode;
  headerClassName?: string;
  menuClassName?: string;
  menuStyle?: CSSProperties & Partial<Record<`--${string}`, string | number>>;
  motionEasing?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sideOffset?: number;
  trigger: (props: {
    "aria-controls": string;
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
    onClick: () => void;
    onMouseDown: MouseEventHandler<HTMLButtonElement>;
    ref: RefObject<HTMLButtonElement | null>;
  }) => ReactElement;
}

interface PortalActionMenuItemProps {
  children: ReactElement;
  closeOnClick?: boolean;
  disabled?: boolean;
  label?: string;
}

export function PortalActionMenuItem({ children }: PortalActionMenuItemProps) {
  return children;
}

function BaseMenuItems({ children }: { children: ReactNode }) {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }
    const itemOptions =
      child.type === PortalActionMenuItem ? (child.props as PortalActionMenuItemProps) : undefined;
    const item = itemOptions ? itemOptions.children : child;
    const nativeButton =
      item.type === "button" || (item.props as { type?: unknown }).type === "button";
    return (
      <BaseMenu.Item
        closeOnClick={itemOptions?.closeOnClick}
        disabled={itemOptions?.disabled}
        label={itemOptions?.label}
        nativeButton={nativeButton}
        render={item as ReactElement}
      />
    );
  });
}

export function PortalActionMenu({
  align = "right",
  "aria-label": ariaLabel,
  children,
  contentClassName = "flex flex-col gap-1 p-2",
  fitContent = false,
  header,
  headerClassName = "border-brand-border border-b px-4 py-3",
  menuClassName = "",
  motionEasing = "var(--portal-ease-out)",
  menuStyle,
  onOpenChange,
  open,
  sideOffset = 8,
  trigger,
}: PortalActionMenuProps) {
  const menuId = useId();
  const triggerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const outsideFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuOriginClass = align === "right" ? "origin-top-right" : "origin-top-left";

  return (
    <BaseMenu.Root
      modal={false}
      onOpenChange={(nextOpen, eventDetails) => {
        onOpenChange(nextOpen);
        if (outsideFocusTimerRef.current) {
          clearTimeout(outsideFocusTimerRef.current);
          outsideFocusTimerRef.current = null;
        }
        if (!nextOpen && eventDetails.reason === "outside-press") {
          outsideFocusTimerRef.current = setTimeout(() => {
            outsideFocusTimerRef.current = null;
            const triggerElement = triggerRef.current;
            if (
              // biome-ignore lint/complexity/useOptionalChain: keep the guard explicit before subsequent property reads.
              !(triggerElement && triggerElement.isConnected) ||
              triggerElement.disabled ||
              triggerElement.hidden ||
              triggerElement.tabIndex < 0 ||
              triggerElement.getAttribute("aria-disabled") === "true"
            ) {
              return;
            }
            triggerElement.focus();
          }, 0);
        }
      }}
      open={open}
      triggerId={triggerId}
    >
      <div className="relative">
        <BaseMenu.Trigger
          id={triggerId}
          ref={triggerRef}
          render={(baseProps, state) =>
            trigger({
              ...baseProps,
              "aria-controls": menuId,
              "aria-expanded": state.open,
              "aria-haspopup": "menu",
              onClick: baseProps.onClick as () => void,
              onMouseDown: (event) => {
                baseProps.onMouseDown?.(event);
                if (event.button === 0 && !event.defaultPrevented && !state.open) {
                  onOpenChange(true);
                }
              },
              ref: baseProps.ref as RefObject<HTMLButtonElement | null>,
            })
          }
        />
      </div>
      <BaseMenu.Portal>
        <BaseMenu.Backdrop
          className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent data-[closed]:pointer-events-none data-[closed]:hidden`}
          data-slot="portal-action-menu-backdrop"
          render={<button aria-label={`Close ${ariaLabel}`} tabIndex={-1} type="button" />}
        />
        <BaseMenu.Positioner
          align={align === "right" ? "end" : "start"}
          className={`${PORTAL_Z.dropdown} data-[closed]:pointer-events-none`}
          collisionAvoidance={{ align: "shift", fallbackAxisSide: "none", side: "shift" }}
          collisionPadding={8}
          data-slot="portal-action-menu-positioner"
          positionMethod="fixed"
          side="bottom"
          sideOffset={sideOffset}
        >
          <BaseMenu.Popup
            aria-label={ariaLabel}
            className={cn(
              `max-h-[var(--available-height)] ${menuOriginClass} motion-reduce:!transform-none motion-reduce:!transition-none overflow-hidden rounded-2xl border border-brand-border bg-white text-brand-dark opacity-100 shadow-xl transition-[opacity,transform] duration-150 ease-[var(--portal-ease-out)] data-[closed]:pointer-events-none`,
              fitContent ? "w-max max-w-[calc(100vw-16px)]" : "w-[min(260px,calc(100vw-16px))]",
              menuClassName
            )}
            data-slot="portal-action-menu-popup"
            finalFocus={triggerRef}
            id={menuId}
            style={(state) => {
              const duration = state.open ? 150 : 120;
              return {
                ...menuStyle,
                opacity: state.open ? 1 : 0,
                pointerEvents: state.open ? undefined : "none",
                transform: state.open ? "translateY(0) scale(1)" : "translateY(6px) scale(0.98)",
                transition: `opacity ${duration}ms ${motionEasing}, transform ${duration}ms ${motionEasing}`,
              };
            }}
          >
            {header ? <div className={headerClassName}>{header}</div> : null}
            <div className={`${contentClassName} overflow-y-auto`}>
              <BaseMenuItems>{children}</BaseMenuItems>
            </div>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
