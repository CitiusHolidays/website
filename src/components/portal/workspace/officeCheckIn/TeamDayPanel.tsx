"use client";

import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { Select } from "@/components/ui/application-select";
import {
  DAY_STATUS_LABELS,
  type DayStatus,
  dayStatusFor,
  formatOfficeTime,
  formatWorkDate,
} from "@/lib/officeCheckIn/presentation";
import { Panel } from "../portalWorkspaceListUi";
import { DayStatusBadge, OutcomeBadge } from "./OfficeCheckInParts";
import type { TeamDay, TeamDayRow } from "./officeCheckInTypes";
import type { TeamRecordDialogKind } from "./TeamRecordDialogs";

type TeamTableRow = TeamDayRow & { dayStatus: DayStatus; id: string };

const SUMMARY_ORDER: DayStatus[] = [
  "checked_in",
  "checked_out",
  "awaiting_review",
  "rejected",
  "not_checked_in",
];

/** "4 checked in · 1 awaiting review · 6 not checked in", counted from the visible rows. */
function summarizeTeamDay(rows: readonly { dayStatus: DayStatus }[]) {
  const counts = new Map<DayStatus, number>();
  for (const row of rows) {
    counts.set(row.dayStatus, (counts.get(row.dayStatus) ?? 0) + 1);
  }
  return SUMMARY_ORDER.flatMap((status) => {
    const count = counts.get(status) ?? 0;
    return count > 0 ? [`${count} ${DAY_STATUS_LABELS[status].toLowerCase()}`] : [];
  }).join(" · ");
}

function RowActions({
  onOpen,
  row,
}: {
  onOpen: (kind: TeamRecordDialogKind, row: TeamDayRow) => void;
  row: TeamTableRow;
}) {
  if (!row.canReview) {
    return <span className="text-brand-muted">—</span>;
  }
  if (!row.checkIn) {
    const addEntry = () => onOpen("manual", row);
    return (
      <button
        aria-label={`Add entry for ${row.name}`}
        className="portal-small-btn"
        onClick={addEntry}
        type="button"
      >
        Add entry
      </button>
    );
  }
  const review = () => onOpen("review", row);
  const correct = () => onOpen("correct", row);
  return (
    <div className="flex gap-2 whitespace-nowrap">
      {row.checkIn.source === "self" ? (
        <button
          aria-label={`Review ${row.name}'s check-in`}
          className="portal-small-btn"
          onClick={review}
          type="button"
        >
          Review
        </button>
      ) : null}
      <button
        aria-label={`Correct times for ${row.name}`}
        className="portal-small-btn"
        onClick={correct}
        type="button"
      >
        Correct times
      </button>
    </div>
  );
}

function CheckCell({ row }: { row: TeamTableRow }) {
  if (!row.checkIn) {
    return <span className="text-brand-muted">—</span>;
  }
  if (row.checkIn.source === "manager_entry") {
    return <span className="whitespace-nowrap text-brand-muted text-xs">Manager entry</span>;
  }
  return <OutcomeBadge outcome={row.checkIn.clockIn.outcome} />;
}

export function TeamDayPanel({
  officeId,
  onOfficeChange,
  onOpenDialog,
  onWorkDateChange,
  team,
  workDate,
}: {
  officeId: string;
  onOfficeChange: (officeId: string) => void;
  onOpenDialog: (kind: TeamRecordDialogKind, row: TeamDayRow) => void;
  onWorkDateChange: (workDate: string) => void;
  team: TeamDay | undefined;
  workDate: string;
}) {
  const rows: TeamTableRow[] = (team?.rows ?? []).map((row) => ({
    ...row,
    dayStatus: dayStatusFor(row.checkIn),
    id: row.staffId,
  }));
  const summary = summarizeTeamDay(rows);
  const officeOptions = [
    { label: "All offices", value: "" },
    ...(team?.offices ?? []).map((office) => ({ label: office.name, value: office.id })),
  ];
  const handleDateChange = (value: string) => onWorkDateChange(value);
  const time = (row: TeamTableRow, timestamp: number | undefined) =>
    formatOfficeTime(timestamp, row.timeZone);

  return (
    <Panel
      subtitle="People you oversee, with each check-in's result. A result is evidence for review, not proof of presence."
      title="Today in the office"
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid w-44 gap-1 text-brand-dark text-sm">
          <label className="font-medium" htmlFor="office-check-in-team-date">
            Date
          </label>
          <PortalDateInput
            aria-label="Date"
            id="office-check-in-team-date"
            name="workDate"
            onChange={handleDateChange}
            value={workDate}
          />
        </div>
        <div className="grid min-w-48 gap-1 text-brand-dark text-sm">
          <label className="font-medium" htmlFor="office-check-in-team-office">
            Office
          </label>
          <Select
            aria-label="Office"
            className="portal-input"
            id="office-check-in-team-office"
            onValueChange={onOfficeChange}
            options={officeOptions}
            value={officeId}
          />
        </div>
        <p className="pb-3 text-brand-muted text-xs tabular-nums" role="status">
          {team ? `${formatWorkDate(team.workDate)}: ${summary || "no one to show"}` : "Loading…"}
        </p>
      </div>
      {team?.truncated ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
          This list is incomplete because there are more records than one view can load. Filter by
          office to see everyone.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
        <SelectableDataTable<TeamTableRow>
          columns={[
            {
              id: "name",
              kind: "identity",
              label: "Name",
              render: (row) => (
                <div className="min-w-0">
                  <div className="font-semibold text-brand-dark">{row.name}</div>
                  {row.department ? (
                    <div className="text-brand-muted text-xs">{row.department}</div>
                  ) : null}
                </div>
              ),
              sortValue: (row) => row.name,
            },
            {
              id: "office",
              label: "Office",
              render: (row) => row.officeName ?? <span className="text-brand-muted">—</span>,
              sortValue: (row) => row.officeName ?? "",
            },
            {
              id: "status",
              kind: "status",
              label: "Status",
              render: (row) => <DayStatusBadge status={row.dayStatus} />,
              sortValue: (row) => DAY_STATUS_LABELS[row.dayStatus],
            },
            {
              id: "check",
              label: "Check",
              render: (row) => <CheckCell row={row} />,
              sortValue: (row) => row.checkIn?.clockIn.outcome ?? "",
            },
            {
              align: "right",
              id: "clock-in",
              label: "In",
              render: (row) => (
                <span className="tabular-nums">{time(row, row.checkIn?.clockInAt)}</span>
              ),
              sortValue: (row) => row.checkIn?.clockInAt ?? 0,
            },
            {
              align: "right",
              id: "clock-out",
              label: "Out",
              render: (row) => (
                <span className="tabular-nums">{time(row, row.checkIn?.clockOutAt)}</span>
              ),
              sortValue: (row) => row.checkIn?.clockOutAt ?? 0,
            },
            {
              id: "actions",
              kind: "action",
              label: "Actions",
              render: (row) => <RowActions onOpen={onOpenDialog} row={row} />,
            },
          ]}
          empty={team ? "No one you oversee matches this date and office." : "Loading check-ins…"}
          entityLabel="people"
          rowLabel={(row) => row.name}
          rows={rows}
          selectable={false}
        />
      </div>
    </Panel>
  );
}
