"use client";

import { useEffect, useState } from "react";
import { formatDate, LifecycleDates } from "@/components/portal/PortalModalForm";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { markPortalNavigationFirstContent } from "@/lib/portal/navigationPerformance";
import { proposalLinkedQueryLabel } from "@/lib/portal/proposalLinks";
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

function ProposalMobileCard({ row }: { row: PortalProposalRow }) {
  const attention = getProposalAttention(row);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-citius-blue">{row.proposalCode}</div>
          <h3 className="break-words font-heading font-semibold text-brand-dark">
            {row.clientName}
          </h3>
        </div>
        <StatusBadge domain="proposal" label={proposalWorkflowLabel(row)} status={row.status} />
      </div>
      <div className="text-brand-muted text-sm">{proposalLinkedQueryLabel(row)}</div>
      <p
        className={`rounded-lg border px-3 py-2 font-medium text-xs ${proposalAttentionClass(attention.tone)}`}
      >
        {attention.label}
      </p>
      <div className="text-brand-muted text-xs">
        Updated {formatDate(row.lastEditedAt || row.updatedAt || row.createdAt)}
      </div>
    </div>
  );
}

function ProposalRecordDetails({
  canManage,
  deleteItem,
  getFinalizedPdfUrl,
  getProposalAttachmentUrl,
  onHandoff,
  openModal,
  removeProposal,
  row,
}: ProposalRowActionsProps & {
  getFinalizedPdfUrl: ProposalsViewProps["getFinalizedPdfUrl"];
  getProposalAttachmentUrl: ProposalsViewProps["getProposalAttachmentUrl"];
  onHandoff: (row: PortalProposalRow, queryId: string) => void;
}) {
  const [visited, setVisited] = useState(false);
  const handleDownload = () => openFinalizedProposalPdf(String(row.id), getFinalizedPdfUrl);
  const handleHandoff = () => {
    if (row.queryId) {
      onHandoff(row, row.queryId);
    }
  };
  return (
    <details
      name="proposal-record"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setVisited(true);
        }
      }}
    >
      <summary
        aria-label={`Review Proposal ${row.proposalCode}`}
        className="min-h-11 cursor-pointer content-center rounded-lg border border-brand-border bg-white px-3 py-2 font-semibold text-citius-blue text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
      >
        Review Proposal
      </summary>
      {visited ? (
        <div className="mt-4 space-y-4">
          <h3 className="font-heading font-semibold text-brand-dark">
            {row.proposalCode} · revision {row.proposalRevision}
          </h3>
          <ProposalRowActions
            canManage={canManage}
            deleteItem={deleteItem}
            openModal={openModal}
            removeProposal={removeProposal}
            row={row}
          />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Land/Pax", money(row.landCostPerPax)],
              ["Airfare/Pax", money(row.airfarePerPax)],
              ["Visa/Pax", money(row.visaCostPerPax)],
              ["Cost Price per person", money(row.costPrice)],
              ["Selling Price per Person", money(row.sellingPrice)],
              ["Tax", (row.taxRate ?? null) === null ? "Not entered" : `${row.taxRate}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-brand-muted text-xs">{label}</dt>
                <dd className="font-medium text-brand-dark">{value}</dd>
              </div>
            ))}
          </dl>
          <LifecycleDates compact items={[{ label: "Created", value: row.createdAt }]} />
          <p className="text-brand-muted text-xs">
            {row.lastEditedByName
              ? `Last edited by ${row.lastEditedByName} · ${formatDate(row.lastEditedAt)}`
              : "No edit recorded"}
          </p>
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
          {canManage && row.status === "Draft" && row.queryId ? (
            <button className="portal-small-btn" onClick={handleHandoff} type="button">
              Send to Sales for {row.query?.queryCode ?? "Query"}
            </button>
          ) : null}
        </div>
      ) : null}
    </details>
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
  const renderMobileCard = (row: PortalProposalRow) => <ProposalMobileCard row={row} />;

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
          render: (row: PortalProposalRow) => row.finalizedPdf?.fileName || "No Proposal Doc",
        },
        {
          hideable: true,
          id: "working-files",
          label: "Working Files",
          render: (row: PortalProposalRow) => {
            const count = row.attachmentCount ?? row.attachments?.length;
            return count === undefined ? "File count unavailable" : `${count} files`;
          },
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
            <ProposalRecordDetails
              canManage={canManage}
              deleteItem={deleteItem}
              getFinalizedPdfUrl={getFinalizedPdfUrl}
              getProposalAttachmentUrl={getProposalAttachmentUrl}
              onHandoff={handoffPair}
              openModal={openModal}
              removeProposal={removeProposal}
              row={row}
            />
          ),
        },
      ]}
      empty="No proposals yet."
      layoutKey="proposals:list"
      mobileCardRender={renderMobileCard}
      rowAttention={proposalRowAttention}
      rows={rows}
      tableClassName="min-w-[88rem]"
    />
  );
}
