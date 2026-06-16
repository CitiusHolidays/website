"use client";

const EMPTY_SECTIONS = [];

export default function JobCardReadinessMap({ sections = EMPTY_SECTIONS }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {sections.map((section) => (
        <div key={section.key} className="rounded-lg border border-brand-border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-heading text-sm text-brand-dark">{section.label}</p>
            <p className="font-sans text-xs tabular-nums text-brand-muted">
              {section.done}/{section.total}
            </p>
          </div>
          <div className="mt-3 h-2 rounded-full bg-brand-light">
            <div
              className="h-full rounded-full bg-citius-blue"
              style={{ width: `${section.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
