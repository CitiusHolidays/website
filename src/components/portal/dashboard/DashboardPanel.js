"use client";

import { m } from "motion/react";

export function DashboardPanel({ title, subtitle, action, children, className = "" }) {
  return (
    <section
      className={`rounded-xl border border-brand-border bg-white p-4 shadow-sm shadow-brand-dark/[0.03] md:p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          {typeof title === "string" ? (
            <h2 className="text-sm font-bold uppercase tracking-tight text-brand-dark">{title}</h2>
          ) : (
            <div className="text-sm font-bold uppercase tracking-tight text-brand-dark">
              {title}
            </div>
          )}
          {subtitle ? (
            typeof subtitle === "string" ? (
              <p className="mt-1 text-xs text-brand-muted">{subtitle}</p>
            ) : (
              <div className="mt-1 text-xs">{subtitle}</div>
            )
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DashboardSectionHeading({ title, detail, className = "" }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-2 ${className}`}>
      <h3 className="font-heading text-base font-semibold tracking-tight text-brand-dark">
        {title}
      </h3>
      {detail ? <p className="text-xs text-brand-muted">{detail}</p> : null}
    </div>
  );
}

export function DashboardEmpty({ label }) {
  return (
    <p className="rounded-lg border border-dashed border-brand-border bg-brand-light px-4 py-8 text-center text-sm text-brand-muted">
      {label}
    </p>
  );
}

export function DashboardProgress({ label, value, tone = "blue", meta }) {
  const pct = Math.min(value || 0, 100);
  const fill =
    tone === "orange" ? "bg-citius-orange" : tone === "green" ? "bg-emerald-600" : "bg-citius-blue";
  return (
    <div>
      <div className="mt-3 flex justify-between gap-3 text-xs text-brand-muted">
        <span>{label}</span>
        <span className="shrink-0 tabular-nums">
          <strong className="text-citius-blue">{pct}%</strong>
          {meta ? <span className="ml-3 text-brand-muted">{meta}</span> : null}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-border/80">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${fill}`}
        />
      </div>
    </div>
  );
}
