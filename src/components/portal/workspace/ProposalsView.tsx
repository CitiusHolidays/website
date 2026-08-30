"use client";

import { useEffect } from "react";
import { formatDate, LifecycleDates } from "@/components/portal/PortalModalForm";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { markPortalNavigationFirstContent } from "@/lib/portal/navigationPerformance";
import { proposalLinkedQueryLabel } from "@/lib/portal/proposalLinks";
import { getProposalAttention, proposalWorkflowLabel } from "@/lib/portal/proposalListPresentation";
import { ProposalPairLifecycle } from "./ProposalPairLifecycle";
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
  deleteItem: ProposalsViewProps["deleteItem"];
  openModal: ProposalsViewProps["openModal"];
  removeProposal: ProposalsViewProps["removeProposal"];
  row: PortalProposalRow;
}

function ProposalRowActions({
  canManage,
  deleteItem,
  openModal,
  removeProposal,
  row,
}: ProposalRowActionsProps) {
  const handleFiles = () => {
    openModal("commercialFiles", { entityId: String(row.id), entryPoint: "proposal" });
  };
  const handleEdit = () => {
    openModal("proposal", {
      entityId: String(row.id),
      focusedDetailType: "proposal",
    });
  };
  const handleInvite = () => {
    openModal("addProposalCollaborator", {
      proposalId: String(row.id),
      queryCode: row.proposalCode,
    });
  };
  const handleUnshare = () => {
    openModal("removeProposalCollaborator", {
      proposalId: String(row.id),
      queryCode: row.proposalCode,
    });
  };
  const handleDelete = () => {
    deleteItem(row.proposalCode ?? "", removeProposal, { proposalId: String(row.id) });
  };
  const filesButton = (
    <button className="portal-small-btn" onClick={handleFiles} type="button">
      Files
    </button>
  );

  if (!canManage) {
    return filesButton;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {filesButton}
      <EditButton onClick={handleEdit} />
      <button className="portal-small-btn" onClick={handleInvite} type="button">
        Invite collaborator
      </button>
      {row.hasCollaborators ? (
        <button className="portal-small-btn" onClick={handleUnshare} type="button">
          Unshare
        </button>
      ) : null}
      <DeleteButton label={row.proposalCode} onClick={handleDelete} />
    </div>
  );
}

interface ProposalMobileCardProps {
  canManage: boolean;
  getFinalizedPdfUrl: ProposalsViewProps["getFinalizedPdfUrl"];
  getProposalAttachmentUrl: ProposalsViewProps["getProposalAttachmentUrl"];
  onHandoff: (row: PortalProposalRow, queryId: string) => void;
  row: PortalProposalRow;
}

function ProposalMobileCard({
  getFinalizedPdfUrl,
  getProposalAttachmentUrl,
  canManage,
  onHandoff,
  row,
}: ProposalMobileCardProps) {
  const attention = getProposalAttention(row);
  const handleDownload = () => openFinalizedProposalPdf(String(row.id), getFinalizedPdfUrl);
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
      <LifecycleDates compact items={[{ label: "Created", value: row.createdAt }]} />
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
      <div className="space-y-2">
        {(row.queryPreview ?? []).map((pair) => (
          <ProposalPairLifecycle
            canManage={canManage}
            key={String(pair.id)}
            onHandoff={(queryId) => onHandoff(row, queryId)}
            pair={pair}
            proposalId={String(row.id)}
            proposalRevision={row.proposalRevision}
          />
        ))}
      </div>
      <div className="space-y-3 border-brand-border/70 border-t pt-3">
        <FinalizedProposalPdfSummary
          canSend={false}
          finalizedPdf={row.finalizedPdf}
          onDownload={handleDownload}
        />
        <QueryAttachmentSummary
          attachmentCount={row.attachmentCount}
          attachmentKind="proposal"
          attachments={row.attachments || []}
          canManage={false}
          getQueryAttachmentUrl={getProposalAttachmentUrl}
        />
      </div>
    </div>
  );
}

function ProposalPdfCell({
  getFinalizedPdfUrl,
  row,
}: {
  getFinalizedPdfUrl: ProposalsViewProps["getFinalizedPdfUrl"];
  row: PortalProposalRow;
}) {
  const handleDownload = () => openFinalizedProposalPdf(String(row.id), getFinalizedPdfUrl);
  return (
    <FinalizedProposalPdfSummary
      canSend={false}
      finalizedPdf={row.finalizedPdf}
      onDownload={handleDownload}
    />
  );
}

export function ProposalsView({
  rows,
  sendProposalToSales,
  openModal,
  has,
  deleteItem,
  removeProposal,
  getProposalAttachmentUrl,
  getFinalizedPdfUrl,
  loading = false,
}: ProposalsViewProps) {
  useEffect(() => {
    if (!loading) {
      markPortalNavigationFirstContent("proposals", rows.length > 0 ? "row" : "empty");
    }
  }, [loading, rows]);

  const canManage = has(P.MANAGE_PROPOSALS);
  const handoffPair = (row: PortalProposalRow, queryId: string) => {
    sendProposalToSales({
      proposalId: String(row.id),
      proposalRevision: row.proposalRevision,
      queryId,
    });
  };
  const renderMobileCard = (row: PortalProposalRow) => (
    <ProposalMobileCard
      canManage={canManage}
      getFinalizedPdfUrl={getFinalizedPdfUrl}
      getProposalAttachmentUrl={getProposalAttachmentUrl}
      onHandoff={handoffPair}
      row={row}
    />
  );

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
          id: "linked-queries",
          label: "Linked Queries",
          render: (row: PortalProposalRow) => proposalLinkedQueryLabel(row),
        },
        {
          cellClassName: "min-w-80",
          headerClassName: "min-w-80",
          id: "pair-lifecycle",
          label: "Query-pair lifecycle",
          render: (row: PortalProposalRow) => (
            <div className="space-y-2">
              {(row.queryPreview ?? []).map((pair) => (
                <ProposalPairLifecycle
                  canManage={canManage}
                  key={String(pair.id)}
                  onHandoff={(queryId) => handoffPair(row, queryId)}
                  pair={pair}
                  proposalId={String(row.id)}
                  proposalRevision={row.proposalRevision}
                />
              ))}
            </div>
          ),
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
          render: (row: PortalProposalRow) => (row.taxRate === null ? "-" : `${row.taxRate}%`),
          sortValue: (row: PortalProposalRow) => row.taxRate,
        },
        {
          align: "right",
          id: "selling",
          label: "Selling Price per Person",
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
            <ProposalPdfCell getFinalizedPdfUrl={getFinalizedPdfUrl} row={row} />
          ),
        },
        {
          hideable: true,
          id: "working-files",
          label: "Working Files",
          render: (row: PortalProposalRow) => (
            <QueryAttachmentSummary
              attachmentCount={row.attachmentCount}
              attachmentKind="proposal"
              attachments={row.attachments || []}
              canManage={false}
              getQueryAttachmentUrl={getProposalAttachmentUrl}
            />
          ),
        },
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
              deleteItem={deleteItem}
              openModal={openModal}
              removeProposal={removeProposal}
              row={row}
            />
          ),
        },
      ]}
      empty="No proposals yet."
      mobileCardRender={renderMobileCard}
      rowAttention={proposalRowAttention}
      rows={rows}
      tableClassName="min-w-[88rem]"
    />
  );
}
