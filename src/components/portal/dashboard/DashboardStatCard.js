"use client";

import { AnimateNumber } from "motion-plus/react";
import Link from "next/link";
import { useMotionUITransition } from "@/components/motion-ui/ui-theme";
import { isRuntimeNumber } from "../../../lib/runtimeValues";

function parseNumericValue(value) {
  if (isRuntimeNumber(value)) {
    return value;
  }
  const normalized = String(value).replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function DashboardStatCard({ label, value, Icon, href, trend }) {
  const livelyTransition = useMotionUITransition("lively");
  const numericValue = parseNumericValue(value);
  const trendTone =
    trend?.direction === "up"
      ? "text-emerald-700"
      : trend?.direction === "down"
        ? "text-rose-700"
        : "text-brand-muted";

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className="max-w-[8rem] font-medium text-brand-dark text-xs leading-tight">
          {label}
        </div>
        <div className="rounded-lg bg-brand-light p-1.5 text-citius-blue">
          <Icon size={17} />
        </div>
      </div>
      <div className="mt-3 font-heading font-semibold text-3xl text-brand-dark tabular-nums leading-none">
        {numericValue === null ? (
          value
        ) : (
          <AnimateNumber transition={livelyTransition}>{numericValue}</AnimateNumber>
        )}
      </div>
      <div className={`mt-2 text-xs ${trendTone}`}>{trend?.label || "No change"}</div>
    </>
  );

  const className =
    "block min-h-32 overflow-hidden rounded-xl border border-brand-border bg-white p-4 shadow-sm shadow-brand-dark/[0.03] transition-[border-color,box-shadow] hover:border-citius-blue/25 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citius-blue";

  if (href) {
    return (
      <Link aria-label={`${label}: ${value}. View details.`} className={className} href={href}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
