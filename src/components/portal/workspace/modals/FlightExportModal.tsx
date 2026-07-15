"use client";

import { useState } from "react";
import { Select } from "@/components/portal/PortalModalForm";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import type { PortalFlightItineraryGroup, PortalJobCardOption } from "../portalViewTypes";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import {
  buildFlightWorkbook,
  downloadWorkbook,
  jobCardSelectOptions,
} from "./spreadsheetModalRuntime";
import { ImportModalShell, ImportSummary } from "./spreadsheetModalShell";

export interface FlightExportModalProps {
  close: () => void;
  itinerary: PortalFlightItineraryGroup[];
  jobCards: PortalJobCardOption[];
  open: boolean;
}

export function FlightExportModal({
  open,
  close,
  jobCards = [],
  itinerary = [],
}: FlightExportModalProps) {
  const [jobCardId, setJobCardId] = useState("");
  const [error, setError] = useState("");

  const selectedJob = jobCards.find((job: any) => job.id === jobCardId) || null;
  const groups = (itinerary || []).filter((group: any) => group.jobCardId === jobCardId);
  const segmentCount = groups.reduce(
    (sum: any, group: any) => sum + (group.segments?.length || 0),
    0
  );

  const reset = () => {
    setJobCardId("");
    setError("");
  };

  const closeAndReset = () => {
    reset();
    close();
  };

  const handleExport = async () => {
    if (!selectedJob || groups.length === 0) {
      return;
    }
    setError("");
    try {
      const workbook = await buildFlightWorkbook(groups, { defaultSheetName: selectedJob.jobCode });
      await downloadWorkbook(workbook, `${selectedJob.jobCode}-flights.xlsx`);
      closeAndReset();
    } catch (err) {
      setError(formatConvexError(err, "Flight export failed."));
    }
  };

  return (
    <ImportModalShell
      close={closeAndReset}
      open={open}
      subtitle="Select a job card to download a flight itinerary spreadsheet compatible with the import template."
      title="Export Flights"
    >
      <div className="space-y-4">
        <Select
          label="Job Card"
          onChange={setJobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={jobCardId}
        />
        <ImportSummary
          isBusy={false}
          totals={[
            ["Groups", jobCardId ? groups.length : "-"],
            ["Segments", jobCardId ? segmentCount : "-"],
            ["Job", selectedJob?.jobCode || "-"],
            ["Client", selectedJob?.clientName || "-"],
            [
              "Sheets",
              jobCardId
                ? new Set(groups.map((group) => group.sourceSheet || selectedJob?.jobCode)).size
                : "-",
            ],
          ]}
        />
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        )}
        {jobCardId && groups.length === 0 && (
          <div className="rounded-lg border border-brand-border bg-brand-light/40 px-4 py-3 text-brand-muted text-sm">
            No flight itinerary found for this job card.
          </div>
        )}
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.slice(0, 8).map((group: any) => (
              <div className="rounded-lg border border-brand-border bg-white" key={group.id}>
                <div className="flex items-center justify-between border-brand-border border-b px-4 py-3">
                  <div className="font-semibold text-citius-blue">{group.name}</div>
                  <div className="text-brand-muted text-xs">
                    {group.segments.length} segment{group.segments.length === 1 ? "" : "s"}
                  </div>
                </div>
                <SelectableDataTable
                  columns={[
                    { id: "date", label: "Date", render: (row) => row.dateLabel },
                    {
                      id: "flight",
                      label: "Flight",
                      render: (row) => `${row.airline} ${row.flightNumber}`,
                    },
                    {
                      id: "depart",
                      label: "Depart",
                      render: (row) => `${row.departTime || "-"} ${row.origin}`,
                    },
                    {
                      id: "arrive",
                      label: "Arrive",
                      render: (row) => `${row.arriveTime || "-"} ${row.destination}`,
                    },
                  ]}
                  compact
                  empty="No segments in this group."
                  rows={group.segments}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
            type="button"
          >
            Cancel
          </button>
          <button
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || groups.length === 0}
            onClick={handleExport}
            type="button"
          >
            Download Spreadsheet
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}
