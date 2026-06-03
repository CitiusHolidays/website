"use client";

import Link from "next/link";
import { buildPipelineStageHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";

export function DashboardPipelineSnapshot({ pipelineSnapshot, dateRange }) {
  const rows = pipelineSnapshot || [];
  const max = Math.max(...rows.map((r) => r.count), 1);

  if (!rows.length) {
    return (
      <DashboardPanel title="Sales pipeline">
        <DashboardEmpty label="No pipeline data for this period." />
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel
      title="Sales pipeline"
      subtitle="Read-only snapshot — open pipeline for full view"
    >
      <ul className="space-y-3">
        {rows.map((row) => {
          const width = Math.round((row.count / max) * 100);
          return (
            <li key={row.stage}>
              <Link
                href={buildPipelineStageHref(row.stage, dateRange)}
                className="group block rounded-lg p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citius-blue"
              >
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-brand-dark group-hover:text-citius-blue">
                    {row.stage}
                  </span>
                  <span className="tabular-nums text-brand-muted">{row.count}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-border">
                  <div
                    className="h-full rounded-full bg-citius-blue transition-all group-hover:bg-citius-orange"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs">
        <Link href="/portal/pipeline" className="font-semibold text-citius-blue hover:underline">
          Open full pipeline
        </Link>
      </p>
    </DashboardPanel>
  );
}
