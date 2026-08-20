"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatDate } from "@/components/portal/PortalModalForm";
import { PortalTooltip } from "@/components/portal/PortalTooltip";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { CONTRACTING_TEAM_ROLES } from "@/lib/portal/constants";
import { getContractingAttention } from "@/lib/portal/contractingListPresentation";
import { buildContractingSurfaceStatusAction } from "@/lib/portal/contractingQueryActions";
import { markPortalNavigationFirstContent } from "@/lib/portal/navigationPerformance";
import { canDeleteQuery } from "@/lib/portal/queryDeletionAccess";
import type {
  ContractingViewProps,
  PortalContractingTeamRow,
  PortalQueryListRow,
} from "./portalViewTypes";
import { approximateMarginLabel, money, notesPreview, strong } from "./portalWorkspaceListHelpers";
import { DeleteButton, Panel, QueryFilesSummary, StatusBadge } from "./portalWorkspaceListUi";

type PortalContractingQueryRow = PortalQueryListRow;
function ContractingJobCardHandoff({ row }: { row: PortalContractingQueryRow }) {
  if (row.salesStatus !== "Order Confirmed") {
    return null;
  }
  if (row.jobCardId) {
    return (
      <Link
        className="font-medium text-citius-blue text-xs underline-offset-2 hover:underline"
        href={`/portal/job-cards?open=jobCard&id=${row.jobCardId}`}
      >
        {row.jobCardCode}
      </Link>
    );
  }
  return <span className="font-medium text-amber-700 text-xs">Awaiting Job Card</span>;
}

function ContractingProposalCost({
  openModal,
  row,
}: {
  openModal: ContractingViewProps["openModal"];
  row: PortalContractingQueryRow;
}) {
  const proposal = row.proposalPreview;
  const handleOpen = () => {
    if (!proposal) {
      return;
    }
    openModal("proposal", {
      entityId: proposal.proposalId,
      focusedDetailType: "proposal",
    });
  };

  if (row.commercialProjectionState === "preparing") {
    return <span className="text-brand-muted text-xs">Preparing…</span>;
  }
  if (!proposal) {
    return "-";
  }
  return (
    <button
      className="font-semibold text-citius-blue underline-offset-2 hover:underline"
      onClick={handleOpen}
      type="button"
    >
      {money(proposal.costPrice)}/pax ({proposal.proposalCode})
    </button>
  );
}

function ContractingActions({
  access,
  canAssign,
  deleteItem,
  has,
  openModal,
  removeQuery,
  row,
}: Pick<
  ContractingViewProps,
  "access" | "canAssign" | "deleteItem" | "has" | "openModal" | "removeQuery"
> & { row: PortalContractingQueryRow }) {
  const statusAction = buildContractingSurfaceStatusAction(row, has);
  const handleFiles = () => {
    openModal("commercialFiles", { entityId: String(row.id), entryPoint: "query" });
  };
  const handleAssign = () => {
    openModal("assignQueryTeams", { queryId: String(row.id) });
  };
  const handleStatusAction = () => {
    if (statusAction) {
      openModal(statusAction.modal, statusAction.initial);
    }
  };
  const handleDelete = () => {
    deleteItem(row.queryCode ?? "", removeQuery, { queryId: String(row.id) });
  };

  return (
    <div className="flex gap-2">
      <button className="portal-small-btn" onClick={handleFiles} type="button">
        Files
      </button>
      {canAssign ? (
        <button className="portal-small-btn" onClick={handleAssign} type="button">
          Assign
        </button>
      ) : null}
      {statusAction ? (
        <button className="portal-small-btn" onClick={handleStatusAction} type="button">
          {statusAction.label}
        </button>
      ) : null}
      {canDeleteQuery(access) ? (
        <DeleteButton label={row.queryCode} onClick={handleDelete} />
      ) : null}
    </div>
  );
}

function contractingCostLabel(row: PortalContractingQueryRow) {
  if (row.commercialProjectionState === "preparing") {
    return "Preparing…";
  }
  return row.proposalPreview ? `${money(row.proposalPreview.costPrice)}/pax` : "Not started";
}

function ContractingMobileCard({ row }: { row: PortalContractingQueryRow }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-[length:var(--portal-label-size)] text-citius-blue uppercase tracking-[0.12em]">
            {row.queryCode}
          </div>
          <PortalTooltip content={row.clientName}>
            <div className="mt-1 truncate font-heading font-semibold text-base text-brand-dark">
              {row.clientName}
            </div>
          </PortalTooltip>
        </div>
        <StatusBadge domain="queryContracting" status={row.contractingStatus} />
      </div>
      <div className="grid grid-cols-2 gap-3 border-brand-border/70 border-t pt-3 text-sm">
        <div>
          <span className="text-brand-muted text-xs">Received</span>
          <div className="font-medium text-brand-dark">
            {formatDate(row.submittedToContractingAt || row.createdAt)}
          </div>
        </div>
        <div>
          <span className="text-brand-muted text-xs">Contracting SPOC</span>
          <div className="font-medium text-brand-dark">
            {row.contractingOwnerName || "Unassigned"}
          </div>
        </div>
        <div>
          <span className="text-brand-muted text-xs">Ticketing</span>
          <div className="font-medium text-brand-dark">{row.ticketingScope || "Scope pending"}</div>
        </div>
        <div>
          <span className="text-brand-muted text-xs">Cost Price per person</span>
          <div className="font-medium text-brand-dark">{contractingCostLabel(row)}</div>
        </div>
        <div>
          <span className="text-brand-muted text-xs">Travel in Series</span>
          <div className="font-medium text-brand-dark">{row.travelInBatches ? "Yes" : "No"}</div>
        </div>
        {row.travelInBatches ? (
          <div className="col-span-2">
            <span className="text-brand-muted text-xs">Batch Details</span>
            <div className="font-medium text-brand-dark">
              {(row.batchingNotes || "").trim() || "-"}
            </div>
          </div>
        ) : null}
      </div>
      {row.notes ? (
        <div className="rounded-xl bg-brand-light px-3 py-2 text-brand-muted text-sm">
          {row.notes}
        </div>
      ) : null}
      <ContractingJobCardHandoff row={row} />
    </div>
  );
}

function renderContractingMobileCard(row: PortalContractingQueryRow) {
  return <ContractingMobileCard row={row} />;
}

function contractingRowAttention(row: PortalContractingQueryRow) {
  return getContractingAttention({ ...row, proposal: row.proposalPreview ?? undefined });
}

export function ContractingView({
  access,
  rows,
  filtersActive = false,
  team,
  openModal,
  has,
  canAssign,
  deleteItem,
  loading = false,
  removeQuery,
  getFinalizedPdfUrl,
  getQueryAttachmentUrl,
}: ContractingViewProps) {
  useEffect(() => {
    if (!loading) {
      markPortalNavigationFirstContent("contracting", rows.length > 0 ? "row" : "empty");
    }
  }, [loading, rows]);

  const contractingTeam = team.filter((member) =>
    member.roles.some((role) => CONTRACTING_TEAM_ROLES.includes(role))
  );
  const teamRows: PortalContractingTeamRow[] = contractingTeam.map((member) => ({
    activeQueries: rows.filter(
      (query) =>
        query.contractingOwnerName === member.name &&
        !["Order Confirmed", "Order Lost"].includes(query.contractingStatus ?? "")
    ).length,
    email: member.email,
    id: member.id,
    location: member.location || "-",
    name: member.name,
  }));

  return (
    <div className="space-y-5">
      {canAssign ? (
        <Panel title="Contracting team">
          <SelectableDataTable<PortalContractingTeamRow>
            columns={[
              { id: "name", label: "Name", render: (row) => strong(row.name) },
              { id: "email", label: "Email", render: (row) => row.email },
              { id: "location", label: "Location", render: (row) => row.location },
              {
                id: "active-queries",
                label: "Active queries",
                render: (row) => row.activeQueries,
              },
            ]}
            compact
            empty="No contracting staff in the directory yet."
            rows={teamRows}
          />
        </Panel>
      ) : null}
      <SelectableDataTable<PortalContractingQueryRow>
        columns={[
          {
            id: "query",
            kind: "identity",
            label: "Query",
            render: (row: PortalContractingQueryRow) => (
              <span className="font-heading font-semibold text-citius-blue">{row.queryCode}</span>
            ),
            sortValue: (row: PortalContractingQueryRow) => row.queryCode,
          },
          {
            id: "client",
            label: "Client",
            render: (row: PortalContractingQueryRow) => strong(row.clientName),
            sortValue: (row: PortalContractingQueryRow) => row.clientName,
          },
          {
            hideable: true,
            id: "received",
            label: "Received",
            render: (row: PortalContractingQueryRow) => (
              <span className="text-brand-muted text-xs">
                {formatDate(row.submittedToContractingAt || row.createdAt)}
              </span>
            ),
            sortValue: (row: PortalContractingQueryRow) =>
              row.submittedToContractingAt || row.createdAt,
          },
          {
            hideable: true,
            id: "confirmed",
            label: "Confirmed",
            render: (row: PortalContractingQueryRow) => (
              <span className="text-brand-muted text-xs">{formatDate(row.confirmedAt)}</span>
            ),
            sortValue: (row: PortalContractingQueryRow) => row.confirmedAt,
          },
          {
            hideable: true,
            id: "sales-spoc",
            label: "Sales SPOC",
            render: (row: PortalContractingQueryRow) => row.salesOwnerName || "-",
            sortValue: (row: PortalContractingQueryRow) => row.salesOwnerName || "",
          },
          {
            id: "contracting-spoc",
            label: "Contracting SPOC",
            render: (row: PortalContractingQueryRow) => row.contractingOwnerName || "Unassigned",
            sortValue: (row: PortalContractingQueryRow) => row.contractingOwnerName || "",
          },
          {
            hideable: true,
            id: "ticketing-scope",
            label: "Ticketing Scope",
            render: (row: PortalContractingQueryRow) => row.ticketingScope || "-",
          },
          {
            hideable: true,
            id: "travel-in-series",
            label: "Travel in Series",
            render: (row: PortalContractingQueryRow) => (row.travelInBatches ? "Yes" : "No"),
          },
          {
            hideable: true,
            id: "batch-details",
            label: "Batch Details",
            render: (row: PortalContractingQueryRow) =>
              row.travelInBatches ? row.batchingNotes || "-" : "-",
          },
          {
            hideable: true,
            id: "notes",
            label: "Notes",
            render: (row: PortalContractingQueryRow) => notesPreview(row.notes),
          },
          {
            hideable: true,
            id: "files",
            label: "Files",
            render: (row: PortalContractingQueryRow) => (
              <QueryFilesSummary
                attachments={row.attachments || []}
                getFinalizedPdfUrl={getFinalizedPdfUrl}
                getQueryAttachmentUrl={getQueryAttachmentUrl}
                proposalDocument={row.proposalDocument}
              />
            ),
          },
          {
            id: "status",
            kind: "status",
            label: "Status",
            render: (row: PortalContractingQueryRow) => (
              <div className="space-y-2">
                <StatusBadge domain="queryContracting" status={row.contractingStatus} />
                <ContractingJobCardHandoff row={row} />
              </div>
            ),
            sortValue: (row: PortalContractingQueryRow) => row.contractingStatus || "",
          },
          {
            align: "right",
            hideable: true,
            id: "proposal-cost",
            label: "Proposal Cost",
            render: (row: PortalContractingQueryRow) => (
              <ContractingProposalCost openModal={openModal} row={row} />
            ),
          },
          {
            align: "right",
            hideable: true,
            id: "approx-margin",
            label: "Approx. Margin",
            render: approximateMarginLabel,
          },
          {
            cellClassName: "min-w-56",
            headerClassName: "min-w-56",
            id: "action",
            kind: "action",
            label: "Action",
            render: (row: PortalContractingQueryRow) => (
              <ContractingActions
                access={access}
                canAssign={canAssign}
                deleteItem={deleteItem}
                has={has}
                openModal={openModal}
                removeQuery={removeQuery}
                row={row}
              />
            ),
          },
        ]}
        empty="No contracting queries yet."
        filtersActive={filtersActive}
        mobileCardRender={renderContractingMobileCard}
        rowAttention={contractingRowAttention}
        rows={rows}
        tableClassName="min-w-[78rem]"
      />
    </div>
  );
}
