"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { Button } from "@/components/ui/application-button";
import { estimateRoomCount } from "../portalOperationsHelpers";
import type {
  PortalJobCardOption,
  PortalPaginationSlice,
  PortalRoomCountSummary,
} from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { Badge, DashboardSectionHeading, Panel } from "../portalWorkspaceListUi";

export interface RoomCountViewProps {
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  pagination?: PortalPaginationSlice;
  summary?: PortalRoomCountSummary;
}

interface RoomTypeCountRow {
  assignments: number;
  estimatedRooms: number;
  id: string;
  roomType: string;
}

type JobRoomBreakdownRow = NonNullable<PortalRoomCountSummary["jobBreakdown"]>[number] & {
  estimatedRooms: number;
  roomBreakdown: string;
};

function buildJobRoomBreakdownRows(summary: PortalRoomCountSummary): JobRoomBreakdownRow[] {
  return (summary.jobBreakdown || []).map((row) => ({
    ...row,
    estimatedRooms: row.roomTypes.reduce(
      (sum, roomType) => sum + estimateRoomCount(roomType.roomType, roomType.assignments),
      0
    ),
    roomBreakdown:
      row.roomTypes.map((roomType) => `${roomType.roomType}: ${roomType.assignments}`).join(", ") ||
      "-",
  }));
}

export function RoomCountView({
  summary,
  jobCards,
  jobCardFilter,
  pagination,
}: RoomCountViewProps) {
  if (
    summary?.complete !== true ||
    summary.roomTypes === undefined ||
    summary.totalAssignments === undefined
  ) {
    return (
      <Panel title="Room Count">
        <p className="text-brand-muted text-sm" role="status">
          Room counts are not ready yet.
        </p>
      </Panel>
    );
  }
  const selectedJob = jobCards.find((job) => job.id === jobCardFilter);
  const roomTypeRows: RoomTypeCountRow[] = summary.roomTypes.map((row) => ({
    ...row,
    estimatedRooms: estimateRoomCount(row.roomType, row.assignments),
    id: row.roomType,
  }));
  const { totalAssignments } = summary;
  const totalEstimatedRooms = roomTypeRows.reduce((sum, row) => sum + row.estimatedRooms, 0);
  const jobBreakdownRows = jobCardFilter ? [] : buildJobRoomBreakdownRows(summary);

  return (
    <Panel
      subtitle="Counts use the selected Job Card and period. Search and room filters apply to Rooming assignments."
      title="Room Count"
    >
      <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-brand-muted">
            {summary.scope === "visible-job-page" ? "Loaded Job Card rooming rows" : "Rooming rows"}
          </dt>
          <dd className="font-semibold tabular-nums">{totalAssignments}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-brand-muted">Estimated rooms</dt>
          <dd className="font-semibold tabular-nums">{totalEstimatedRooms}</dd>
        </div>
      </dl>

      {!jobCardFilter && summary?.breakdownComplete === false ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 text-sm">
          <span>
            {summary.scope === "all-visible"
              ? "Totals cover all records available to your role. The breakdown shows only loaded Job Cards."
              : "Counts and the breakdown include only loaded Job Cards available to you."}
          </span>
          {pagination?.canLoadMore ? (
            <Button
              className="portal-small-btn"
              disabled={pagination.isLoadingMore}
              onClick={pagination.loadMore}
              type="button"
            >
              {pagination.isLoadingMore ? "Loading…" : "Load more Job Cards"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {selectedJob ? (
        <div className="mb-3 text-brand-muted text-sm">
          Showing room count for <strong className="text-brand-dark">{selectedJob.jobCode}</strong>
          {selectedJob.clientName ? ` · ${selectedJob.clientName}` : ""}
        </div>
      ) : null}

      <SelectableDataTable
        columns={[
          {
            id: "room-type",
            label: "Room Type",
            render: (row: RoomTypeCountRow) => <Badge label={row.roomType} tone="blue" />,
          },
          {
            id: "rooming-rows",
            label: "Rooming Rows",
            render: (row: RoomTypeCountRow) => row.assignments,
          },
          {
            id: "estimated-rooms",
            label: "Estimated Rooms",
            render: (row: RoomTypeCountRow) => row.estimatedRooms,
          },
        ]}
        compact
        empty="No rooming rows found for this job card."
        rows={roomTypeRows}
      />

      {!jobCardFilter && jobBreakdownRows.length > 0 ? (
        <div className="mt-5">
          <DashboardSectionHeading
            detail="Counts are grouped from rooming assignments."
            title="Job Card Breakdown"
          />
          <div className="mt-3">
            <SelectableDataTable
              columns={[
                {
                  id: "job",
                  label: "Job",
                  render: (row: JobRoomBreakdownRow) => strong(row.jobCode),
                },
                {
                  id: "client",
                  label: "Client",
                  render: (row: JobRoomBreakdownRow) => row.clientName,
                },
                {
                  id: "rooming-rows",
                  label: "Rooming Rows",
                  render: (row: JobRoomBreakdownRow) => row.assignments,
                },
                {
                  id: "est-rooms",
                  label: "Est. Rooms",
                  render: (row: JobRoomBreakdownRow) => row.estimatedRooms,
                },
                {
                  id: "room-types",
                  label: "Room Types",
                  render: (row: JobRoomBreakdownRow) => row.roomBreakdown,
                },
              ]}
              compact
              empty="No job card room counts yet."
              rows={jobBreakdownRows}
            />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
