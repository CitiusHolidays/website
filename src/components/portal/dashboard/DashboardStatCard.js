"use client";

import Link from "next/link";

export function DashboardStatCard({ label, value, Icon, featured = false, href, trend }) {
  const trendTone =
    trend?.direction === "up"
      ? featured
        ? "text-emerald-200"
        : "text-emerald-700"
      : trend?.direction === "down"
        ? featured
          ? "text-rose-200"
          : "text-rose-700"
        : featured
          ? "text-white/85"
          : "text-brand-muted";

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div
          className={`max-w-[8rem] text-xs font-medium leading-tight ${featured ? "text-white/90" : "text-brand-dark"}`}
        >
          {label}
        </div>
        <div
          className={`rounded-lg p-1.5 ${featured ? "bg-white/15 text-white" : "bg-citius-blue/5 text-citius-blue"}`}
        >
          <Icon size={17} />
        </div>
      </div>
      <div
        className={`mt-3 font-heading text-3xl font-semibold leading-none tabular-nums ${featured ? "text-white" : "text-brand-dark"}`}
      >
        {value}
      </div>
      <div className={`mt-2 text-xs ${trendTone}`}>{trend?.label || "— no change"}</div>
    </>
  );

  const className = `block min-h-32 overflow-hidden rounded-xl border border-brand-border bg-white p-4 shadow-sm shadow-brand-dark/[0.03] transition-shadow hover:border-citius-orange/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citius-blue ${
    featured ? "border-citius-blue bg-linear-to-br from-citius-blue to-[#063aa8] text-white" : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={className} aria-label={`${label}: ${value}. View details.`}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
