"use client";

import { api } from "@convex/_generated/api";
import type { PaginationStatus } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import { Button } from "@/components/ui/application-button";
import { formatDisplayDate } from "@/lib/formatDate";
import { useTrackedPaginatedQuery as usePaginatedQuery } from "@/lib/portal/trackedConvexSubscriptions";
import {
  buildTravelBatchModalInitial,
  formatTravelBatchOwnerSummary,
  TRAVEL_BATCH_MODAL,
} from "@/lib/portal/workspaceContract";
import type { PortalJobCardListRow, PortalModalOpener } from "../portalViewTypes";
import { StatusBadge } from "../portalWorkspaceListUi";

type TravelBatch = FunctionReturnType<typeof api.crm.jobCards.listTravelBatches>["page"][number];

function TravelBatchRow({
  batch,
  canManage,
  job,
  openModal,
}: {
  batch: TravelBatch;
  canManage: boolean;
  job: PortalJobCardListRow;
  openModal: PortalModalOpener;
}) {
  const edit = () => {
    openModal(
      TRAVEL_BATCH_MODAL,
      buildTravelBatchModalInitial({ batch, job: { ...job, id: String(job.id) } })
    );
  };
  return (
    <div className="space-y-0.5 border-brand-border/60 border-b pb-1.5 last:border-0 last:pb-0">
      <div className="font-medium text-brand-dark">{batch.batchReference}</div>
      <div className="text-brand-muted">
        {batch.destination || "—"} · {batch.confirmedPax} pax · {batch.roomCount || 0} rooms
      </div>
      <div className="text-brand-muted">
        {batch.travelStartDate ? formatDisplayDate(batch.travelStartDate) : "—"}
        {batch.travelEndDate ? ` – ${formatDisplayDate(batch.travelEndDate)}` : ""}
      </div>
      <PortalTooltip content={formatTravelBatchOwnerSummary(batch)}>
        <div className="text-brand-muted">
          {formatTravelBatchOwnerSummary(batch)}
          {batch.tourManagerName ? ` · TM ${batch.tourManagerName}` : ""}
        </div>
      </PortalTooltip>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <StatusBadge domain="jobCard" status={batch.status} />
        {canManage ? (
          <Button className="portal-small-btn" onClick={edit} type="button">
            Edit
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function travelBatchToggleLabel(expanded: boolean, travelBatchCount: number | undefined) {
  if (expanded) {
    return "Hide series";
  }
  return `View series${travelBatchCount ? ` (${travelBatchCount})` : ""}`;
}

/** The expanded series list with its loading, empty and load-more states. */
function TravelBatchSeries({
  batches,
  canManage,
  job,
  onLoadMore,
  openModal,
  status,
}: {
  batches: TravelBatch[];
  canManage: boolean;
  job: PortalJobCardListRow;
  onLoadMore: () => void;
  openModal: PortalModalOpener;
  status: PaginationStatus;
}) {
  const loadingFirstPage = status === "LoadingFirstPage";
  return (
    <>
      {loadingFirstPage ? <span className="block text-brand-muted">Loading series…</span> : null}
      {!loadingFirstPage && batches.length === 0 ? (
        <span className="block text-brand-muted">No series</span>
      ) : null}
      {batches.map((batch) => (
        <TravelBatchRow
          batch={batch}
          canManage={canManage}
          job={job}
          key={batch.id}
          openModal={openModal}
        />
      ))}
      {status === "CanLoadMore" ? (
        <Button className="portal-small-btn" onClick={onLoadMore} type="button">
          Load more series
        </Button>
      ) : null}
      {status === "LoadingMore" ? (
        <span className="block text-brand-muted">Loading more…</span>
      ) : null}
    </>
  );
}

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
  const toggleExpanded = () => setExpanded((current) => !current);
  const loadMore = () => batchPage.loadMore(4);
  const addBatch = () => {
    openModal(
      TRAVEL_BATCH_MODAL,
      buildTravelBatchModalInitial({ job: { ...job, id: String(job.id) } })
    );
  };
  return (
    <div className="min-w-[220px] space-y-1.5 text-xs">
      <Button
        aria-expanded={expanded}
        className="portal-small-btn"
        onClick={toggleExpanded}
        type="button"
      >
        {travelBatchToggleLabel(expanded, job.travelBatchCount)}
      </Button>
      {expanded ? (
        <TravelBatchSeries
          batches={batchPage.results}
          canManage={canManage}
          job={job}
          onLoadMore={loadMore}
          openModal={openModal}
          status={batchPage.status}
        />
      ) : null}
      {canManage ? (
        <Button className="portal-small-btn mt-1" onClick={addBatch} type="button">
          + Series
        </Button>
      ) : null}
    </div>
  );
}
