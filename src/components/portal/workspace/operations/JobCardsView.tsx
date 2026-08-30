"use client";

import { useEffect } from "react";
import { PortalCopyButton } from "@/components/motion-ui/copy-button";
import { formatDate } from "@/components/portal/PortalModalForm";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { getJobCardAttention } from "@/lib/portal/jobCardListPresentation";
import { markPortalNavigationFirstContent } from "@/lib/portal/navigationPerformance";
import {
  canAssignContracting,
  canAssignOperations,
  canAssignTicketing,
} from "@/lib/portal/permissions";
import type { JobCardsViewProps, PortalJobCardListRow } from "../portalViewTypes";

type JobCardRow = JobCardsViewProps["rows"][number];

import { strong } from "../portalWorkspaceListHelpers";
import { StatusBadge } from "../portalWorkspaceListUi";
import { JobCardDeletionStatusRegion } from "./JobCardDeletionStatusRegion";
import { JobCardRowActions } from "./JobCardRowActions";
import { JobCardTravelBatchesCell } from "./JobCardTravelBatchesCell";

function JobCardMobileCard({
  canManageTravelBatches,
  job,
  openModal,
  visibleColumnIds,
}: {
  canManageTravelBatches: boolean;
  job: PortalJobCardListRow;
  openModal: JobCardsViewProps["openModal"];
  visibleColumnIds: ReadonlySet<string>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-brand-dark">{job.jobCode}</div>
          <div className="text-brand-muted text-sm">{job.clientName}</div>
        </div>
        <StatusBadge domain="jobCard" status={job.status} />
      </div>
      <div className="text-brand-muted text-xs">
        {visibleColumnIds.has("destination")
          ? `${job.destination || "Destination pending"} · `
          : ""}
        Opened {formatDate(job.createdAt)}
      </div>
      {visibleColumnIds.has("owners") ? (
        <div className="rounded-lg bg-brand-light px-3 py-2 text-brand-muted text-xs">
          <span className="font-medium text-brand-dark">Owners</span>
          <div>Contracting: {job.contractingOwnerName || "Unassigned"}</div>
          <div>Operations: {job.operationsOwnerName || "Unassigned"}</div>
          <div>Ticketing: {job.ticketingOwnerName || "Unassigned"}</div>
        </div>
      ) : null}
      {visibleColumnIds.has("travel-batches") ? (
        <JobCardTravelBatchesCell
          canManage={canManageTravelBatches}
          job={job}
          openModal={openModal}
        />
      ) : null}
      {visibleColumnIds.has("last-edit") ? (
        <div className="text-brand-muted text-xs">
          Last edit:{" "}
          {job.lastEditedByName
            ? `${job.lastEditedByName} · ${formatDate(job.lastEditedAt)}`
            : "Not edited"}
        </div>
      ) : null}
    </div>
  );
}

export function JobCardsView({
  rows,
  updateJobStatus,
  openModal,
  has,
  access,
  deleteItem,
  removeJobCard,
  jobCardDeletionOperations,
  loading = false,
}: JobCardsViewProps) {
  useEffect(() => {
    if (!loading) {
      markPortalNavigationFirstContent("job-cards", rows.length > 0 ? "row" : "empty");
    }
  }, [loading, rows]);

  const showAssignContracting = canAssignContracting(access) || canAssignOperations(access);
  const showAssignOps = canAssignOperations(access);
  const showAssignTicketing = canAssignTicketing(access);
  const canManage = has(P.MANAGE_JOB_CARDS);
  const canManageTravelBatches = canManage || has(P.MANAGE_OPERATIONS);
  const renderMobileCard = (job: PortalJobCardListRow, visibleColumnIds: ReadonlySet<string>) => (
    <JobCardMobileCard
      canManageTravelBatches={canManageTravelBatches}
      job={job}
      openModal={openModal}
      visibleColumnIds={visibleColumnIds}
    />
  );

  return (
    <>
      <JobCardDeletionStatusRegion operations={jobCardDeletionOperations} />
      <SelectableDataTable
        columns={[
          {
            id: "job",
            kind: "identity",
            label: "Job code",
            render: (row: JobCardRow) => (
              <div className="flex items-center gap-2">
                {strong(row.jobCode)}
                {row.jobCode ? (
                  <PortalCopyButton
                    aria-label={`Copy job card ${row.jobCode}`}
                    value={row.jobCode}
                  />
                ) : null}
              </div>
            ),
            sortValue: (row: JobCardRow) => row.jobCode,
          },
          {
            id: "client",
            label: "Client",
            render: (row: JobCardRow) => row.clientName,
            sortValue: (row: JobCardRow) => row.clientName,
          },
          {
            hideable: true,
            id: "destination",
            label: "Destination",
            render: (row: JobCardRow) => row.destination || "-",
            sortValue: (row: JobCardRow) => row.destination || "",
          },
          {
            id: "status",
            kind: "status",
            label: "Status",
            render: (row: JobCardRow) => <StatusBadge domain="jobCard" status={row.status} />,
            sortValue: (row: JobCardRow) => row.status || "",
          },
          {
            hideable: true,
            id: "owners",
            label: "Owners",
            render: (row: JobCardRow) => (
              <PortalTooltip
                content={`Contracting: ${row.contractingOwnerName || "Unassigned"} · Ops: ${row.operationsOwnerName || "Unassigned"} · Ticketing: ${row.ticketingOwnerName || "Unassigned"}`}
              >
                <span className="text-brand-muted text-xs">
                  {row.contractingOwnerName || row.operationsOwnerName || row.ticketingOwnerName
                    ? [row.contractingOwnerName, row.operationsOwnerName, row.ticketingOwnerName]
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(" · ")
                    : "Unassigned"}
                </span>
              </PortalTooltip>
            ),
          },
          {
            hideable: true,
            id: "travel-batches",
            label: "Travel in Series",
            render: (row: JobCardRow) => (
              <JobCardTravelBatchesCell
                canManage={canManageTravelBatches}
                job={row}
                openModal={openModal}
              />
            ),
          },
          {
            id: "opened",
            label: "Opened",
            render: (row: JobCardRow) => (
              <span className="text-brand-muted text-xs">{formatDate(row.createdAt)}</span>
            ),
            sortValue: (row: JobCardRow) => row.createdAt,
          },
          {
            hideable: true,
            id: "last-edit",
            label: "Last Edit",
            render: (row: JobCardRow) =>
              row.lastEditedByName
                ? `${row.lastEditedByName} · ${formatDate(row.lastEditedAt)}`
                : "-",
            sortValue: (row: JobCardRow) => row.lastEditedAt,
          },
          {
            id: "actions",
            kind: "action",
            label: "Actions",
            render: (row: JobCardRow) => (
              <JobCardRowActions
                deleteItem={deleteItem}
                job={row}
                openModal={openModal}
                removeJobCard={removeJobCard}
                updateJobStatus={updateJobStatus}
                visibility={{
                  assignContracting: showAssignContracting,
                  assignOps: showAssignOps,
                  assignTicketing: showAssignTicketing,
                  canManage,
                  canManageTravelBatches,
                }}
              />
            ),
          },
        ]}
        compact
        empty="No Job Cards yet."
        layoutKey="job-cards:list"
        mobileCardRender={renderMobileCard}
        rowAttention={getJobCardAttention}
        rows={rows}
      />
    </>
  );
}
