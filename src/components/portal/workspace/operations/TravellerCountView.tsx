"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { buildTravellerCountSummary } from "@/lib/portal/travellerSummary";
import type { PortalJobCardOption, PortalTravellerListRow } from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { Badge, DashboardSectionHeading } from "../portalWorkspaceListUi";

export interface TravellerCountViewProps {
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  rows: PortalTravellerListRow[];
}

interface FoodCountRow {
  count: number;
  foodPreference: string;
  id: string;
}

interface JobTravellerBreakdownRow {
  clientName: string;
  female: number;
  foodBreakdown: string;
  id: string;
  jobCode: string;
  male: number;
  totalPax: number;
}

function buildJobTravellerCountRows(
  rows: PortalTravellerListRow[],
  jobCards: PortalJobCardOption[]
): JobTravellerBreakdownRow[] {
  const jobsById = new Map(jobCards.map((job) => [String(job.id), job]));
  const groups = new Map<
    string,
    { clientName: string; id: string; jobCode: string; rows: PortalTravellerListRow[] }
  >();
  for (const row of rows) {
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

export function TravellerCountView({ rows, jobCards, jobCardFilter }: TravellerCountViewProps) {
  const selectedRows = jobCardFilter ? rows.filter((row) => row.jobCardId === jobCardFilter) : rows;
  const selectedJob = jobCards.find((job) => String(job.id) === jobCardFilter);
  const summary = buildTravellerCountSummary(selectedRows);
  const foodRows: FoodCountRow[] = summary.foodRows
    .filter((row) => row.value > 0)
    .map((row) => ({ count: row.value, foodPreference: row.label, id: row.label }));
  const jobBreakdownRows = jobCardFilter ? [] : buildJobTravellerCountRows(rows, jobCards);

  return (
    <details className="rounded-xl border border-brand-border bg-white px-4">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold text-brand-dark text-sm focus-visible:outline-2 focus-visible:outline-citius-blue">
        Traveller counts · {selectedRows.length} loaded
      </summary>
      <div className="space-y-4 pb-4">
        <p className="text-brand-muted text-xs">
          Counts cover the loaded traveller records in the current Job Card and period scope.
        </p>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-brand-muted">Male</dt>
            <dd className="font-semibold tabular-nums">{summary.male}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-brand-muted">Female</dt>
            <dd className="font-semibold tabular-nums">{summary.female}</dd>
          </div>
        </dl>

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
              detail="Counts are grouped from loaded traveller records."
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
                    label: "Loaded travellers",
                    render: (row: JobTravellerBreakdownRow) => row.totalPax,
                  },
                  {
                    id: "male",
                    label: "Male",
                    render: (row: JobTravellerBreakdownRow) => row.male,
                  },
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
      </div>
    </details>
  );
}
