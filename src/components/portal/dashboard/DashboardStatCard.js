"use client";

import Link from "next/link";

export function DashboardStatCard({ label, value, Icon, featured = false, href }) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className={`text-xs font-semibold ${featured ? "text-white/80" : "text-brand-muted"}`}>
          {label}
        </div>
        <div className={`rounded-full p-2 ${featured ? "bg-white/15" : "bg-citius-orange/10"}`}>
          <Icon size={18} className="text-citius-orange" />
        </div>
      </div>
      <div
        className={`mt-3 font-heading text-3xl font-semibold tabular-nums ${featured ? "text-white" : "text-citius-blue"}`}
      >
        {value}
      </div>
    </>
  );

  const className = `block overflow-hidden rounded-2xl border border-brand-border bg-white p-5 shadow-sm transition-shadow hover:border-citius-orange/30 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citius-blue ${
    featured ? "sm:col-span-2 bg-linear-to-br from-citius-blue to-citius-blue/90 text-white" : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
