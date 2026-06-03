"use client";

import { m as motion } from "motion/react";

export function DashboardPanel({ title, subtitle, children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-brand-border bg-white p-5 shadow-sm md:p-6 ${className}`}
    >
      <div className="mb-4">
        {typeof title === "string" ? (
          <h2 className="font-heading text-lg font-semibold text-citius-blue md:text-xl">
            {title}
          </h2>
        ) : (
          <div className="font-heading text-lg font-semibold text-citius-blue md:text-xl">
            {title}
          </div>
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <p className="mt-1 text-sm text-brand-muted">{subtitle}</p>
          ) : (
            <div className="mt-1 text-sm">{subtitle}</div>
          )
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function DashboardSectionHeading({ title, detail }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h3 className="font-heading text-sm font-semibold tracking-wide text-brand-dark">{title}</h3>
      {detail ? <p className="text-xs text-brand-muted">{detail}</p> : null}
    </div>
  );
}

export function DashboardEmpty({ label }) {
  return (
    <p className="rounded-xl border border-dashed border-brand-border bg-brand-light px-4 py-8 text-center text-sm text-brand-muted">
      {label}
    </p>
  );
}

export function DashboardProgress({ label, value }) {
  const pct = Math.min(value || 0, 100);
  return (
    <div>
      <div className="mt-3 flex justify-between text-xs text-brand-muted">
        <span>{label}</span>
        <strong className="text-citius-blue">{pct}%</strong>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-border">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-linear-to-r from-citius-orange to-citius-blue"
        />
      </div>
    </div>
  );
}
