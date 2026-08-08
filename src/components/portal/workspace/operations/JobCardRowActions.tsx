"use client";

import Link from "next/link";
import { QueryRowActions } from "@/components/portal/QueryRowActions";
import { Button } from "@/components/ui/application-button";
import { buildTravelBatchModalInitial, TRAVEL_BATCH_MODAL } from "@/lib/portal/workspaceContract";
import type {
  JobCardsViewProps,
  PortalDeleteHandler,
  PortalJobCardListRow,
  PortalModalOpener,
} from "../portalViewTypes";
import { DeleteButton, EditButton } from "../portalWorkspaceListUi";

export function JobCardRowActions({
  job,
  openModal,
  visibility,
  updateJobStatus,
  deleteItem,
  removeJobCard,
}: {
  deleteItem: PortalDeleteHandler;
  job: PortalJobCardListRow;
  openModal: PortalModalOpener;
  removeJobCard: JobCardsViewProps["removeJobCard"];
  updateJobStatus: JobCardsViewProps["updateJobStatus"];
  visibility: {
    assignContracting: boolean;
    assignOps: boolean;
    assignTicketing: boolean;
    canManage: boolean;
    canManageTravelBatches: boolean;
  };
}) {
  const { canManage, canManageTravelBatches, assignContracting, assignOps, assignTicketing } =
    visibility;
  const overflowActions = [
    <Button
      className="portal-small-btn w-full"
      key="commercial-files"
      onClick={() =>
        openModal("commercialFiles", { entityId: String(job.id), entryPoint: "jobCard" })
      }
      type="button"
    >
      Files
    </Button>,
    assignContracting ? (
      <Button
        className="portal-small-btn w-full"
        key="assign-contracting"
        onClick={() => openModal("assignContractingOwner", { jobCardId: job.id })}
        type="button"
      >
        Assign Contracting
      </Button>
    ) : null,
    assignOps ? (
      <Button
        className="portal-small-btn w-full"
        key="assign-ops"
        onClick={() => openModal("assignOperationsOwner", { jobCardId: job.id })}
        type="button"
      >
        Assign Ops
      </Button>
    ) : null,
    assignTicketing ? (
      <Button
        className="portal-small-btn w-full"
        key="assign-ticketing"
        onClick={() => openModal("assignTicketingOwner", { jobCardId: job.id })}
        type="button"
      >
        Assign Ticketing
      </Button>
    ) : null,
    canManageTravelBatches ? (
      <Button
        className="portal-small-btn w-full"
        key="add-batch"
        onClick={() =>
          openModal(
            TRAVEL_BATCH_MODAL,
            buildTravelBatchModalInitial({ job: { ...job, id: String(job.id) } })
          )
        }
        type="button"
      >
        Add Travel Batch
      </Button>
    ) : null,
    canManage ? (
      <EditButton
        key="edit"
        onClick={() =>
          openModal("jobCard", {
            entityId: job.id,
            focusedDetailType: "jobCard",
          })
        }
      />
    ) : null,
    canManage ? (
      <Button
        className="portal-small-btn w-full"
        key="share"
        onClick={() => openModal("addJobCardCollaborator", { jobCardId: job.id })}
        type="button"
      >
        Share
      </Button>
    ) : null,
    canManage && job.hasCollaborators ? (
      <Button
        className="portal-small-btn w-full"
        key="unshare"
        onClick={() => openModal("removeJobCardCollaborator", { jobCardId: job.id })}
        type="button"
      >
        Unshare
      </Button>
    ) : null,
    canManage ? (
      <Button
        className="portal-small-btn w-full"
        key="advance"
        onClick={() =>
          updateJobStatus({
            jobCardId: String(job.id),
            status: job.status === "Open" ? "In Operations" : "Ready for Departure",
          })
        }
        type="button"
      >
        Advance Status
      </Button>
    ) : null,
    canManage ? (
      <DeleteButton
        key="delete"
        label={job.jobCode}
        onClick={() =>
          deleteItem(
            job.jobCode,
            removeJobCard,
            { jobCardId: String(job.id) },
            {
              confirmMessage: `Delete ${job.jobCode}? This will also delete linked travellers, passport records, visa records, flight groups and segments, PNRs, tickets, seats, hotels, rooming entries, tour manager assignments, vendors, itineraries, event flows, checklist tasks, invoices, additional services, expenses, proof attachments, approvals, and notifications. This cannot be undone.`,
            }
          )
        }
      />
    ) : null,
  ].filter(Boolean);

  return (
    <QueryRowActions
      label={job.jobCode}
      overflowActions={overflowActions}
      primaryAction={
        <Link className="portal-small-btn" href={`/portal/job-cards/${String(job.id)}`}>
          Open
        </Link>
      }
    />
  );
}
