"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Tabs } from "@/components/ui/foundation/base";
import { isRuntimeNumber } from "../../lib/runtimeValues";

export interface PortalTabItem {
  count?: number;
  disabled?: boolean;
  id: string;
  label: string;
}

interface PortalTabsProps {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  items: readonly PortalTabItem[];
  onValueChange: (value: string) => void;
  panelClassName?: string;
  selectionMode?: "automatic" | "manual";
  value: string;
}

function PortalTabButton({ disabled = false, ...props }: ComponentProps<typeof Tabs.Tab>) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Base UI keeps disabled composite tabs focusable. The established Staff
    // facade instead skips them, so preserve the native disabled state and let
    // Base UI's roving-focus engine detect it without taking over keyboard logic.
    if (ref.current) {
      ref.current.disabled = disabled;
    }
  }, [disabled]);

  return <Tabs.Tab disabled={disabled} ref={ref} {...props} />;
}

export function PortalTabs({
  ariaLabel,
  children,
  className = "",
  items,
  onValueChange,
  panelClassName = "mt-4",
  selectionMode = "automatic",
  value,
}: PortalTabsProps) {
  const handleValueChange = (nextValue: string) => onValueChange(nextValue);

  return (
    <Tabs.Root className={className} onValueChange={handleValueChange} value={value}>
      <Tabs.List
        activateOnFocus={selectionMode === "automatic"}
        aria-label={ariaLabel}
        className="relative inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-brand-border/80 bg-white p-1 shadow-brand-dark/[0.025] shadow-sm"
        loopFocus
      >
        {items.map((item) => {
          const selected = value === item.id;
          return (
            <PortalTabButton
              className={`relative min-h-11 shrink-0 rounded-lg px-3.5 font-semibold text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 ${
                selected
                  ? "text-white"
                  : "text-brand-muted hover:bg-brand-light hover:text-brand-dark"
              }`}
              data-tab-id={item.id}
              disabled={item.disabled}
              key={item.id}
              value={item.id}
            >
              {selected ? (
                <span className="absolute inset-0 rounded-lg bg-citius-blue shadow-[0_6px_16px_rgba(16,42,131,0.18)] ring-2 ring-citius-blue ring-offset-2" />
              ) : null}
              <span className="relative z-10 inline-flex items-center">
                {item.label}
                {isRuntimeNumber(item.count) ? (
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                      selected ? "bg-white/16 text-white" : "bg-brand-light text-brand-muted"
                    }`}
                  >
                    {item.count}
                  </span>
                ) : null}
              </span>
            </PortalTabButton>
          );
        })}
      </Tabs.List>
      <div className={`relative grid ${panelClassName}`}>
        {items.map((item) => {
          const selected = value === item.id;
          return (
            <Tabs.Panel
              className="col-start-1 row-start-1"
              keepMounted
              key={item.id}
              value={item.id}
            >
              {selected ? children : null}
            </Tabs.Panel>
          );
        })}
      </div>
    </Tabs.Root>
  );
}
