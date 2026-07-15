"use client";

import { CheckCircle2, CircleDollarSign, ClipboardList } from "lucide-react";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { LoadingPanel } from "../portalAdminHelpers";
import type { PortalReportLocationRow, ReportsViewProps } from "../portalViewTypes";
import { money, strong } from "../portalWorkspaceListHelpers";
import { Panel, StatCard } from "../portalWorkspaceListUi";

export function ReportsView({ report }: ReportsViewProps) {
  if (!report) {
    return <LoadingPanel />;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          Icon={CircleDollarSign}
          label="Pipeline Budget"
          value={money(report.summary.totalPipelineBudget)}
        />
        <StatCard
          Icon={CheckCircle2}
          label="Confirmed Revenue"
          value={money(report.summary.confirmedRevenue)}
        />
        <StatCard
          Icon={ClipboardList}
          label="Confirmed / Lost"
          value={`${report.summary.confirmedQueries}/${report.summary.lostQueries}`}
        />
      </div>
      <Panel title="Revenue by query type">
        <SelectableDataTable
          columns={[
            {
              id: "type",
              label: "Type",
              render: (row: { count?: number; queryType: string; revenue?: number }) =>
                strong(row.queryType),
            },
            {
              id: "pipeline-budget",
              label: "Pipeline Budget",
              render: (row: { count?: number; queryType: string; revenue?: number }) =>
                money(row.revenue),
            },
            {
              id: "queries",
              label: "Queries",
              render: (row: { count?: number; queryType: string; revenue?: number }) => row.count,
            },
          ]}
          compact
          empty="No query revenue yet."
          rows={report.revenueByType.map((row) => ({ ...row, id: row.queryType }))}
        />
      </Panel>
      <Panel title="Location-wise headcount">
        <SelectableDataTable
          columns={[
            {
              id: "location",
              label: "Location",
              render: (row: PortalReportLocationRow) => strong(row.location),
            },
            {
              id: "headcount",
              label: "Headcount",
              render: (row: PortalReportLocationRow) => row.count,
            },
          ]}
          compact
          empty="No staff locations yet."
          rows={report.locationHeadcount}
        />
      </Panel>
    </div>
  );
}
