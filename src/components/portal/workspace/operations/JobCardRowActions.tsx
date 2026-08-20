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
  const showFiles = () => {
    openModal("commercialFiles", { entityId: String(job.id), entryPoint: "jobCard" });
  };
  const assignContractingOwner = () => {
    openModal("assignContractingOwner", { jobCardId: String(job.id) });
  };
  const assignOperationsOwner = () => {
    openModal("assignOperationsOwner", { jobCardId: String(job.id) });
  };
  const assignTicketingOwner = () => {
    openModal("assignTicketingOwner", { jobCardId: String(job.id) });
  };
  const addTravelBatch = () => {
    openModal(
      TRAVEL_BATCH_MODAL,
      buildTravelBatchModalInitial({ job: { ...job, id: String(job.id) } })
    );
  };
  const edit = () => {
    openModal("jobCard", { entityId: String(job.id), focusedDetailType: "jobCard" });
  };
  const share = () => {
    openModal("addJobCardCollaborator", { jobCardId: String(job.id) });
  };
  const unshare = () => {
    openModal("removeJobCardCollaborator", { jobCardId: String(job.id) });
  };
  const advance = () => {
    updateJobStatus({
      jobCardId: String(job.id),
      status: job.status === "Open" ? "In Operations" : "Ready for Departure",
    });
  };
  const remove = () => {
    deleteItem(
      job.jobCode,
      removeJobCard,
      { jobCardId: String(job.id) },
      {
        confirmMessage: `Delete ${job.jobCode}? This will also delete linked travellers, passport records, visa records, flight groups and segments, PNRs, tickets, seats, hotels, rooming entries, tour manager assignments, vendors, itineraries, event flows, checklist tasks, invoices, additional services, expenses, proof attachments, approvals, and notifications. This cannot be undone.`,
      }
    );
  };
  const overflowActions = [
    <Button
      className="portal-small-btn w-full"
      key="commercial-files"
      onClick={showFiles}
      type="button"
    >
      Files
    </Button>,
    assignContracting ? (
      <Button
        className="portal-small-btn w-full"
        key="assign-contracting"
        onClick={assignContractingOwner}
        type="button"
      >
        Assign Contracting
      </Button>
    ) : null,
    assignOps ? (
      <Button
        className="portal-small-btn w-full"
        key="assign-ops"
        onClick={assignOperationsOwner}
        type="button"
      >
        Assign Ops
      </Button>
    ) : null,
    assignTicketing ? (
      <Button
        className="portal-small-btn w-full"
        key="assign-ticketing"
        onClick={assignTicketingOwner}
        type="button"
      >
        Assign Ticketing
      </Button>
    ) : null,
    canManageTravelBatches ? (
      <Button
        className="portal-small-btn w-full"
        key="add-batch"
        onClick={addTravelBatch}
        type="button"
      >
        Add Travel Batch
      </Button>
    ) : null,
    canManage ? <EditButton key="edit" onClick={edit} /> : null,
    canManage ? (
      <Button className="portal-small-btn w-full" key="share" onClick={share} type="button">
        Share
      </Button>
    ) : null,
    canManage && job.hasCollaborators ? (
      <Button className="portal-small-btn w-full" key="unshare" onClick={unshare} type="button">
        Unshare
      </Button>
    ) : null,
    canManage ? (
      <Button className="portal-small-btn w-full" key="advance" onClick={advance} type="button">
        Advance Status
      </Button>
    ) : null,
    canManage ? <DeleteButton key="delete" label={job.jobCode} onClick={remove} /> : null,
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
