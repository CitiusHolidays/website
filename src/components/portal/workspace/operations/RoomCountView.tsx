"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { estimateRoomCount } from "../portalOperationsHelpers";
import type {
  PortalJobCardOption,
  PortalPaginationSlice,
  PortalRoomCountSummary,
} from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { Badge, DashboardSectionHeading, Panel } from "../portalWorkspaceListUi";
import { JobCardFilterPanel } from "./JobCardFilterPanel";

export interface RoomCountViewProps {
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  pagination?: PortalPaginationSlice;
  setJobCardFilter: (value: string) => void;
  summary?: PortalRoomCountSummary;
}

type RoomTypeCountRow = {
  assignments: number;
  estimatedRooms: number;
  id: string;
  roomType: string;
};

type JobRoomBreakdownRow = NonNullable<PortalRoomCountSummary["jobBreakdown"]>[number] & {
  estimatedRooms: number;
  roomBreakdown: string;
};

export function RoomCountView({
  summary,
  jobCards,
  jobCardFilter,
  pagination,
  setJobCardFilter,
}: RoomCountViewProps) {
  const selectedJob = (jobCards || []).find((job: any) => job.id === jobCardFilter);
  const roomTypeRows: RoomTypeCountRow[] = (summary?.roomTypes || []).map((row) => ({
    ...row,
    estimatedRooms: estimateRoomCount(row.roomType, row.assignments),
    id: row.roomType,
  }));
  const totalAssignments = summary?.totalAssignments ?? 0;
  const totalEstimatedRooms = roomTypeRows.reduce((sum, row) => sum + row.estimatedRooms, 0);
  const jobBreakdownRows: JobRoomBreakdownRow[] = jobCardFilter
    ? []
    : (summary?.jobBreakdown || []).map((row) => ({
        ...row,
        estimatedRooms: row.roomTypes.reduce(
          (sum: any, roomType: any) =>
            sum + estimateRoomCount(roomType.roomType, roomType.assignments),
          0
        ),
        roomBreakdown:
          row.roomTypes
            .map((roomType: any) => `${roomType.roomType}: ${roomType.assignments}`)
            .join(", ") || "-",
      }));

  return (
    <Panel subtitle="Filter by Job Card and review rooming counts by room type." title="Room Count">
      <JobCardFilterPanel
        ariaLabel="Filter room count by job card"
        jobCardFilter={jobCardFilter}
        jobCards={jobCards}
        setJobCardFilter={setJobCardFilter}
      >
        <div className="grid grid-cols-2 gap-2 sm:min-w-64">
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2">
            <p className="font-semibold text-brand-muted text-xs">Rooming rows</p>
            <p className="font-heading font-semibold text-brand-dark text-xl tabular-nums">
              {totalAssignments}
            </p>
          </div>
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2">
            <p className="font-semibold text-brand-muted text-xs">Est. rooms</p>
            <p className="font-heading font-semibold text-brand-dark text-xl tabular-nums">
              {totalEstimatedRooms}
            </p>
          </div>
        </div>
      </JobCardFilterPanel>

      {summary && summary.complete ? null : (
        <div
          className="mb-4 rounded-xl border border-brand-border bg-brand-light/50 px-4 py-3 text-brand-muted text-sm"
          role="status"
        >
          Room Count aggregates are preparing. Counts will appear after the bounded reconciliation
          finishes.
        </div>
      )}

      {!jobCardFilter && summary?.breakdownComplete === false ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 text-sm">
          <span>
            {summary.scope === "all-visible"
              ? "Totals cover all records available to your role; the Job Card Breakdown is limited to the bounded loaded set."
              : "Counts and the Job Card Breakdown currently cover the bounded loaded Job Card set available to you."}
          </span>
          {pagination?.canLoadMore ? (
            <button
              className="portal-small-btn"
              disabled={pagination.isLoadingMore}
              onClick={pagination.loadMore}
              type="button"
            >
              {pagination.isLoadingMore ? "Loading…" : "Load more Job Cards"}
            </button>
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
                  render: (row: JobRoomBreakdownRow) => row.roomBreakdown || "-",
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
