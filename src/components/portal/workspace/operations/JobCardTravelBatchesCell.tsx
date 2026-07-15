"use client";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { formatDisplayDate } from "@/lib/formatDate";
import {
  buildTravelBatchModalInitial,
  formatTravelBatchOwnerSummary,
  TRAVEL_BATCH_MODAL,
} from "@/lib/portal/workspaceContract";
import type { PortalJobCardListRow, PortalModalOpener } from "../portalViewTypes";
import { StatusBadge } from "../portalWorkspaceListUi";

export function JobCardTravelBatchesCell({
  job,
  openModal,
  canManage,
}: {
  canManage: boolean;
  job: PortalJobCardListRow;
  openModal: PortalModalOpener;
}) {
  const [expanded, setExpanded] = useState(false);
  const batchPage = usePaginatedQuery(
    api.crm.jobCards.listTravelBatches,
    expanded ? { jobCardId: String(job.id) } : "skip",
    { initialNumItems: 4 }
  );
  const batches = expanded ? batchPage.results : [];
  return (
    <div className="min-w-[220px] space-y-1.5 text-xs">
      <button
        aria-expanded={expanded}
        className="portal-small-btn"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        {expanded
          ? "Hide Travel Batches"
          : `View Travel Batches${job.travelBatchCount ? ` (${job.travelBatchCount})` : ""}`}
      </button>
      {expanded && batchPage.status === "LoadingFirstPage" ? (
        <span className="block text-brand-muted">Loading Travel Batches…</span>
      ) : null}
      {expanded && batchPage.status !== "LoadingFirstPage" && batches.length === 0 ? (
        <span className="block text-brand-muted">No batches</span>
      ) : null}
      {expanded
        ? batches.map((batch) => (
            <div
              className="space-y-0.5 border-brand-border/60 border-b pb-1.5 last:border-0 last:pb-0"
              key={batch.id}
            >
              <div className="font-medium text-brand-dark">{batch.batchReference}</div>
              <div className="text-brand-muted">
                {batch.destination || "—"} · {batch.confirmedPax} pax · {batch.roomCount || 0} rooms
              </div>
              <div className="text-brand-muted">
                {batch.travelStartDate ? formatDisplayDate(batch.travelStartDate) : "—"}
                {batch.travelEndDate ? ` – ${formatDisplayDate(batch.travelEndDate)}` : ""}
              </div>
              <div className="text-brand-muted" title={formatTravelBatchOwnerSummary(batch)}>
                {formatTravelBatchOwnerSummary(batch)}
                {batch.tourManagerName ? ` · TM ${batch.tourManagerName}` : ""}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <StatusBadge domain="jobCard" status={batch.status} />
                {canManage ? (
                  <button
                    className="portal-small-btn"
                    onClick={() =>
                      openModal(
                        TRAVEL_BATCH_MODAL,
                        buildTravelBatchModalInitial({ batch, job: { ...job, id: String(job.id) } })
                      )
                    }
                    type="button"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            </div>
          ))
        : null}
      {expanded && batchPage.status === "CanLoadMore" ? (
        <button className="portal-small-btn" onClick={() => batchPage.loadMore(4)} type="button">
          Load more Travel Batches
        </button>
      ) : null}
      {expanded && batchPage.status === "LoadingMore" ? (
        <span className="block text-brand-muted">Loading more…</span>
      ) : null}
      {canManage ? (
        <button
          className="portal-small-btn mt-1"
          onClick={() =>
            openModal(
              TRAVEL_BATCH_MODAL,
              buildTravelBatchModalInitial({ job: { ...job, id: String(job.id) } })
            )
          }
          type="button"
        >
          + Batch
        </button>
      ) : null}
    </div>
  );
}
