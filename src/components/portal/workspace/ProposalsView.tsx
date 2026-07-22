"use client";

import { Send } from "lucide-react";
import { formatDate, LifecycleDates } from "@/components/portal/PortalModalForm";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import {
  proposalLinkedQueryIds,
  proposalLinkedQueryLabel,
  proposalPrimaryQuery,
} from "@/lib/portal/proposalLinks";
import { getProposalAttention, proposalWorkflowLabel } from "@/lib/portal/proposalListPresentation";
import type { ProposalsViewProps } from "./portalViewTypes";
import { money, openFinalizedProposalPdf, strong } from "./portalWorkspaceListHelpers";
import {
  DeleteButton,
  EditButton,
  FinalizedProposalPdfSummary,
  QueryAttachmentSummary,
  StatusBadge,
} from "./portalWorkspaceListUi";

type PortalProposalRow = ProposalsViewProps["rows"][number];

function proposalAttentionClass(tone: "danger" | "info" | "warning" | undefined) {
  if (tone === "danger") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (tone === "info") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function proposalRowAttention(row: PortalProposalRow) {
  const attention = getProposalAttention(row);
  return attention.tone ? attention : undefined;
}

interface ProposalRowActionsProps {
  canManage: boolean;
  canSendToClient: boolean;
  deleteItem: ProposalsViewProps["deleteItem"];
  markProposalSent: ProposalsViewProps["markProposalSent"];
  openModal: ProposalsViewProps["openModal"];
  removeProposal: ProposalsViewProps["removeProposal"];
  row: PortalProposalRow;
  sendProposalToSales: ProposalsViewProps["sendProposalToSales"];
}

function ProposalRowActions({
  canManage,
  canSendToClient,
  deleteItem,
  markProposalSent,
  openModal,
  removeProposal,
  row,
  sendProposalToSales,
}: ProposalRowActionsProps) {
  if (!(canSendToClient || canManage)) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canManage && row.status === "Draft" && (
        <button
          className="portal-small-btn"
          onClick={() => sendProposalToSales({ proposalId: String(row.id) })}
          type="button"
        >
          <Send size={13} /> Send to Sales
        </button>
      )}
      {canSendToClient && row.status === "Sent" && !row.sentToClientAt && (
        <button
          className="portal-small-btn"
          onClick={() => markProposalSent({ proposalId: String(row.id) })}
          type="button"
        >
          <Send size={13} /> Mark client sent
        </button>
      )}
      {canManage && (
        <EditButton
          onClick={() =>
            openModal("proposal", {
              airfarePerPax: String(row.airfarePerPax ?? ""),
              clientName: row.clientName,
              entityId: row.id,
              itinerarySummary: row.itinerarySummary || "",
              landCostPerPax: String(row.landCostPerPax ?? ""),
              paxCount: String(proposalPrimaryQuery(row)?.paxCount ?? 1),
              queryId: row.queryId || "",
              queryIds: proposalLinkedQueryIds(row),
              sellingPrice: String(row.sellingPrice ?? ""),
              taxRate: row.taxRate == null ? "" : String(row.taxRate),
              visaCostPerPax: String(row.visaCostPerPax ?? ""),
            })
          }
        />
      )}
      {canManage && (
        <button
          className="portal-small-btn"
          onClick={() =>
            openModal("addProposalCollaborator", {
              proposalId: String(row.id),
              queryCode: row.proposalCode,
            })
          }
          type="button"
        >
          Share
        </button>
      )}
      {canManage && (row.collaboratorStaffIds ?? []).length > 0 && (
        <button
          className="portal-small-btn"
          onClick={() =>
            openModal("removeProposalCollaborator", {
              proposalId: String(row.id),
              queryCode: row.proposalCode,
            })
          }
          type="button"
        >
          Unshare
        </button>
      )}
      {canManage && (
        <DeleteButton
          label={row.proposalCode}
          onClick={() =>
            deleteItem(row.proposalCode ?? "", removeProposal, { proposalId: String(row.id) })
          }
        />
      )}
    </div>
  );
}

interface ProposalMobileCardProps {
  canManage: boolean;
  canManageDocuments: boolean;
  getFinalizedPdfUrl: ProposalsViewProps["getFinalizedPdfUrl"];
  getProposalAttachmentUrl: ProposalsViewProps["getProposalAttachmentUrl"];
  openModal: ProposalsViewProps["openModal"];
  row: PortalProposalRow;
}

function ProposalMobileCard({
  canManage,
  canManageDocuments,
  getFinalizedPdfUrl,
  getProposalAttachmentUrl,
  openModal,
  row,
}: ProposalMobileCardProps) {
  const attention = getProposalAttention(row);
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-brand-dark">{row.proposalCode}</div>
          <div className="text-brand-muted text-sm">{row.clientName}</div>
        </div>
        <StatusBadge domain="proposal" label={proposalWorkflowLabel(row)} status={row.status} />
      </div>
      <div
        className={`rounded-lg border px-3 py-2 font-medium text-xs ${proposalAttentionClass(attention.tone)}`}
      >
        {attention.label}
      </div>
      <LifecycleDates
        compact
        items={[
          { label: "Created", value: row.createdAt },
          { label: "Sales handoff", value: row.sentToSalesAt },
          { label: "Client delivery", value: row.sentToClientAt },
        ]}
      />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-brand-muted">Queries</span>
          <div className="font-medium">{proposalLinkedQueryLabel(row)}</div>
        </div>
        <div>
          <span className="text-brand-muted">Cost Price per person</span>
          <div className="font-medium">{money(row.costPrice)}</div>
        </div>
        <div>
          <span className="text-brand-muted">Selling</span>
          <div className="font-medium">{money(row.sellingPrice)}</div>
        </div>
        <div>
          <span className="text-brand-muted">Last edit</span>
          <div className="font-medium">
            {row.lastEditedByName
              ? `${row.lastEditedByName} · ${formatDate(row.lastEditedAt)}`
              : "Not edited"}
          </div>
        </div>
      </div>
      <div className="space-y-3 border-brand-border/70 border-t pt-3">
        <FinalizedProposalPdfSummary
          canSend={canManageDocuments}
          finalizedPdf={row.finalizedPdf}
          onDownload={() => openFinalizedProposalPdf(String(row.id), getFinalizedPdfUrl)}
          onManage={() =>
            openModal("proposalFinalizedPdf", {
              proposalId: String(row.id),
              queryCode: row.proposalCode,
            })
          }
        />
        {canManage ? (
          <QueryAttachmentSummary
            attachmentCount={row.attachmentCount}
            attachmentKind="proposal"
            attachments={row.attachments || []}
            canManage={canManage}
            getQueryAttachmentUrl={getProposalAttachmentUrl}
            onManage={() =>
              openModal("proposalAttachments", {
                proposalId: String(row.id),
                queryCode: row.proposalCode,
              })
            }
          />
        ) : null}
      </div>
    </div>
  );
}

export function ProposalsView({
  rows,
  markProposalSent,
  sendProposalToSales,
  openModal,
  has,
  deleteItem,
  removeProposal,
  getProposalAttachmentUrl,
  getFinalizedPdfUrl,
}: ProposalsViewProps) {
  const canSendToClient = has(P.SEND_PROPOSALS);
  const canManage = has(P.MANAGE_PROPOSALS);
  const canManageDocuments = canSendToClient || canManage;

  return (
    <SelectableDataTable<PortalProposalRow>
      columns={[
        {
          id: "proposal",
          kind: "identity",
          label: "Proposal",
          render: (row: PortalProposalRow) => (
            <span className="font-heading font-semibold text-citius-blue">{row.proposalCode}</span>
          ),
          sortValue: (row: PortalProposalRow) => row.proposalCode,
        },
        {
          id: "client",
          label: "Client",
          render: (row: PortalProposalRow) => strong(row.clientName),
          sortValue: (row: PortalProposalRow) => row.clientName,
        },
        {
          id: "created",
          label: "Created",
          render: (row: PortalProposalRow) => (
            <span className="text-brand-muted text-xs">{formatDate(row.createdAt)}</span>
          ),
          sortValue: (row: PortalProposalRow) => row.createdAt,
        },
        {
          hideable: true,
          id: "sent",
          label: "Sales Handoff",
          render: (row: PortalProposalRow) => (
            <span className="text-brand-muted text-xs">{formatDate(row.sentToSalesAt)}</span>
          ),
          sortValue: (row: PortalProposalRow) => row.sentToSalesAt,
        },
        {
          hideable: true,
          id: "client-sent",
          label: "Client Delivery",
          render: (row: PortalProposalRow) => (
            <span className="text-brand-muted text-xs">{formatDate(row.sentToClientAt)}</span>
          ),
          sortValue: (row: PortalProposalRow) => row.sentToClientAt,
        },
        {
          hideable: true,
          id: "linked-queries",
          label: "Linked Queries",
          render: (row: PortalProposalRow) => proposalLinkedQueryLabel(row),
        },
        {
          align: "right",
          hideable: true,
          id: "land",
          label: "Land/Pax",
          render: (row: PortalProposalRow) => money(row.landCostPerPax),
          sortValue: (row: PortalProposalRow) => row.landCostPerPax,
        },
        {
          align: "right",
          hideable: true,
          id: "airfare",
          label: "Airfare/Pax",
          render: (row: PortalProposalRow) => money(row.airfarePerPax),
          sortValue: (row: PortalProposalRow) => row.airfarePerPax,
        },
        {
          align: "right",
          hideable: true,
          id: "visa",
          label: "Visa/Pax",
          render: (row: PortalProposalRow) => money(row.visaCostPerPax),
          sortValue: (row: PortalProposalRow) => row.visaCostPerPax,
        },
        {
          align: "right",
          id: "cost-price",
          label: "Cost Price per person",
          render: (row: PortalProposalRow) => money(row.costPrice),
          sortValue: (row: PortalProposalRow) => row.costPrice,
        },
        {
          align: "right",
          hideable: true,
          id: "tax",
          label: "Tax",
          render: (row: PortalProposalRow) => (row.taxRate == null ? "-" : `${row.taxRate}%`),
          sortValue: (row: PortalProposalRow) => row.taxRate,
        },
        {
          align: "right",
          id: "selling",
          label: "Selling",
          render: (row: PortalProposalRow) => money(row.sellingPrice),
          sortValue: (row: PortalProposalRow) => row.sellingPrice,
        },
        {
          hideable: true,
          id: "last-edit",
          label: "Last Edit",
          render: (row: PortalProposalRow) =>
            row.lastEditedByName
              ? `${row.lastEditedByName} · ${formatDate(row.lastEditedAt)}`
              : "-",
          sortValue: (row: PortalProposalRow) => row.lastEditedAt,
        },
        {
          hideable: true,
          id: "finalized-pdf",
          label: "Proposal Doc",
          render: (row: PortalProposalRow) => (
            <FinalizedProposalPdfSummary
              canSend={canManageDocuments}
              finalizedPdf={row.finalizedPdf}
              onDownload={() => openFinalizedProposalPdf(String(row.id), getFinalizedPdfUrl)}
              onManage={() =>
                openModal("proposalFinalizedPdf", {
                  proposalId: String(row.id),
                  queryCode: row.proposalCode,
                })
              }
            />
          ),
        },
        ...(canManage
          ? [
              {
                hideable: true,
                id: "working-files",
                label: "Working Files",
                render: (row: PortalProposalRow) => (
                  <QueryAttachmentSummary
                    attachmentCount={row.attachmentCount}
                    attachmentKind="proposal"
                    attachments={row.attachments || []}
                    canManage={canManage}
                    getQueryAttachmentUrl={getProposalAttachmentUrl}
                    onManage={() =>
                      openModal("proposalAttachments", {
                        proposalId: String(row.id),
                        queryCode: row.proposalCode,
                      })
                    }
                  />
                ),
              },
            ]
          : []),
        {
          id: "status",
          kind: "status",
          label: "Status",
          render: (row: PortalProposalRow) => (
            <StatusBadge domain="proposal" label={proposalWorkflowLabel(row)} status={row.status} />
          ),
          sortValue: (row: PortalProposalRow) => row.status || "",
        },
        {
          id: "attention",
          label: "Attention",
          mobile: "status",
          priority: 11,
          render: (row: PortalProposalRow) => {
            const attention = getProposalAttention(row);
            return <span className="font-medium text-xs">{attention.label}</span>;
          },
          sortValue: (row: PortalProposalRow) => getProposalAttention(row).label,
          width: 190,
        },
        {
          cellClassName: "min-w-60",
          headerClassName: "min-w-60",
          id: "action",
          kind: "action",
          label: "Action",
          render: (row: PortalProposalRow) => (
            <ProposalRowActions
              canManage={canManage}
              canSendToClient={canSendToClient}
              deleteItem={deleteItem}
              markProposalSent={markProposalSent}
              openModal={openModal}
              removeProposal={removeProposal}
              row={row}
              sendProposalToSales={sendProposalToSales}
            />
          ),
        },
      ]}
      empty="No proposals yet."
      mobileCardRender={(row: PortalProposalRow) => (
        <ProposalMobileCard
          canManage={canManage}
          canManageDocuments={canManageDocuments}
          getFinalizedPdfUrl={getFinalizedPdfUrl}
          getProposalAttachmentUrl={getProposalAttachmentUrl}
          openModal={openModal}
          row={row}
        />
      )}
      rowAttention={proposalRowAttention}
      rows={rows}
      tableClassName="min-w-[88rem]"
    />
  );
}
