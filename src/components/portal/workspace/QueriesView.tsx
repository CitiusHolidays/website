"use client";

import { formatDate, LifecycleDates } from "@/components/portal/PortalModalForm";
import { type OptionalAction, QueryRowActions } from "@/components/portal/QueryRowActions";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import {
  assignQueryTeamsButtonLabel,
  canShowAssignQueryTeamsButton,
} from "@/lib/portal/permissions";
import type { PortalGridAttention } from "@/lib/portal/portalDataGrid";
import {
  getQueryAttentionLabel,
  getQueryPrimaryActionKind,
} from "@/lib/portal/queryListPresentation";
import { buildQueryStatusAction } from "@/lib/portal/queryStatusAction";
import type { QueriesViewProps } from "./portalViewTypes";
import { isQueryConfirmed, money } from "./portalWorkspaceListHelpers";
import { DeleteButton, QueryAttachmentSummary, StatusBadge } from "./portalWorkspaceListUi";

type PortalQueryRow = QueriesViewProps["rows"][number];

function queryModalEditInitial(row: PortalQueryRow) {
  return {
    batchingNotes: row.batchingNotes || "",
    budgetAmount: String(row.budgetAmount || ""),
    clientName: row.clientName,
    contactMobile: row.contactMobile,
    contactPerson: row.contactPerson,
    destination: row.destination,
    entityId: row.id,
    notes: row.notes,
    paxCount: String(row.paxCount),
    queryType: row.queryType,
    salesOwnerName: row.salesOwnerName,
    source: row.source,
    staffId: row.contractingOwnerId || "",
    ticketingScope: row.ticketingScope || "",
    travelEndDate: row.travelEndDate,
    travelInBatches: row.travelInBatches ? "Yes" : "No",
    travelStartDate: row.travelStartDate,
    travelType: row.travelType,
  };
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
  if (label === "No open exception") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (label.startsWith("Lost")) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function queryRowAttention(row: PortalQueryRow): PortalGridAttention | undefined {
  const attention = getQueryAttentionLabel(row);
  if (attention === "No open exception") {
    return;
  }
  return { label: attention, tone: attention.startsWith("Lost") ? "danger" : "warning" };
}

interface QueryActionsProps {
  access: QueriesViewProps["access"];
  deleteItem: QueriesViewProps["deleteItem"];
  has: QueriesViewProps["has"];
  openModal: QueriesViewProps["openModal"];
  removeQuery: QueriesViewProps["removeQuery"];
  row: PortalQueryRow;
  submitToContracting: QueriesViewProps["submitToContracting"];
}

function QueryActions({
  access,
  deleteItem,
  has,
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
  if (!primaryActionKind) {
    return null;
  }
  const statusAction = buildQueryStatusAction(row, has);
  const editAction = (
    <button
      className="portal-small-btn"
      key="edit"
      onClick={() => openModal("query", queryModalEditInitial(row))}
      type="button"
    >
      Edit query
    </button>
  );
  const filesAction = (
    <button
      className="portal-small-btn"
      key="reference-itinerary"
      onClick={() =>
        openModal("queryAttachments", { queryCode: row.queryCode, queryId: String(row.id) })
      }
      type="button"
    >
      Reference Itinerary
    </button>
  );
  const statusButton = (
    <button
      className={primaryActionKind === "status" ? "portal-primary-btn" : "portal-small-btn"}
      key="status"
      onClick={() => openModal(statusAction.modal, statusAction.initial)}
      type="button"
    >
      {statusAction.label}
    </button>
  );
  const assignButton = canAssignTeams ? (
    <button
      className={primaryActionKind === "assign" ? "portal-primary-btn" : "portal-small-btn"}
      key="assign"
      onClick={() => openModal("assignQueryTeams", { queryId: String(row.id) })}
      type="button"
    >
      {assignQueryTeamsButtonLabel(access)}
    </button>
  ) : null;
  const submitButton = (
    <button
      className="portal-primary-btn"
      key="submit"
      onClick={() => submitToContracting({ queryId: String(row.id) })}
      type="button"
    >
      Submit to Contracting
    </button>
  );
  let primaryAction: OptionalAction = statusButton;
  if (primaryActionKind === "submit") {
    primaryAction = submitButton;
  } else if (primaryActionKind === "assign") {
    primaryAction = assignButton;
  }
  const overflowActions = canManageQueries
    ? [
        editAction,
        filesAction,
        primaryActionKind === "status" ? null : statusButton,
        primaryActionKind === "assign" ? null : assignButton,
        <DeleteButton
          key="delete"
          label={row.queryCode}
          onClick={() => deleteItem(row.queryCode ?? "", removeQuery, { queryId: String(row.id) })}
        />,
      ]
    : [];

  return (
    <QueryRowActions
      label={row.queryCode ?? ""}
      overflowActions={overflowActions}
      primaryAction={primaryAction}
    />
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
}: QueriesViewProps) {
  return (
    <SelectableDataTable<PortalQueryRow>
      columns={[
        {
          id: "query",
          kind: "identity",
          label: "Query",
          render: (row: PortalQueryRow) => (
            <div className="min-w-24">
              <div className="font-heading font-semibold text-citius-blue">{row.queryCode}</div>
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
              <div className="truncate font-semibold text-brand-dark" title={row.clientName}>
                {row.clientName}
              </div>
              <div className="mt-1 truncate text-brand-muted text-xs">
                {row.destination || "Destination TBD"} · {queryTravelWindow(row)}
              </div>
              {row.travelInBatches ? (
                <div className="mt-1 truncate text-[length:var(--portal-label-size)] text-citius-blue">
                  Travel in Series
                  {(row.batchingNotes || "").trim() ? ` · ${(row.batchingNotes || "").trim()}` : ""}
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
          label: "Pax / budget",
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
                <div
                  className={`mt-2 rounded-md border px-2 py-1 text-[length:var(--portal-label-size)] ${queryAttentionClass(attention)}`}
                >
                  {attention}
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
            <QueryAttachmentSummary
              attachmentCount={row.attachmentCount}
              attachments={row.attachments || []}
              canManage={has(P.MANAGE_QUERIES)}
              getQueryAttachmentUrl={getQueryAttachmentUrl}
              onManage={() =>
                openModal("queryAttachments", { queryCode: row.queryCode, queryId: String(row.id) })
              }
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
      mobileCardRender={(row: PortalQueryRow) => {
        const attention = getQueryAttentionLabel(row);
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

            <div className={`rounded-xl border px-3 py-2.5 ${queryAttentionClass(attention)}`}>
              <div className="font-bold text-[length:var(--portal-label-size)] uppercase tracking-[0.12em]">
                Attention
              </div>
              <div className="mt-0.5 font-medium text-sm">{attention}</div>
            </div>

            <QueryActions
              access={access}
              deleteItem={deleteItem}
              has={has}
              openModal={openModal}
              removeQuery={removeQuery}
              row={row}
              submitToContracting={submitToContracting}
            />

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
                <span className="text-brand-muted text-xs">Budget</span>
                <div className="font-medium text-brand-dark">{money(row.budgetAmount)}</div>
              </div>
              <div>
                <span className="text-brand-muted text-xs">Sales</span>
                <div className="font-medium text-brand-dark">
                  {row.salesOwnerName || "Unassigned"}
                </div>
              </div>
              <div>
                <span className="text-brand-muted text-xs">Ticketing</span>
                <div className="font-medium text-brand-dark">
                  {row.ticketingScope || "Scope pending"}
                </div>
              </div>
              {row.travelInBatches ? (
                <div className="col-span-2">
                  <span className="text-brand-muted text-xs">Travel in Series</span>
                  <div className="font-medium text-brand-dark">
                    Yes
                    {(row.batchingNotes || "").trim()
                      ? ` · ${(row.batchingNotes || "").trim()}`
                      : ""}
                  </div>
                </div>
              ) : null}
            </div>
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
      }}
      rowAttention={queryRowAttention}
      rows={rows}
      tableClassName="min-w-[68rem]"
    />
  );
}
