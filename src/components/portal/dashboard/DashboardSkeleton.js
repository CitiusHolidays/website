"use client";

export function DashboardSectionSkeleton({ lines = 3 }) {
  return (
    <div
      className="animate-pulse space-y-3 rounded-2xl border border-brand-border bg-white p-5"
      aria-busy="true"
    >
      <div className="h-4 w-32 rounded bg-brand-border" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={`section-skeleton-line-${i}`} className="h-16 rounded-xl bg-brand-light" />
      ))}
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <output
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
      aria-busy="true"
      aria-label="Loading overview"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={`stats-skeleton-${i}`}
          className="h-28 animate-pulse rounded-2xl bg-brand-border/60"
        />
      ))}
    </output>
  );
}
