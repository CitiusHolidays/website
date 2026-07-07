"use client";

import Link from "next/link";

export function DashboardStatCard({ label, value, Icon, featured = false, href, trend }) {
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
        <div
          className={`rounded-lg p-1.5 ${
            featured ? "bg-citius-blue/10 text-citius-blue" : "bg-citius-blue/5 text-citius-blue"
          }`}
        >
          <Icon size={17} />
        </div>
      </div>
      <div className="mt-3 font-heading font-semibold text-3xl text-brand-dark tabular-nums leading-none">
        {value}
      </div>
      <div className={`mt-2 text-xs ${trendTone}`}>{trend?.label || "— no change"}</div>
    </>
  );

  const className = `block min-h-32 overflow-hidden rounded-xl border border-brand-border bg-white p-4 shadow-sm shadow-brand-dark/[0.03] transition-shadow hover:border-citius-orange/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citius-blue ${
    featured ? "border-l-4 border-l-citius-orange" : ""
  }`;

  if (href) {
    return (
      <Link aria-label={`${label}: ${value}. View details.`} className={className} href={href}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
