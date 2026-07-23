"use client";

import { PortalCopyButton } from "@/components/motion-ui/copy-button";
import { formatDate } from "@/components/portal/PortalModalForm";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { getJobCardAttention } from "@/lib/portal/jobCardListPresentation";
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

export function JobCardsView({
  rows,
  updateJobStatus,
  openModal,
  has,
  access,
  deleteItem,
  removeJobCard,
  jobCardDeletionOperations,
}: JobCardsViewProps) {
  const showAssignContracting = canAssignContracting(access) || canAssignOperations(access);
  const showAssignOps = canAssignOperations(access);
  const showAssignTicketing = canAssignTicketing(access);
  const canManage = has(P.MANAGE_JOB_CARDS);
  const canManageTravelBatches = canManage || has(P.MANAGE_OPERATIONS);

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
                  <PortalCopyButton aria-label={`Copy job card ${row.jobCode}`} value={row.jobCode} />
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
              <span
                className="text-brand-muted text-xs"
                title={`Contracting: ${row.contractingOwnerName || "Unassigned"} · Ops: ${row.operationsOwnerName || "Unassigned"} · Ticketing: ${row.ticketingOwnerName || "Unassigned"}`}
              >
                {row.contractingOwnerName || row.operationsOwnerName || row.ticketingOwnerName
                  ? [row.contractingOwnerName, row.operationsOwnerName, row.ticketingOwnerName]
                      .filter(Boolean)
                      .slice(0, 2)
                      .join(" · ")
                  : "Unassigned"}
              </span>
            ),
          },
          {
            hideable: true,
            id: "travel-batches",
            label: "Travel Batches",
            render: (row: JobCardRow) => (
              <JobCardTravelBatchesCell
                canManage={canManageTravelBatches}
                job={row as PortalJobCardListRow}
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
                job={row as PortalJobCardListRow}
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
        mobileCardRender={(job: PortalJobCardListRow) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-brand-dark">{job.jobCode}</div>
                <div className="text-brand-muted text-sm">{job.clientName}</div>
              </div>
              <StatusBadge domain="jobCard" status={job.status} />
            </div>
            <div className="text-brand-muted text-xs">
              {job.destination || "Destination pending"} · Opened {formatDate(job.createdAt)}
            </div>
            <JobCardTravelBatchesCell
              canManage={canManageTravelBatches}
              job={job}
              openModal={openModal}
            />
          </div>
        )}
        rowAttention={(row: JobCardRow) =>
          getJobCardAttention(row as Parameters<typeof getJobCardAttention>[0])
        }
        rows={rows}
      />
    </>
  );
}
