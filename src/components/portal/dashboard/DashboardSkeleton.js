"use client";

import { Skeleton } from "@/components/ui/skeleton";

function placeholderKeys(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

export function DashboardSectionSkeleton({ lines = 3 }) {
  const lineKeys = placeholderKeys("section-skeleton-line", lines);
  return (
    <div aria-busy="true" className="space-y-3 rounded-2xl border border-brand-border bg-white p-5">
      <Skeleton className="h-4 w-32 rounded bg-brand-border" />
      {lineKeys.map((lineKey) => (
        <Skeleton className="h-16 rounded-xl bg-brand-light" key={lineKey} />
      ))}
    </div>
  );
}

export function DashboardStatsSkeleton() {
  const statKeys = placeholderKeys("stats-skeleton", 5);
  return (
    <output
      aria-busy="true"
      aria-label="Loading overview"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
    >
      {statKeys.map((statKey) => (
        <Skeleton className="h-28 rounded-2xl bg-brand-border/60" key={statKey} />
      ))}
    </output>
  );
}
