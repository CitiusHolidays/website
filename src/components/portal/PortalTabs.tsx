"use client";

import { AnimatePresence, m } from "motion/react";
import type { KeyboardEvent, ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { useMotionUITheme, useMotionUITransition } from "@/components/motion-ui/ui-theme";
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
  const listRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(0);
  const { motionMode } = useMotionUITheme();
  const snapTransition = useMotionUITransition("snap");
  const uiTransition = useMotionUITransition("ui");
  const still = motionMode === "off";
  const motionAllowed = motionMode === "full";
  const slide = motionAllowed ? 24 : 0;

  const ids = items.flatMap((item) => (item.disabled ? [] : [item.id]));
  const tabId = (id: string) => `portal-tab-${instanceId}-${encodeURIComponent(id)}`;
  const panelId = (id: string) => `portal-tabpanel-${instanceId}-${encodeURIComponent(id)}`;

  const selectWithDirection = (id: string, select: boolean) => {
    const currentIndex = ids.indexOf(value);
    const nextIndex = ids.indexOf(id);
    if (nextIndex >= 0 && currentIndex >= 0 && nextIndex !== currentIndex) {
      setDirection(nextIndex > currentIndex ? 1 : -1);
    }
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
    selectWithDirection(
      nextTabId(ids, currentId, event.key as PortalTabKey),
      selectionMode === "automatic"
    );
  };

  const handleSelect = (id: string) => {
    selectWithDirection(id, true);
  };

  const enterTransition = still ? { duration: 0 } : { duration: uiTransition.duration };
  const exitTransition = still ? { duration: 0 } : { duration: uiTransition.duration * 0.5 };

  return (
    <div className={className}>
      <div
        aria-label={ariaLabel}
        className="relative inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-brand-border/80 bg-white p-1 shadow-brand-dark/[0.025] shadow-sm"
        ref={listRef}
        role="tablist"
      >
        {items.map((item) => {
          const selected = value === item.id;
          return (
            <button
              aria-controls={panelId(item.id)}
              aria-disabled={item.disabled || undefined}
              aria-selected={selected}
              className={`relative min-h-11 shrink-0 rounded-lg px-3.5 font-semibold text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? "text-white" : "text-brand-muted hover:bg-brand-light hover:text-brand-dark"
              }`}
              data-tab-id={item.id}
              disabled={item.disabled}
              id={tabId(item.id)}
              key={item.id}
              onClick={() => handleSelect(item.id)}
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
              {selected ? (
                <m.span
                  className="absolute inset-0 rounded-lg bg-citius-blue shadow-[0_6px_16px_rgba(16,42,131,0.18)] ring-2 ring-citius-blue ring-offset-2"
                  layoutId={`portal-tabs-indicator-${instanceId}`}
                  transition={motionAllowed ? snapTransition : { duration: 0 }}
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center">
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
              </span>
            </button>
          );
        })}
      </div>
      <div className={`relative grid ${panelClassName}`}>
        {items.map((item) => {
          const selected = value === item.id;
          return (
            <div
              aria-labelledby={tabId(item.id)}
              className="col-start-1 row-start-1"
              hidden={!selected}
              id={panelId(item.id)}
              key={item.id}
              role="tabpanel"
              tabIndex={selected ? 0 : undefined}
            >
              <AnimatePresence custom={direction} initial={false} mode="sync">
                {selected ? (
                  <m.div
                    animate={{ filter: "blur(0px)", opacity: 1, transform: "translateX(0)" }}
                    custom={direction}
                    exit={{
                      filter: still ? "blur(0px)" : "blur(4px)",
                      opacity: still ? 1 : 0,
                      transform: `translateX(${-direction * slide}px)`,
                      transition: exitTransition,
                    }}
                    initial={{
                      filter: still ? "blur(0px)" : "blur(4px)",
                      opacity: still ? 1 : 0,
                      transform: `translateX(${direction * slide}px)`,
                    }}
                    key={`panel-${item.id}`}
                    transition={enterTransition}
                  >
                    {children}
                  </m.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
