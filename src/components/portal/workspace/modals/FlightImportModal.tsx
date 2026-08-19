"use client";

import type { Id } from "@convex/_generated/dataModel";
import { useCallback } from "react";
import { Select } from "@/components/portal/PortalModalForm";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { Button } from "@/components/ui/application-button";
import { formatCount } from "@/lib/countMessage";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import type { PortalFlightItineraryGroup, PortalJobCardOption } from "../portalViewTypes";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { Badge } from "../portalWorkspaceListUi";
import {
  FLIGHT_IMPORT_INITIAL,
  type FlightImportGroup,
  jobCardSelectOptions,
  parseFlightWorkbookFile,
} from "./spreadsheetModalRuntime";
import {
  ImportFileInput,
  ImportIssueList,
  ImportModalShell,
  ImportSummary,
} from "./spreadsheetModalShell";

const EMPTY_FLIGHT_IMPORT_GROUPS: FlightImportGroup[] = [];

export interface FlightImportModalProps {
  close: () => void;
  commitFlightImport: (args: {
    groups: FlightImportGroup[];
    jobCardId: Id<"jobCards">;
  }) => Promise<{ createdSegments: number; updatedSegments: number }>;
  itinerary: PortalFlightItineraryGroup[];
  jobCards: PortalJobCardOption[];
  open: boolean;
}

export function FlightImportModal({
  open,
  close,
  jobCards = [],
  itinerary = [],
  commitFlightImport,
}: FlightImportModalProps) {
  const toast = usePortalToast();
  const [flightState, patchFlightState] = usePatchReducer(FLIGHT_IMPORT_INITIAL);
  const { jobCardId, fileName, parsed, isParsing, isSaving, error } = flightState;
  const setJobCardId = useCallback(
    (value: any) => patchFlightState({ jobCardId: value }),
    [patchFlightState]
  );

  const groups = parsed?.groups || EMPTY_FLIGHT_IMPORT_GROUPS;
  const errors = parsed?.errors || [];
  const existingSegmentKeys = new Set(
    itinerary.reduce((keys: any, group: any) => {
      if (jobCardId && group.jobCardId !== jobCardId) {
        return keys;
      }
      for (const segment of group.segments || []) {
        if (segment.importKey) {
          keys.push(segment.importKey);
        }
      }
      return keys;
    }, [])
  );
  const segmentCount = groups.reduce((sum: any, group: any) => sum + group.segments.length, 0);
  const updateCount = groups.reduce(
    (sum: any, group: any) =>
      sum +
      group.segments.filter((segment: any) => existingSegmentKeys.has(segment.importKey)).length,
    0
  );

  const reset = useCallback(() => patchFlightState(FLIGHT_IMPORT_INITIAL), [patchFlightState]);

  const closeAndReset = useCallback(() => {
    reset();
    close();
  }, [close, reset]);

  const handleFile = useCallback(
    async (event: any) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      patchFlightState({ error: "", fileName: file.name, isParsing: true, parsed: null });
      try {
        patchFlightState({ parsed: await parseFlightWorkbookFile(file) });
      } catch (err) {
        patchFlightState({
          error: formatConvexError(err, "Unable to read flight spreadsheet."),
        });
      }
      patchFlightState({ isParsing: false });
      event.target.value = "";
    },
    [patchFlightState]
  );

  const handleCommit = useCallback(async () => {
    if (!jobCardId || groups.length === 0) {
      return;
    }
    patchFlightState({ error: "", isSaving: true });
    try {
      const result = await commitFlightImport({
        groups,
        // SAFETY: jobCardId is selected from the validated Job Card options supplied to this modal.
        jobCardId: jobCardId as Id<"jobCards">,
      });
      toast.success(
        `Flight import complete. Created ${formatCount(result.createdSegments, "segment")}; updated ${formatCount(result.updatedSegments, "segment")}.`
      );
      closeAndReset();
    } catch (err) {
      patchFlightState({ error: formatConvexError(err, "Flight import failed.") });
    }
    patchFlightState({ isSaving: false });
  }, [closeAndReset, commitFlightImport, groups, jobCardId, patchFlightState, toast]);

  return (
    <ImportModalShell close={closeAndReset} open={open} title="Import Flights">
      <div className="space-y-4">
        <Select
          label="Job Card"
          onChange={setJobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={jobCardId}
        />
        <ImportFileInput
          accept=".xlsx,.xls"
          fileName={fileName}
          label="Flight spreadsheet"
          onChange={handleFile}
        />
        <ImportSummary
          isBusy={isParsing}
          totals={[
            ["Groups", groups.length],
            ["Segments", segmentCount],
            ["Create", segmentCount - updateCount],
            ["Update", updateCount],
            ["Errors", errors.length],
          ]}
        />
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        ) : null}
        {errors.length > 0 && <ImportIssueList rows={errors} title="Rows needing correction" />}
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.slice(0, 8).map((group: any) => (
              <div className="rounded-lg border border-brand-border bg-white" key={group.id}>
                <div className="flex items-center justify-between border-brand-border border-b px-4 py-3">
                  <div className="font-semibold text-citius-blue">
                    {group.name}
                    {group.travelBatchReference ? (
                      <span className="ml-2 font-normal text-brand-muted">
                        · {group.travelBatchReference}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-brand-muted text-xs">
                    {group.segments.length} segment{group.segments.length === 1 ? "" : "s"}
                  </div>
                </div>
                <SelectableDataTable<FlightImportGroup["segments"][number] & { action: string }>
                  columns={[
                    {
                      id: "action",
                      label: "Action",
                      render: (row) => (
                        <Badge
                          label={row.action}
                          tone={row.action === "update" ? "blue" : "green"}
                        />
                      ),
                    },
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
                    {
                      id: "transit",
                      label: "Transit",
                      render: (row) => row.transit || "-",
                    },
                  ]}
                  compact
                  empty="No segments in this group."
                  rows={group.segments.map((segment: any) => ({
                    ...segment,
                    action: existingSegmentKeys.has(segment.importKey) ? "update" : "create",
                  }))}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button
            className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
            type="button"
          >
            Cancel
          </Button>
          <Button
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || groups.length === 0 || isSaving}
            onClick={handleCommit}
            type="button"
          >
            {isSaving ? "Uploading…" : "Upload Flights"}
          </Button>
        </div>
      </div>
    </ImportModalShell>
  );
}
