"use client";

import { Boxes, Building2, Globe2, UsersRound } from "lucide-react";
import Link from "next/link";

function QueryTypeIcon({ type }) {
  if (type.includes("Cement") || type === "Cement types") {
    return <Boxes className="shrink-0" size={18} />;
  }
  if (type.startsWith("MICE")) {
    return <UsersRound className="shrink-0" size={18} />;
  }
  if (type.includes("FIT") || type === "Family Group") {
    return <Building2 className="shrink-0" size={18} />;
  }
  return <Globe2 className="shrink-0" size={18} />;
}

function queryTypeTone(type) {
  if (type.includes("Cement") || type === "Cement types") {
    return "bg-stone-50 border-stone-300 text-stone-700";
  }
  if (type.startsWith("MICE")) {
    return "bg-blue-50 border-citius-blue/25 text-citius-blue";
  }
  if (type.includes("FIT") || type === "Family Group") {
    return "bg-emerald-50 border-emerald-300 text-emerald-700";
  }
  return "bg-orange-50 border-citius-orange/30 text-brand-dark";
}

function variantTones(variant) {
  if (variant === "confirmed") {
    return { ring: "ring-1 ring-emerald-500/15", value: "text-emerald-700" };
  }
  if (variant === "closed") {
    return { ring: "ring-1 ring-stone-400/20", value: "text-stone-600" };
  }
  return { ring: "", value: "text-citius-blue" };
}

export function DashboardQueryTypeTile({ type, count, variant = "active", href }) {
  const tone = queryTypeTone(type);
  const { ring: ringTone, value: valueTone } = variantTones(variant);

  const className = `rounded-xl border p-4 shadow-sm shadow-brand-dark/[0.03] transition-shadow hover:shadow-md hover:border-citius-orange/30 ${tone} ${ringTone}`;

  const inner = (
    <>
      <div className="flex items-center gap-2 font-medium text-brand-muted text-xs">
        <QueryTypeIcon type={type} />
        <span className="truncate" title={type}>
          {type}
        </span>
      </div>
      <div className={`mt-4 font-heading font-semibold text-3xl tabular-nums ${valueTone}`}>
        {count}
      </div>
      <div className="mt-2 text-brand-muted text-xs">In selected period</div>
    </>
  );

  if (href) {
    return (
      <Link className={className} href={href}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
