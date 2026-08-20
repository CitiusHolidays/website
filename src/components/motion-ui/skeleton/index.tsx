"use client";

import { m } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useMotionUITheme, useMotionUITransition } from "@/components/motion-ui/ui-theme";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function placeholderKeys(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

export interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  const ambient = useMotionUITransition("ambient");
  const { motionMode } = useMotionUITheme();
  const shimmering = motionMode === "full";

  return (
    <div
      className={cx("relative overflow-hidden rounded-md bg-brand-light", className)}
      style={style}
    >
      {shimmering ? (
        <m.div
          animate={{ transform: "translateX(100%)" }}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-full w-full bg-linear-to-r from-transparent via-white/70 to-transparent"
          initial={{ transform: "translateX(-100%)" }}
          transition={{
            duration: ambient.duration * 2.5,
            ease: "linear",
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      ) : null}
    </div>
  );
}

export interface SkeletonTableProps {
  columnCount?: number;
  rowCount?: number;
}

export function SkeletonTable({ columnCount = 4, rowCount = 4 }: SkeletonTableProps) {
  const columnKeys = placeholderKeys("column", columnCount);
  const rowKeys = placeholderKeys("row", rowCount);
  return (
    <div
      aria-busy="true"
      aria-label="Loading records"
      className="overflow-hidden rounded-2xl border border-brand-border bg-white"
      role="progressbar"
    >
      <div className="grid gap-6 border-brand-border border-b bg-brand-light/80 px-4 py-3">
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {columnKeys.map((columnKey) => (
            <Skeleton className="h-3" key={`header-${columnKey}`} />
          ))}
        </div>
      </div>
      {rowKeys.map((rowKey) => (
        <div
          className="grid gap-6 border-brand-border border-b px-4 py-4 last:border-b-0"
          key={rowKey}
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {columnKeys.map((columnKey) => (
            <Skeleton className="h-4" key={`${rowKey}-${columnKey}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMobileCards({ count = 3 }: { count?: number }) {
  const cardKeys = placeholderKeys("mobile", count);
  return (
    <div className="space-y-3 md:hidden">
      {cardKeys.map((cardKey) => (
        <div className="rounded-2xl border border-brand-border bg-white p-4" key={cardKey}>
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="mt-3 h-5 w-4/5" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface SkeletonRevealProps {
  children: ReactNode;
  loaded: boolean;
  skeleton: ReactNode;
}

export function SkeletonReveal({ children, loaded, skeleton }: SkeletonRevealProps) {
  if (!loaded) {
    return <>{skeleton}</>;
  }
  return (
    <m.div
      animate={{ opacity: 1 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "linear" }}
    >
      {children}
    </m.div>
  );
}
