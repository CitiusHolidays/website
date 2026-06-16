"use client";

const EMPTY_REGIONS = [];

export default function YatriRegionMap({ regions = EMPTY_REGIONS }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {regions.map((region) => (
        <div key={region.region} className="rounded-lg border border-brand-light bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-heading text-sm capitalize text-brand-dark">{region.region}</p>
            <p className="font-sans text-xs tabular-nums text-brand-muted">
              {region.visited}/{region.total}
            </p>
          </div>
          <div className="mt-3 h-2 rounded-full bg-brand-light">
            <div
              className="h-full rounded-full bg-citius-orange"
              style={{ width: `${region.percent}%` }}
            />
          </div>
          {region.states?.length > 0 && (
            <p className="mt-2 truncate font-sans text-xs text-brand-muted">
              {region.states.join(", ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
