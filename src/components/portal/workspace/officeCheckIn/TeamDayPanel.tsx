"use client";

import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { Select } from "@/components/ui/application-select";
import { formatDaySpan, formatWorkDate, teamStatusFor } from "@/lib/officeCheckIn/presentation";
import { Panel } from "../portalWorkspaceListUi";
import { ToneBadge } from "./OfficeCheckInParts";
import type { TeamDay, TeamDayRow } from "./officeCheckInTypes";

type Presence = "awaiting" | "in" | "not_in" | "out" | "rejected";

const PRESENCE_WORDS: [Presence, string][] = [
  ["in", "in"],
  ["out", "out"],
  ["awaiting", "awaiting review"],
  ["rejected", "rejected"],
  ["not_in", "not in"],
];

function presenceOf(row: TeamDayRow): Presence {
  const record = row.checkIn;
  if (!record) {
    return "not_in";
  }
  if (record.admission === "pending_review") {
    return "awaiting";
  }
  if (record.admission === "rejected") {
    return "rejected";
  }
  return record.status === "open" ? "in" : "out";
}

/** "3 in · 2 out · 1 awaiting review · 2 not in", counted from the rows on screen. */
function summarize(rows: readonly TeamDayRow[]) {
  const counts = new Map<Presence, number>();
  for (const row of rows) {
    const presence = presenceOf(row);
    counts.set(presence, (counts.get(presence) ?? 0) + 1);
  }
  return PRESENCE_WORDS.flatMap(([presence, words]) => {
    const count = counts.get(presence) ?? 0;
    return count > 0 ? [`${count} ${words}`] : [];
  });
}

/** Each count stays on one line, so a wrap never strands "in" from its number. */
function SummaryText({ parts }: { parts: readonly string[] }) {
  if (parts.length === 0) {
    return "No one to show";
  }
  return parts.map((part, index) => (
    <span className="whitespace-nowrap" key={part}>
      {index > 0 ? " · " : ""}
      {part}
    </span>
  ));
}

/** First in → last out across the day's sessions, plus "2 sessions" when there are more than one. */
function Times({ row }: { row: TeamDayRow }) {
  const count = row.sessions.length;
  return (
    <>
      {formatDaySpan(row.sessions, row.timeZone)}
      {count > 1 ? (
        <span className="ms-2 whitespace-nowrap text-brand-muted text-xs">{count} sessions</span>
      ) : null}
    </>
  );
}

function OpenButton({ onOpen, row }: { onOpen: (row: TeamDayRow) => void; row: TeamDayRow }) {
  // Nothing to show or do for someone with no record you can't add to.
  if (!(row.checkIn || row.canReview)) {
    return <span className="text-brand-muted">—</span>;
  }
  const open = () => onOpen(row);
  return (
    <button
      aria-label={`Open ${row.name}`}
      className="portal-small-btn"
      onClick={open}
      type="button"
    >
      Open
    </button>
  );
}

function NameCell({ row, showOffice }: { row: TeamDayRow; showOffice: boolean }) {
  return (
    <div className="min-w-0">
      <div className="break-words font-semibold text-brand-dark text-sm">{row.name}</div>
      {showOffice && row.officeName ? (
        <div className="mt-0.5 truncate text-brand-muted text-xs">{row.officeName}</div>
      ) : null}
    </div>
  );
}

function TeamTable({
  onOpen,
  rows,
  showOffice,
}: {
  onOpen: (row: TeamDayRow) => void;
  rows: readonly TeamDayRow[];
  showOffice: boolean;
}) {
  return (
    <>
      <table className="hidden w-full table-fixed border-collapse text-sm sm:table">
        <thead>
          <tr className="border-brand-border border-b text-brand-muted text-xs">
            <th className="w-[42%] py-2 pe-4 text-start font-normal" scope="col">
              Name
            </th>
            <th className="py-2 pe-4 text-start font-normal" scope="col">
              Status
            </th>
            <th className="py-2 pe-4 text-end font-normal" scope="col">
              In → out
            </th>
            <th className="w-24 py-2 text-end font-normal" scope="col">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border/60">
          {rows.map((row) => {
            const status = teamStatusFor(row.checkIn);
            return (
              <tr key={row.staffId}>
                <td className="py-2.5 pe-4 align-middle">
                  <NameCell row={row} showOffice={showOffice} />
                </td>
                <td className="py-2.5 pe-4 align-middle">
                  <ToneBadge label={status.label} tone={status.tone} />
                </td>
                <td className="whitespace-nowrap py-2.5 pe-4 text-end align-middle text-brand-dark tabular-nums">
                  <Times row={row} />
                </td>
                <td className="py-2.5 text-end align-middle">
                  <OpenButton onOpen={onOpen} row={row} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="divide-y divide-brand-border/60 border-brand-border/60 border-y sm:hidden">
        {rows.map((row) => {
          const status = teamStatusFor(row.checkIn);
          return (
            <li className="flex items-center gap-3 py-3" key={row.staffId}>
              <div className="grid min-w-0 flex-1 gap-1.5">
                <NameCell row={row} showOffice={showOffice} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <ToneBadge label={status.label} tone={status.tone} />
                  <span className="text-brand-muted text-xs tabular-nums">
                    <Times row={row} />
                  </span>
                </div>
              </div>
              <OpenButton onOpen={onOpen} row={row} />
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function TeamDayPanel({
  officeId,
  onOfficeChange,
  onOpen,
  onWorkDateChange,
  team,
  today,
  workDate,
}: {
  officeId: string;
  onOfficeChange: (officeId: string) => void;
  onOpen: (row: TeamDayRow) => void;
  onWorkDateChange: (workDate: string) => void;
  team: TeamDay | undefined;
  today: string;
  workDate: string;
}) {
  const rows = team?.rows ?? [];
  const offices = team?.offices ?? [];
  // A chosen office stays visible so it can be cleared, even if the filtered
  // result only names that one office.
  const showOfficeFilter = offices.length > 1 || Boolean(officeId);
  const showOffice = new Set(rows.map((row) => row.officeId)).size > 1;
  const officeOptions = [
    { label: "All offices", value: "" },
    ...offices.map((office) => ({ label: office.name, value: office.id })),
  ];
  const title = workDate === today ? "Team today" : `Team on ${formatWorkDate(workDate)}`;
  const summary = summarize(rows);

  return (
    <Panel title={title}>
      <div className="mb-3 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
        <div className="grid min-w-0 gap-1 text-brand-dark text-sm sm:w-44">
          <label className="font-medium" htmlFor="office-check-in-team-date">
            Date
          </label>
          <PortalDateInput
            aria-label="Date"
            id="office-check-in-team-date"
            name="workDate"
            onChange={onWorkDateChange}
            value={workDate}
          />
        </div>
        {showOfficeFilter ? (
          <div className="grid min-w-0 gap-1 text-brand-dark text-sm sm:min-w-48">
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
        ) : null}
        <p className="col-span-2 text-brand-muted text-sm tabular-nums sm:pb-3" role="status">
          {team ? <SummaryText parts={summary} /> : "Loading…"}
        </p>
      </div>
      {team?.truncated ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
          This list is incomplete because there are more records than one view can load. Choose an
          office to see everyone.
        </p>
      ) : null}
      {team && rows.length === 0 ? (
        <p className="rounded-xl border border-brand-border border-dashed px-3 py-3 text-brand-muted text-sm">
          No one you oversee matches this date{officeId ? " and office" : ""}.
        </p>
      ) : (
        <TeamTable onOpen={onOpen} rows={rows} showOffice={showOffice} />
      )}
      <p className="mt-3 text-brand-muted text-xs">
        A check result is evidence for review, not proof of where someone was.
      </p>
    </Panel>
  );
}
