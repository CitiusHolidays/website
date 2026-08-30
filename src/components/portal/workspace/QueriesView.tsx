"use client";

import type { Id } from "@convex/_generated/dataModel";
import {
  CircleCheck,
  FolderOpen,
  MapIcon,
  Pencil,
  Send,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PortalCopyButton } from "@/components/motion-ui/copy-button";
import { formatDate, LifecycleDates } from "@/components/portal/PortalModalForm";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import { type OptionalAction, QueryRowActions } from "@/components/portal/QueryRowActions";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import {
  queryJobCardHandoffLabel,
  shouldShowJobCardHandoff,
} from "@/lib/portal/jobCardHandoffPresentation";
import { markPortalNavigationFirstContent } from "@/lib/portal/navigationPerformance";
import {
  assignQueryTeamsButtonLabel,
  canShowAssignQueryTeamsButton,
} from "@/lib/portal/permissions";
import type { PortalGridAttention } from "@/lib/portal/portalDataGrid";
import { canDeleteQuery } from "@/lib/portal/queryDeletionAccess";
import {
  getQueryAttentionLabel,
  getQueryPrimaryActionKind,
} from "@/lib/portal/queryListPresentation";
import { buildQueryStatusAction } from "@/lib/portal/queryStatusAction";
import { CustomerJourneyAccessManager } from "./CustomerJourneyAccessManager";
import type { QueriesViewProps } from "./portalViewTypes";
import { isQueryConfirmed, money } from "./portalWorkspaceListHelpers";
import { DeleteButton, QueryFilesSummary, StatusBadge } from "./portalWorkspaceListUi";

type PortalQueryRow = QueriesViewProps["rows"][number];

function JobCardHandoff({ row }: { row: PortalQueryRow }) {
  if (!shouldShowJobCardHandoff(row)) {
    return null;
  }
  const label = queryJobCardHandoffLabel({
    jobCardCode: row.jobCardCode,
    salesStatus: row.salesStatus,
    ticketingScope: row.ticketingScope,
  });
  return row.jobCardId ? (
    <Link
      className="font-medium text-citius-blue text-xs underline-offset-2 hover:underline"
      href={`/portal/job-cards?open=jobCard&id=${row.jobCardId}`}
    >
      {label}
    </Link>
  ) : (
    <div className="font-medium text-citius-blue text-xs">{label}</div>
  );
}

function queryTravelWindow(row: PortalQueryRow) {
  if (!row.travelStartDate) {
    return "Travel dates TBD";
  }
  const start = formatDisplayDate(row.travelStartDate);
  const end = row.travelEndDate ? formatDisplayDate(row.travelEndDate) : "";
  return end ? `${start} – ${end}` : start;
}

function queryAttentionClass(label: string) {
  if (label.startsWith("Lost")) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function queryRowAttention(row: PortalQueryRow): PortalGridAttention | undefined {
  const attention = getQueryAttentionLabel(row);
  if (!attention) {
    return;
  }
  return { label: attention, tone: attention.startsWith("Lost") ? "danger" : "warning" };
}

interface QueryActionsProps {
  access: QueriesViewProps["access"];
  deleteItem: QueriesViewProps["deleteItem"];
  has: QueriesViewProps["has"];
  openCustomerAccess: (row: PortalQueryRow) => void;
  openModal: QueriesViewProps["openModal"];
  removeQuery: QueriesViewProps["removeQuery"];
  row: PortalQueryRow;
  submitToContracting: QueriesViewProps["submitToContracting"];
}

function canManageCustomerJourneyAccess(row: PortalQueryRow, canManageQueries: boolean) {
  return canManageQueries && Boolean(row.hasConfirmedOffer || row.confirmedOffer);
}

function QueryActions({
  access,
  deleteItem,
  has,
  openCustomerAccess,
  openModal,
  removeQuery,
  row,
  submitToContracting,
}: QueryActionsProps) {
  const canManageQueries = has(P.MANAGE_QUERIES);
  const canAssignTeams = canShowAssignQueryTeamsButton(access, row);
  const primaryActionKind = getQueryPrimaryActionKind({
    canAssignTeams,
    canManageQueries,
    submittedToContractingAt: row.submittedToContractingAt,
  });
  const openCommercialFiles = () =>
    openModal("commercialFiles", { entityId: String(row.id), entryPoint: "query" });
  const openQuery = () =>
    openModal("query", { entityId: String(row.id), focusedDetailType: "query" });
  const openReferenceItinerary = () =>
    openModal("queryAttachments", { queryCode: row.queryCode, queryId: String(row.id) });
  const openStatusAction = () => {
    const action = buildQueryStatusAction(row, has);
    if (action) {
      openModal(action.modal, action.initial);
    }
  };
  const openAssignment = () => openModal("assignQueryTeams", { queryId: String(row.id) });
  const handleSubmit = () => submitToContracting({ queryId: String(row.id) });
  const handleDelete = () =>
    deleteItem(row.queryCode ?? "", removeQuery, { queryId: String(row.id) });
  const handleCustomerAccess = () => openCustomerAccess(row);
  const commercialFilesAction = (
    <button
      className="portal-small-btn"
      key="commercial-files"
      onClick={openCommercialFiles}
      type="button"
    >
      <FolderOpen aria-hidden="true" size={14} />
      <span>Files</span>
    </button>
  );
  const customerAccessAction = canManageCustomerJourneyAccess(row, canManageQueries) ? (
    <button
      className="portal-small-btn"
      key="customer-access"
      onClick={handleCustomerAccess}
      type="button"
    >
      <ShieldCheck aria-hidden="true" size={14} />
      <span>Customer access</span>
    </button>
  ) : null;
  if (!primaryActionKind) {
    return (
      <QueryRowActions
        label={row.queryCode ?? ""}
        overflowActions={[commercialFilesAction, customerAccessAction]}
      />
    );
  }
  const statusAction = buildQueryStatusAction(row, has);
  const editAction = (
    <button className="portal-small-btn" key="edit" onClick={openQuery} type="button">
      <Pencil aria-hidden="true" size={14} />
      <span>Edit query</span>
    </button>
  );
  const referenceItineraryAction = (
    <button
      className="portal-small-btn"
      key="reference-itinerary"
      onClick={openReferenceItinerary}
      type="button"
    >
      <MapIcon aria-hidden="true" size={14} />
      <span>Reference Itinerary</span>
    </button>
  );
  const statusButton = statusAction ? (
    <button
      className={primaryActionKind === "status" ? "portal-primary-btn" : "portal-small-btn"}
      key="status"
      onClick={openStatusAction}
      type="button"
    >
      <CircleCheck aria-hidden="true" size={14} />
      <span>{statusAction.label}</span>
    </button>
  ) : null;
  const assignButton = canAssignTeams ? (
    <button
      className={primaryActionKind === "assign" ? "portal-primary-btn" : "portal-small-btn"}
      key="assign"
      onClick={openAssignment}
      type="button"
    >
      <UsersRound aria-hidden="true" size={14} />
      <span>{assignQueryTeamsButtonLabel(access)}</span>
    </button>
  ) : null;
  const submitButton = (
    <button className="portal-primary-btn" key="submit" onClick={handleSubmit} type="button">
      <Send aria-hidden="true" size={14} />
      <span>Submit to Contracting</span>
    </button>
  );
  let primaryAction: OptionalAction = statusButton;
  if (primaryActionKind === "submit") {
    primaryAction = submitButton;
  } else if (primaryActionKind === "assign") {
    primaryAction = assignButton;
  }
  const overflowActions = [
    commercialFilesAction,
    customerAccessAction,
    ...(canManageQueries
      ? [
          editAction,
          referenceItineraryAction,
          primaryActionKind === "status" ? null : statusButton,
          primaryActionKind === "assign" ? null : assignButton,
          canDeleteQuery(access) ? (
            <DeleteButton key="delete" label={row.queryCode} onClick={handleDelete} />
          ) : null,
        ]
      : []),
  ];

  return (
    <QueryRowActions
      label={row.queryCode ?? ""}
      overflowActions={overflowActions}
      primaryAction={primaryAction}
    />
  );
}

function QueryFiles({
  getFinalizedPdfUrl,
  getQueryAttachmentUrl,
  has,
  openModal,
  row,
}: Pick<QueriesViewProps, "getFinalizedPdfUrl" | "getQueryAttachmentUrl" | "has" | "openModal"> & {
  row: PortalQueryRow;
}) {
  const manageReferenceItinerary = () =>
    openModal("queryAttachments", { queryCode: row.queryCode, queryId: String(row.id) });
  return (
    <QueryFilesSummary
      attachments={row.attachments || []}
      canManageReferenceItinerary={has(P.MANAGE_QUERIES)}
      getFinalizedPdfUrl={getFinalizedPdfUrl}
      getQueryAttachmentUrl={getQueryAttachmentUrl}
      onManageReferenceItinerary={manageReferenceItinerary}
      proposalDocument={row.proposalDocument}
    />
  );
}

function QueryMobileCard({
  access,
  deleteItem,
  getFinalizedPdfUrl,
  getQueryAttachmentUrl,
  has,
  openCustomerAccess,
  openModal,
  removeQuery,
  row,
  submitToContracting,
}: Pick<
  QueriesViewProps,
  | "access"
  | "deleteItem"
  | "getFinalizedPdfUrl"
  | "getQueryAttachmentUrl"
  | "has"
  | "openModal"
  | "removeQuery"
  | "submitToContracting"
> & { openCustomerAccess: (row: PortalQueryRow) => void; row: PortalQueryRow }) {
  const attention = getQueryAttentionLabel(row);
  const batchNotes = (row.batchingNotes || "").trim();
  return (
    <article className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-[length:var(--portal-label-size)] text-citius-blue uppercase tracking-[0.12em]">
            {row.queryCode}
          </div>
          <h3 className="mt-1 truncate font-heading font-semibold text-brand-dark text-lg">
            {row.clientName}
          </h3>
          <div className="mt-1 truncate text-brand-muted text-sm">
            {row.destination || "Destination TBD"}
          </div>
        </div>
        <StatusBadge
          domain="queryLeadStage"
          label={row.leadStage || "Inquiry"}
          status={row.leadStage || "Inquiry"}
        />
      </div>
      {attention ? (
        <div className={`rounded-xl border px-3 py-2.5 ${queryAttentionClass(attention)}`}>
          <div className="font-bold text-[length:var(--portal-label-size)] uppercase tracking-[0.12em]">
            Attention
          </div>
          <div className="mt-0.5 font-medium text-sm">{attention}</div>
        </div>
      ) : null}
      <QueryActions
        access={access}
        deleteItem={deleteItem}
        has={has}
        openCustomerAccess={openCustomerAccess}
        openModal={openModal}
        removeQuery={removeQuery}
        row={row}
        submitToContracting={submitToContracting}
      />
      <JobCardHandoff row={row} />
      <div className="grid grid-cols-2 gap-3 border-brand-border/70 border-t pt-3 text-sm">
        <div className="col-span-2">
          <span className="text-brand-muted text-xs">Travel</span>
          <div className="font-medium text-brand-dark">{queryTravelWindow(row)}</div>
        </div>
        <div>
          <span className="text-brand-muted text-xs">Travellers</span>
          <div className="font-medium text-brand-dark">{row.paxCount} pax</div>
        </div>
        <div>
          <span className="text-brand-muted text-xs">Budget per Person</span>
          <div className="font-medium text-brand-dark">{money(row.budgetAmount)}</div>
        </div>
        <div>
          <span className="text-brand-muted text-xs">Sales</span>
          <div className="font-medium text-brand-dark">{row.salesOwnerName || "Unassigned"}</div>
        </div>
        <div>
          <span className="text-brand-muted text-xs">Ticketing</span>
          <div className="font-medium text-brand-dark">{row.ticketingScope || "Scope pending"}</div>
        </div>
        {row.travelInBatches ? (
          <div className="col-span-2">
            <span className="text-brand-muted text-xs">Travel in Series</span>
            <div className="font-medium text-brand-dark">
              Yes{batchNotes ? ` · ${batchNotes}` : ""}
            </div>
          </div>
        ) : null}
      </div>
      <QueryFiles
        getFinalizedPdfUrl={getFinalizedPdfUrl}
        getQueryAttachmentUrl={getQueryAttachmentUrl}
        has={has}
        openModal={openModal}
        row={row}
      />
      <LifecycleDates
        compact
        items={[
          { label: "Created", value: row.createdAt },
          { label: "Submitted", value: row.submittedToContractingAt },
          { label: "Confirmed", value: row.confirmedAt },
        ]}
      />
    </article>
  );
}

export function QueriesView({
  rows,
  filtersActive = false,
  openModal,
  has,
  access,
  deleteItem,
  removeQuery,
  submitToContracting,
  getQueryAttachmentUrl,
  getFinalizedPdfUrl,
  loading = false,
}: QueriesViewProps) {
  const [accessQueryId, setAccessQueryId] = useState<Id<"queries"> | null>(null);
  useEffect(() => {
    if (!loading) {
      markPortalNavigationFirstContent("queries", rows.length > 0 ? "row" : "empty");
    }
  }, [loading, rows]);
  const openCustomerAccess = (row: PortalQueryRow) => setAccessQueryId(row.id);
  const closeCustomerAccess = () => setAccessQueryId(null);
  const renderMobileCard = (row: PortalQueryRow) => (
    <QueryMobileCard
      access={access}
      deleteItem={deleteItem}
      getFinalizedPdfUrl={getFinalizedPdfUrl}
      getQueryAttachmentUrl={getQueryAttachmentUrl}
      has={has}
      openCustomerAccess={openCustomerAccess}
      openModal={openModal}
      removeQuery={removeQuery}
      row={row}
      submitToContracting={submitToContracting}
    />
  );

  return (
    <>
      <SelectableDataTable<PortalQueryRow>
        columns={[
          {
            id: "query",
            kind: "identity",
            label: "Query",
            render: (row: PortalQueryRow) => (
              <div className="min-w-24">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-heading font-semibold text-citius-blue">{row.queryCode}</div>
                  {row.queryCode ? (
                    <PortalCopyButton
                      aria-label={`Copy query ${row.queryCode}`}
                      value={row.queryCode}
                    />
                  ) : null}
                </div>
                <div className="mt-1 text-[length:var(--portal-label-size)] text-brand-muted">
                  Created {formatDate(row.createdAt)}
                </div>
              </div>
            ),
            sortValue: (row: PortalQueryRow) => row.queryCode,
          },
          {
            id: "client",
            label: "Client / travel",
            render: (row: PortalQueryRow) => (
              <div className="min-w-48 max-w-60">
                <PortalTooltip content={row.clientName}>
                  <div className="truncate font-semibold text-brand-dark">{row.clientName}</div>
                </PortalTooltip>
                <div className="mt-1 truncate text-brand-muted text-xs">
                  {row.destination || "Destination TBD"} · {queryTravelWindow(row)}
                </div>
                {row.travelInBatches ? (
                  <div className="mt-1 truncate text-[length:var(--portal-label-size)] text-citius-blue">
                    Travel in Series
                    {(row.batchingNotes || "").trim()
                      ? ` · ${(row.batchingNotes || "").trim()}`
                      : ""}
                  </div>
                ) : null}
              </div>
            ),
            sortValue: (row: PortalQueryRow) => row.clientName,
          },
          {
            hideable: true,
            id: "lifecycle",
            label: "Lifecycle",
            render: (row: PortalQueryRow) => (
              <LifecycleDates
                compact
                items={[
                  { label: "Submitted", value: row.submittedToContractingAt },
                  { label: "Confirmed", value: row.confirmedAt },
                ]}
              />
            ),
            sortValue: (row: PortalQueryRow) => row.submittedToContractingAt || row.createdAt,
          },
          {
            align: "right",
            hideable: true,
            id: "pax-budget",
            label: "Pax / Budget per Person",
            render: (row: PortalQueryRow) => (
              <div className="min-w-28">
                <div className="font-semibold text-brand-dark">{row.paxCount} pax</div>
                <div className="mt-1 text-brand-muted text-xs">{money(row.budgetAmount)}</div>
                {isQueryConfirmed(row) &&
                row.approxMargin !== null &&
                row.approxMargin !== undefined ? (
                  <div className="mt-1 text-[length:var(--portal-label-size)] text-emerald-700">
                    {money(row.approxMargin)} margin
                  </div>
                ) : null}
              </div>
            ),
            sortValue: (row: PortalQueryRow) => row.paxCount,
          },
          {
            id: "stage",
            kind: "status",
            label: "Stage",
            render: (row: PortalQueryRow) => {
              const attention = getQueryAttentionLabel(row);
              return (
                <div className="min-w-36">
                  <StatusBadge
                    domain="queryLeadStage"
                    label={row.leadStage || "Inquiry"}
                    status={row.leadStage || "Inquiry"}
                  />
                  {attention ? (
                    <div
                      className={`mt-2 rounded-md border px-2 py-1 text-[length:var(--portal-label-size)] ${queryAttentionClass(attention)}`}
                    >
                      {attention}
                    </div>
                  ) : null}
                  <div className="mt-2">
                    <JobCardHandoff row={row} />
                  </div>
                </div>
              );
            },
            sortValue: (row: PortalQueryRow) => row.leadStage || "Inquiry",
          },
          {
            hideable: true,
            id: "sales-ticketing",
            label: "Sales / ticketing",
            render: (row: PortalQueryRow) => (
              <div className="min-w-32 text-xs">
                <div className="font-medium text-brand-dark">
                  {row.salesOwnerName || "Unassigned"}
                </div>
                <div className="mt-1 text-brand-muted">{row.ticketingScope || "Scope pending"}</div>
              </div>
            ),
            sortValue: (row: PortalQueryRow) => row.salesOwnerName || "",
          },
          {
            hideable: true,
            id: "files",
            label: "Files",
            render: (row: PortalQueryRow) => (
              <QueryFiles
                getFinalizedPdfUrl={getFinalizedPdfUrl}
                getQueryAttachmentUrl={getQueryAttachmentUrl}
                has={has}
                openModal={openModal}
                row={row}
              />
            ),
          },
          {
            id: "action",
            kind: "action",
            label: "Action",
            render: (row: PortalQueryRow) => (
              <QueryActions
                access={access}
                deleteItem={deleteItem}
                has={has}
                openCustomerAccess={openCustomerAccess}
                openModal={openModal}
                removeQuery={removeQuery}
                row={row}
                submitToContracting={submitToContracting}
              />
            ),
          },
        ]}
        empty="No queries yet."
        filtersActive={filtersActive}
        mobileCardIncludesActions
        mobileCardRender={renderMobileCard}
        rowAttention={queryRowAttention}
        rows={rows}
        tableClassName="min-w-[68rem]"
      />
      {accessQueryId ? (
        <CustomerJourneyAccessManager onClose={closeCustomerAccess} open queryId={accessQueryId} />
      ) : null}
    </>
  );
}
