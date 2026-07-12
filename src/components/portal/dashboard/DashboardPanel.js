"use client";

import { m, useReducedMotion } from "motion/react";

function DashboardPanelSubtitle({ subtitle }) {
  if (!subtitle) {
    return null;
  }
  if (typeof subtitle === "string") {
    return <p className="mt-1 text-brand-muted text-xs">{subtitle}</p>;
  }
  return <div className="mt-1 text-xs">{subtitle}</div>;
}

function progressFillClass(tone) {
  if (tone === "orange") {
    return "bg-citius-orange";
  }
  if (tone === "green") {
    return "bg-emerald-600";
  }
  return "bg-citius-blue";
}

export function DashboardPanel({ title, subtitle, action, children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-brand-border/80 bg-white/95 p-4 shadow-brand-dark/[0.025] shadow-sm md:p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          {typeof title === "string" ? (
            <h2 className="font-heading font-semibold text-brand-dark text-sm">{title}</h2>
          ) : (
            <div className="font-heading font-semibold text-brand-dark text-sm">{title}</div>
          )}
          <DashboardPanelSubtitle subtitle={subtitle} />
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
      <h3 className="font-heading font-semibold text-base text-brand-dark tracking-tight">
        {title}
      </h3>
      {detail ? <p className="text-brand-muted text-xs">{detail}</p> : null}
    </div>
  );
}

export function DashboardEmpty({ label }) {
  return (
    <p className="rounded-lg border border-brand-border border-dashed bg-brand-light px-4 py-8 text-center text-brand-muted text-sm">
      {label}
    </p>
  );
}

export function DashboardProgress({ label, value, tone = "blue", meta }) {
  const shouldReduceMotion = useReducedMotion();
  const pct = Math.min(value || 0, 100);
  const fill = progressFillClass(tone);
  return (
    <div>
      <div className="mt-3 flex justify-between gap-3 text-brand-muted text-xs">
        <span>{label}</span>
        <span className="shrink-0 tabular-nums">
          <strong className="text-citius-blue">{pct}%</strong>
          {meta ? <span className="ml-3 text-brand-muted">{meta}</span> : null}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-border/80">
        <m.div
          animate={{ transform: `scaleX(${pct / 100})` }}
          className={`h-full w-full origin-left rounded-full ${fill}`}
          initial={{ transform: shouldReduceMotion ? `scaleX(${pct / 100})` : "scaleX(0)" }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
        />
      </div>
    </div>
  );
}
