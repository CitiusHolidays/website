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

function variantTones(variant) {
  if (variant === "confirmed") {
    return { value: "text-citius-blue" };
  }
  if (variant === "closed") {
    return { value: "text-brand-muted" };
  }
  return { value: "text-citius-blue" };
}

export function DashboardQueryTypeTile({ type, count, variant = "active", href }) {
  const { value: valueTone } = variantTones(variant);

  const className =
    "rounded-xl border border-brand-border bg-white p-4 shadow-sm shadow-brand-dark/[0.03] transition-[border-color,box-shadow] hover:border-citius-blue/25 hover:shadow-md";

  const inner = (
    <>
      <div className="flex items-center gap-2 font-medium text-brand-muted text-xs">
        <span className="text-citius-blue">
          <QueryTypeIcon type={type} />
        </span>
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
