"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { buildTravellerCountSummary } from "@/lib/portal/travellerSummary";
import type { PortalJobCardOption, PortalTravellerListRow } from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { Badge, DashboardSectionHeading, Panel } from "../portalWorkspaceListUi";
import { JobCardFilterPanel } from "./JobCardFilterPanel";

export interface TravellerCountViewProps {
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  rows: PortalTravellerListRow[];
  setJobCardFilter: (value: string) => void;
}

type FoodCountRow = {
  count: number;
  foodPreference: string;
  id: string;
};

type JobTravellerBreakdownRow = {
  clientName: string;
  female: number;
  foodBreakdown: string;
  id: string;
  jobCode: string;
  male: number;
  totalPax: number;
};

function buildJobTravellerCountRows(
  rows: PortalTravellerListRow[],
  jobCards: PortalJobCardOption[]
): JobTravellerBreakdownRow[] {
  const jobsById = new Map(jobCards.map((job) => [String(job.id), job]));
  const groups = new Map<
    string,
    { clientName: string; id: string; jobCode: string; rows: PortalTravellerListRow[] }
  >();
  for (const row of rows || []) {
    const id = row.jobCardId || "unassigned";
    const current = groups.get(id) || {
      clientName: row.clientName || jobsById.get(row.jobCardId || "")?.clientName || "-",
      id,
      jobCode: row.jobCode || jobsById.get(row.jobCardId || "")?.jobCode || "Unassigned",
      rows: [],
    };
    current.rows.push(row);
    groups.set(id, current);
  }
  return Array.from(groups.values())
    .map((group) => {
      const summary = buildTravellerCountSummary(group.rows);
      const foodParts: string[] = [];
      for (const row of summary.foodRows) {
        if (row.value > 0) {
          foodParts.push(`${row.label}: ${row.value}`);
        }
      }
      return {
        clientName: group.clientName,
        female: summary.female,
        foodBreakdown: foodParts.join(", ") || "-",
        id: group.id,
        jobCode: group.jobCode,
        male: summary.male,
        totalPax: group.rows.length,
      };
    })
    .sort((a, b) => a.jobCode.localeCompare(b.jobCode));
}

export function TravellerCountView({
  rows,
  jobCards,
  jobCardFilter,
  setJobCardFilter,
}: TravellerCountViewProps) {
  const selectedRows = jobCardFilter
    ? (rows || []).filter((row) => row.jobCardId === jobCardFilter)
    : rows || [];
  const selectedJob = (jobCards || []).find((job) => String(job.id) === jobCardFilter);
  const summary = buildTravellerCountSummary(selectedRows);
  const foodRows: FoodCountRow[] = summary.foodRows.map((row) => ({
    count: row.value,
    foodPreference: row.label,
    id: row.label,
  }));
  const jobBreakdownRows = jobCardFilter ? [] : buildJobTravellerCountRows(rows || [], jobCards);

  return (
    <Panel
      subtitle="Filter by Job Card and review gender and food preference counts."
      title="Passenger Count"
    >
      <JobCardFilterPanel
        ariaLabel="Filter passenger count by job card"
        jobCardFilter={jobCardFilter}
        jobCards={jobCards}
        setJobCardFilter={setJobCardFilter}
      >
        <div className="grid grid-cols-2 gap-2 sm:min-w-64">
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2">
            <p className="font-semibold text-brand-muted text-xs">Male</p>
            <p className="font-heading font-semibold text-brand-dark text-xl tabular-nums">
              {summary.male}
            </p>
          </div>
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2">
            <p className="font-semibold text-brand-muted text-xs">Female</p>
            <p className="font-heading font-semibold text-brand-dark text-xl tabular-nums">
              {summary.female}
            </p>
          </div>
        </div>
      </JobCardFilterPanel>

      {selectedJob ? (
        <div className="mb-3 text-brand-muted text-sm">
          Showing passenger count for{" "}
          <strong className="text-brand-dark">{selectedJob.jobCode}</strong>
          {selectedJob.clientName ? ` · ${selectedJob.clientName}` : ""}
        </div>
      ) : null}

      <SelectableDataTable
        columns={[
          {
            id: "food-preference",
            label: "Food Preference",
            render: (row: FoodCountRow) => <Badge label={row.foodPreference} tone="green" />,
          },
          { id: "count", label: "Count", render: (row: FoodCountRow) => row.count },
        ]}
        compact
        empty="No traveller rows found for this job card."
        rows={foodRows}
      />

      {!jobCardFilter && jobBreakdownRows.length > 0 ? (
        <div className="mt-5">
          <DashboardSectionHeading
            detail="Counts are grouped from traveller master rows."
            title="Job Card Breakdown"
          />
          <div className="mt-3">
            <SelectableDataTable
              columns={[
                {
                  id: "job",
                  label: "Job",
                  render: (row: JobTravellerBreakdownRow) => strong(row.jobCode),
                },
                {
                  id: "client",
                  label: "Client",
                  render: (row: JobTravellerBreakdownRow) => row.clientName,
                },
                {
                  id: "total-pax",
                  label: "Total Pax",
                  render: (row: JobTravellerBreakdownRow) => row.totalPax,
                },
                { id: "male", label: "Male", render: (row: JobTravellerBreakdownRow) => row.male },
                {
                  id: "female",
                  label: "Female",
                  render: (row: JobTravellerBreakdownRow) => row.female,
                },
                {
                  id: "food",
                  label: "Food",
                  render: (row: JobTravellerBreakdownRow) => row.foodBreakdown,
                },
              ]}
              compact
              empty="No job card passenger counts yet."
              rows={jobBreakdownRows}
            />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
