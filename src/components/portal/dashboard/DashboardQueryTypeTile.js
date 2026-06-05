"use client";

import { Boxes, Building2, Globe2, UsersRound } from "lucide-react";
import Link from "next/link";

export function DashboardQueryTypeTile({ type, count, variant = "active", href }) {
  const Icon =
    type.includes("Cement") || type === "Cement types"
      ? Boxes
      : type.startsWith("MICE")
        ? UsersRound
        : type.includes("FIT") || type === "Family Group"
          ? Building2
          : Globe2;
  const tone =
    type.includes("Cement") || type === "Cement types"
      ? "from-stone-500/8 to-white border-stone-300 text-stone-700"
      : type.startsWith("MICE")
        ? "from-citius-blue/10 to-white border-citius-blue/25 text-citius-blue"
        : type.includes("FIT") || type === "Family Group"
          ? "from-emerald-500/10 to-white border-emerald-300 text-emerald-700"
          : "from-citius-orange/10 to-white border-citius-orange/30 text-citius-orange";
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

  const className = `rounded-xl border bg-linear-to-br p-4 shadow-sm shadow-brand-dark/[0.03] transition-shadow hover:shadow-md hover:border-citius-orange/30 ${tone} ${ringTone}`;

  const inner = (
    <>
      <div className="flex items-center gap-2 text-xs font-medium text-brand-muted">
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{type}</span>
      </div>
      <div className={`mt-4 font-heading text-3xl font-semibold tabular-nums ${valueTone}`}>
        {count}
      </div>
      <div className="mt-2 text-xs text-brand-muted">In selected period</div>
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
