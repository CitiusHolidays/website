"use client";

import { formatDate } from "@/components/portal/PortalModalForm";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { CONTRACTING_TEAM_ROLES, PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { getContractingAttention } from "@/lib/portal/contractingListPresentation";
import { proposalLinkedQueryIds, proposalPrimaryQuery } from "@/lib/portal/proposalLinks";
import { buildQueryStatusAction } from "@/lib/portal/queryStatusAction";
import type {
  ContractingViewProps,
  PortalContractingTeamRow,
  PortalProposalListRow,
  PortalQueryListRow,
} from "./portalViewTypes";
import { approximateMarginLabel, money, notesPreview, strong } from "./portalWorkspaceListHelpers";
import { DeleteButton, Panel, StatusBadge } from "./portalWorkspaceListUi";

type PortalContractingQueryRow = PortalQueryListRow;
type PortalContractingProposalRow = PortalProposalListRow;

export function ContractingView({
  rows,
  proposals,
  filtersActive = false,
  team,
  openModal,
  has,
  canAssign,
  deleteItem,
  removeQuery,
}: ContractingViewProps) {
  const proposalsByQueryId = (() => {
    const map = new Map();
    for (const proposal of proposals) {
      const queryIds = proposalLinkedQueryIds(proposal);
      if (queryIds.length === 0) {
        continue;
      }
      for (const queryId of queryIds) {
        const existing = map.get(queryId);
        if (
          !existing ||
          new Date(proposal.updatedAt ?? 0).getTime() > new Date(existing.updatedAt ?? 0).getTime()
        ) {
          map.set(queryId, proposal);
        }
      }
    }
    return map;
  })();

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
      {canAssign && (
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
      )}
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
            id: "notes",
            label: "Notes",
            render: (row: PortalContractingQueryRow) => notesPreview(row.notes),
          },
          {
            id: "status",
            kind: "status",
            label: "Status",
            render: (row: PortalContractingQueryRow) => (
              <StatusBadge domain="queryContracting" status={row.contractingStatus} />
            ),
            sortValue: (row: PortalContractingQueryRow) => row.contractingStatus || "",
          },
          {
            align: "right",
            hideable: true,
            id: "proposal-cost",
            label: "Proposal Cost",
            render: (row: PortalContractingQueryRow) => {
              const proposal = proposalsByQueryId.get(row.id);
              if (!proposal) {
                return "-";
              }
              return (
                <button
                  className="font-semibold text-citius-blue underline-offset-2 hover:underline"
                  onClick={() =>
                    openModal("proposal", {
                      airfarePerPax: String(proposal.airfarePerPax ?? ""),
                      clientName: proposal.clientName,
                      entityId: proposal.id,
                      itinerarySummary: proposal.itinerarySummary || "",
                      landCostPerPax: String(proposal.landCostPerPax ?? ""),
                      paxCount: String(
                        proposalPrimaryQuery(proposal)?.paxCount ?? row.paxCount ?? 1
                      ),
                      queryId: proposal.queryId || "",
                      queryIds: proposalLinkedQueryIds(proposal),
                      sellingPrice: String(proposal.sellingPrice ?? ""),
                      taxRate: proposal.taxRate == null ? "" : String(proposal.taxRate),
                      visaCostPerPax: String(proposal.visaCostPerPax ?? ""),
                    })
                  }
                  type="button"
                >
                  {money(proposal.costPrice)}/pax ({proposal.proposalCode})
                </button>
              );
            },
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
            render: (row: PortalContractingQueryRow) => {
              const statusAction = buildQueryStatusAction(row, has);
              return (
                <div className="flex gap-2">
                  {canAssign && (
                    <button
                      className="portal-small-btn"
                      onClick={() => openModal("assignQueryTeams", { queryId: String(row.id) })}
                      type="button"
                    >
                      Assign
                    </button>
                  )}
                  {has(P.MANAGE_CONTRACTING) && (
                    <>
                      <button
                        className="portal-small-btn"
                        onClick={() => openModal(statusAction.modal, statusAction.initial)}
                        type="button"
                      >
                        {statusAction.label}
                      </button>
                      <DeleteButton
                        label={row.queryCode}
                        onClick={() =>
                          deleteItem(row.queryCode ?? "", removeQuery, { queryId: String(row.id) })
                        }
                      />
                    </>
                  )}
                </div>
              );
            },
          },
        ]}
        empty="No contracting queries yet."
        filtersActive={filtersActive}
        mobileCardRender={(row: PortalContractingQueryRow) => {
          const proposal = proposalsByQueryId.get(row.id);
          return (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[length:var(--portal-label-size)] text-citius-blue uppercase tracking-[0.12em]">
                    {row.queryCode}
                  </div>
                  <div
                    className="mt-1 truncate font-heading font-semibold text-base text-brand-dark"
                    title={row.clientName}
                  >
                    {row.clientName}
                  </div>
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
                  <div className="font-medium text-brand-dark">
                    {row.ticketingScope || "Scope pending"}
                  </div>
                </div>
                <div>
                  <span className="text-brand-muted text-xs">Cost Price per person</span>
                  <div className="font-medium text-brand-dark">
                    {proposal ? `${money(proposal.costPrice)}/pax` : "Not started"}
                  </div>
                </div>
              </div>
              {row.notes ? (
                <div className="rounded-xl bg-brand-light px-3 py-2 text-brand-muted text-sm">
                  {row.notes}
                </div>
              ) : null}
            </div>
          );
        }}
        rowAttention={(row: PortalContractingQueryRow) =>
          getContractingAttention({ ...row, proposal: proposalsByQueryId.get(row.id) })
        }
        rows={rows}
        tableClassName="min-w-[78rem]"
      />
    </div>
  );
}
