"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buildTravelBatchModalInitial, TRAVEL_BATCH_MODAL } from "@/lib/portal/workspaceContract";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import type {
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
  removeJobCard: (args: { jobCardId?: string }) => Promise<unknown>;
  updateJobStatus: (args: { jobCardId: string; status: string }) => Promise<unknown>;
  visibility: {
    assignContracting: boolean;
    assignOps: boolean;
    assignTicketing: boolean;
    canManage: boolean;
    canManageTravelBatches: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const { canManage, canManageTravelBatches, assignContracting, assignOps, assignTicketing } =
    visibility;
  const overflowActions = [
    assignContracting ? (
      <button
        className="portal-small-btn w-full"
        key="assign-contracting"
        onClick={() => openModal("assignContractingOwner", { jobCardId: job.id })}
        type="button"
      >
        Assign Contracting
      </button>
    ) : null,
    assignOps ? (
      <button
        className="portal-small-btn w-full"
        key="assign-ops"
        onClick={() => openModal("assignOperationsOwner", { jobCardId: job.id })}
        type="button"
      >
        Assign Ops
      </button>
    ) : null,
    assignTicketing ? (
      <button
        className="portal-small-btn w-full"
        key="assign-ticketing"
        onClick={() => openModal("assignTicketingOwner", { jobCardId: job.id })}
        type="button"
      >
        Assign Ticketing
      </button>
    ) : null,
    canManageTravelBatches ? (
      <button
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
      </button>
    ) : null,
    canManage ? (
      <EditButton
        key="edit"
        onClick={() =>
          openModal("jobCard", {
            clientName: job.clientName,
            confirmedPax: String(job.confirmedPax),
            destination: job.destination,
            entityId: job.id,
            proposalId: job.proposalId || "",
            queryId: job.queryId || "",
            roomCount: String(job.roomCount || ""),
            tourManagerName: job.tourManagerName,
            travelEndDate: job.travelEndDate,
            travelStartDate: job.travelStartDate,
          })
        }
      />
    ) : null,
    canManage ? (
      <button
        className="portal-small-btn w-full"
        key="share"
        onClick={() => openModal("addJobCardCollaborator", { jobCardId: job.id })}
        type="button"
      >
        Share
      </button>
    ) : null,
    canManage && (job.collaboratorStaffIds ?? []).length > 0 ? (
      <button
        className="portal-small-btn w-full"
        key="unshare"
        onClick={() => openModal("removeJobCardCollaborator", { jobCardId: job.id })}
        type="button"
      >
        Unshare
      </button>
    ) : null,
    canManage ? (
      <button
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
      </button>
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
    <div className="flex items-center gap-2">
      <Link className="portal-small-btn" href={`/portal/job-cards/${String(job.id)}`}>
        Open
      </Link>
      {overflowActions.length > 0 ? (
        <div className="relative">
          <button
            aria-expanded={open}
            aria-label="More job card actions"
            className="portal-small-btn inline-flex items-center gap-1"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <MoreHorizontal size={14} />
          </button>
          {open ? (
            <>
              <button
                aria-label="Close actions menu"
                className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
                onClick={() => setOpen(false)}
                type="button"
              />
              <div
                className={`absolute right-0 ${PORTAL_Z.dropdown} z-10 mt-2 min-w-[180px] rounded-xl border border-brand-border bg-white p-2 shadow-lg`}
              >
                <div className="flex flex-col gap-2">{overflowActions}</div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
