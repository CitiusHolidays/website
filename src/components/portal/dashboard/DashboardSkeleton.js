"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSectionSkeleton({ lines = 3 }) {
  return (
    <div aria-busy="true" className="space-y-3 rounded-2xl border border-brand-border bg-white p-5">
      <Skeleton className="h-4 w-32 rounded bg-brand-border" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton className="h-16 rounded-xl bg-brand-light" key={`section-skeleton-line-${i}`} />
      ))}
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading overview"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton className="h-28 rounded-2xl bg-brand-border/60" key={`stats-skeleton-${i}`} />
      ))}
    </output>
  );
}
