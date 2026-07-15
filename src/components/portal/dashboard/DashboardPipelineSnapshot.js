"use client";

import Link from "next/link";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { buildPipelineStageHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";
import { formatMoney } from "./utils";

const PIPELINE_DOT_CLASSES = ["bg-citius-blue", "bg-citius-orange", "bg-emerald-600"];

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

  const gridRows = rows.map((row, index) => ({
    ...row,
    dot: PIPELINE_DOT_CLASSES[index] || "bg-slate-400",
    id: row.stage,
    share: total ? Math.round((row.count / total) * 100) : 0,
    width: Math.round((row.count / max) * 100),
  }));

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
      <SelectableDataTable
        columns={[
          {
            id: "stage",
            kind: "identity",
            label: "Stage",
            render: (row) => (
              <Link
                className="inline-flex items-center gap-2 font-medium text-brand-dark hover:text-citius-blue"
                href={buildPipelineStageHref(row.stage, dateRange)}
              >
                <span className={`size-2 rounded-full ${row.dot}`} />
                {row.stage}
              </Link>
            ),
            sortValue: (row) => row.stage,
          },
          {
            id: "share",
            label: "Share",
            render: (row) => (
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-36 overflow-hidden rounded-full bg-brand-border/80">
                  <div
                    className="h-full rounded-full bg-citius-blue"
                    style={{ width: `${row.width}%` }}
                  />
                </div>
                <span className="text-brand-muted text-xs tabular-nums">{row.share}%</span>
              </div>
            ),
            sortValue: (row) => row.share,
          },
          {
            align: "right",
            id: "queries",
            label: "Queries",
            render: (row) => row.count,
            sortValue: (row) => row.count,
          },
          {
            align: "right",
            id: "value",
            label: "Value (INR)",
            render: (row) => formatMoney(row.value || 0).replace("INR ", "₹"),
            sortValue: (row) => row.value,
          },
          {
            align: "right",
            id: "weighted",
            label: "Weighted (INR)",
            render: (row) => formatMoney(row.weighted || 0).replace("INR ", "₹"),
            sortValue: (row) => row.weighted,
          },
        ]}
        compact
        empty="No pipeline data for this period."
        rows={gridRows}
      />
      <div className="mt-4 grid grid-cols-3 gap-3 border-brand-border border-t pt-4 text-right text-sm">
        <div>
          <span className="text-brand-muted">Queries</span>
          <strong className="ml-2 tabular-nums">{total}</strong>
        </div>
        <div>
          <span className="text-brand-muted">Value</span>
          <strong className="ml-2 tabular-nums">
            {formatMoney(totalValue).replace("INR ", "₹")}
          </strong>
        </div>
        <div>
          <span className="text-brand-muted">Weighted</span>
          <strong className="ml-2 tabular-nums">
            {formatMoney(totalWeighted).replace("INR ", "₹")}
          </strong>
        </div>
      </div>
    </DashboardPanel>
  );
}
