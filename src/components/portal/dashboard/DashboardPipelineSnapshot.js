"use client";

import Link from "next/link";
import { buildPipelineStageHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";
import { formatMoney } from "./utils";

export function DashboardPipelineSnapshot({ pipelineSnapshot, dateRange }) {
  const rows = pipelineSnapshot || [];
  const max = Math.max(...rows.map((r) => r.count), 1);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const totalValue = rows.reduce((sum, row) => sum + (row.value || 0), 0);
  const totalWeighted = rows.reduce((sum, row) => sum + (row.weighted || 0), 0);

  if (!rows.length) {
    return (
      <DashboardPanel title="Pipeline snapshot">
        <DashboardEmpty label="No pipeline data for this period." />
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel
      action={
        <Link
          className="font-bold text-citius-blue text-xs hover:underline"
          href="/portal/pipeline"
        >
          Open pipeline
        </Link>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-brand-border border-b text-brand-muted text-xs">
              <th className="py-2 pr-3 font-semibold">Stage</th>
              <th className="py-2 pr-3 font-semibold">Share</th>
              <th className="py-2 pr-3 text-right font-semibold">Queries</th>
              <th className="py-2 pr-3 text-right font-semibold">Value (INR)</th>
              <th className="py-2 text-right font-semibold">Weighted (INR)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const width = Math.round((row.count / max) * 100);
              const share = total ? Math.round((row.count / total) * 100) : 0;
              const dot =
                index === 0
                  ? "bg-citius-blue"
                  : index === 1
                    ? "bg-citius-orange"
                    : index === 2
                      ? "bg-emerald-600"
                      : "bg-slate-400";
              return (
                <tr className="border-brand-border/70 border-b last:border-0" key={row.stage}>
                  <td className="py-2.5 pr-3">
                    <Link
                      className="inline-flex items-center gap-2 font-medium text-brand-dark hover:text-citius-blue"
                      href={buildPipelineStageHref(row.stage, dateRange)}
                    >
                      <span className={`size-2 rounded-full ${dot}`} />
                      {row.stage}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-36 overflow-hidden rounded-full bg-brand-border/80">
                        <div
                          className="h-full rounded-full bg-citius-blue"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-brand-muted text-xs tabular-nums">{share}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-semibold text-brand-dark tabular-nums">
                    {row.count}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-brand-dark tabular-nums">
                    {formatMoney(row.value || 0).replace("INR ", "₹")}
                  </td>
                  <td className="py-2.5 text-right text-brand-dark tabular-nums">
                    {formatMoney(row.weighted || 0).replace("INR ", "₹")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-brand-border border-t font-bold text-brand-dark text-sm">
              <td className="pt-5 pr-3">Total</td>
              <td className="pt-5 pr-3 text-brand-muted">—</td>
              <td className="pt-5 pr-3 text-right tabular-nums">{total}</td>
              <td className="pt-5 pr-3 text-right tabular-nums">
                {formatMoney(totalValue).replace("INR ", "₹")}
              </td>
              <td className="pt-5 text-right tabular-nums">
                {formatMoney(totalWeighted).replace("INR ", "₹")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </DashboardPanel>
  );
}
