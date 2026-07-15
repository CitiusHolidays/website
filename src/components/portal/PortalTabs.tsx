"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useId, useRef } from "react";
import { nextTabId, type PortalTabKey } from "@/lib/portal/portalTabs";

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

const NAVIGATION_KEYS = new Set<PortalTabKey>(["ArrowLeft", "ArrowRight", "Home", "End"]);

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
  const instanceId = useId().replaceAll(":", "");
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const ids = items.flatMap((item) => (item.disabled ? [] : [item.id]));
  const tabId = (id: string) => `portal-tab-${instanceId}-${encodeURIComponent(id)}`;
  const panelId = (id: string) => `portal-tabpanel-${instanceId}-${encodeURIComponent(id)}`;

  const selectAndFocus = (id: string, select: boolean) => {
    if (select) {
      onValueChange(id);
    }
    queueMicrotask(() => tabRefs.current.get(id)?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!NAVIGATION_KEYS.has(event.key as PortalTabKey)) {
      return;
    }
    event.preventDefault();
    const currentId = event.currentTarget.dataset.tabId || value;
    selectAndFocus(
      nextTabId(ids, currentId, event.key as PortalTabKey),
      selectionMode === "automatic"
    );
  };

  return (
    <div className={className}>
      <div
        aria-label={ariaLabel}
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-brand-border/80 bg-white p-1 shadow-brand-dark/[0.025] shadow-sm"
        role="tablist"
      >
        {items.map((item) => {
          const selected = value === item.id;
          return (
            <button
              aria-controls={panelId(item.id)}
              aria-disabled={item.disabled || undefined}
              aria-selected={selected}
              className={`min-h-11 shrink-0 rounded-lg px-3.5 font-semibold text-sm transition-[background-color,color,box-shadow,transform] duration-150 ease-[var(--portal-ease-out)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "bg-citius-blue text-white shadow-[0_6px_16px_rgba(16,42,131,0.18)] ring-2 ring-citius-blue ring-offset-2"
                  : "text-brand-muted hover:bg-brand-light hover:text-brand-dark"
              }`}
              data-tab-id={item.id}
              disabled={item.disabled}
              id={tabId(item.id)}
              key={item.id}
              onClick={() => onValueChange(item.id)}
              onKeyDown={handleKeyDown}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(item.id, node);
                } else {
                  tabRefs.current.delete(item.id);
                }
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {item.label}
              {typeof item.count === "number" ? (
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    selected ? "bg-white/16 text-white" : "bg-brand-light text-brand-muted"
                  }`}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {items.map((item) => {
        const selected = value === item.id;
        return (
          <div
            aria-labelledby={tabId(item.id)}
            className={panelClassName}
            hidden={!selected}
            id={panelId(item.id)}
            key={item.id}
            role="tabpanel"
            tabIndex={selected ? 0 : undefined}
          >
            {selected ? children : null}
          </div>
        );
      })}
    </div>
  );
}
