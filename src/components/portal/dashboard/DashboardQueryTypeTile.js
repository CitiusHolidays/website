"use client";

import Link from "next/link";

export function DashboardQueryTypeTile({ type, count, variant = "active", href }) {
  const tone = type.includes("Cement")
    ? "from-stone-500/10 to-stone-500/5 border-stone-200"
    : type.startsWith("MICE")
      ? "from-citius-blue/12 to-citius-blue/5 border-citius-blue/15"
      : type === "FIT" || type === "Family Group"
        ? "from-emerald-500/12 to-emerald-500/5 border-emerald-200"
        : "from-citius-orange/12 to-citius-orange/5 border-citius-orange/20";
  const valueTone =
    variant === "confirmed"
      ? "text-emerald-700"
      : variant === "closed"
        ? "text-stone-600"
        : "text-citius-blue";
  const ringTone =
    variant === "confirmed"
      ? "ring-1 ring-emerald-500/15"
      : variant === "closed"
        ? "ring-1 ring-stone-400/20"
        : "";

  const className = `rounded-xl border bg-linear-to-br p-4 shadow-sm transition-shadow hover:shadow-md hover:border-citius-orange/30 ${tone} ${ringTone}`;

  const inner = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {type}
      </div>
      <div className={`mt-2 font-heading text-2xl font-semibold tabular-nums ${valueTone}`}>
        {count}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
