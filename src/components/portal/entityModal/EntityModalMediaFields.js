"use client";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery, useQuery } from "convex/react";
import { FileText, Paperclip } from "lucide-react";
import {
  FinalizedProposalPdfPanel,
  formatDate,
  formatFileSize,
  QueryAttachmentsPanel,
} from "@/components/portal/PortalModalForm";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

function LinkedCommercialFiles({ files }) {
  if (!files?.length) {
    return null;
  }
  return (
    <div className="mt-5 border-brand-border border-t pt-4">
      <h3 className="font-heading font-semibold text-brand-dark text-sm">
        Linked commercial files
      </h3>
      <p className="mt-1 text-brand-muted text-xs">
        Read-only files shared from linked Queries and Proposals.
      </p>
      <ul className="mt-3 space-y-2">
        {files.map((file) => {
          const href =
            file.fileKind === "proposalDoc"
              ? `/api/portal/files/proposal-finalized/${encodeURIComponent(file.sourceId)}`
              : `/api/portal/files/${file.sourceType}/${encodeURIComponent(file.attachmentId)}`;
          return (
            <li
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3"
              key={`${file.sourceType}:${file.attachmentId}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {file.fileKind === "proposalDoc" ? (
                    <FileText className="shrink-0 text-citius-blue" size={14} />
                  ) : (
                    <Paperclip className="shrink-0 text-citius-blue" size={14} />
                  )}
                  <span className="truncate font-medium text-brand-text">{file.fileName}</span>
                </div>
                <div className="mt-1 text-brand-muted text-xs">
                  {file.sourceLabel} · {formatFileSize(file.fileSize)} ·{" "}
                  {formatDate(file.createdAt)}
                </div>
              </div>
              <a
                className="portal-small-btn shrink-0"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EntityModalMediaFields({
  modal,
  form,
  updateForm,
  patchForm,
  has,
  access,
  queries,
  proposals,
  jobCards,
  team,
  contractingTeamOptions,
  operationsTeamOptions,
  ticketingTeamOptions,
  pendingQueryFiles,
  setPendingQueryFiles,
  pendingProposalFiles,
  setPendingProposalFiles,
  generateQueryUploadUrl,
  attachQueryFile,
  getQueryAttachmentUrl,
  removeQueryAttachment,
  generateProposalUploadUrl,
  attachProposalFile,
  getProposalAttachmentUrl,
  removeProposalAttachment,
  generateFinalizedPdfUploadUrl,
  attachFinalizedPdf,
  getFinalizedPdfUrl,
  removeFinalizedPdf,
  handleProposalQuerySelect,
  handleJobQuerySelect,
  handleJobCardSelect,
  handleTravellerSelect,
}) {
  const queryAttachmentPage = usePaginatedQuery(
    api.crm.queryAttachments.listForQuery,
    modal === "queryAttachments" && form.queryId ? { queryId: form.queryId } : "skip",
    { initialNumItems: 50 }
  );
  const queryAttachments =
    queryAttachmentPage.status === "LoadingFirstPage" ? [] : queryAttachmentPage.results;
  const commercialEntryPoint =
    modal === "queryAttachments"
      ? { entityId: form.queryId, entryPoint: "query" }
      : modal === "proposalAttachments"
        ? { entityId: form.proposalId, entryPoint: "proposal" }
        : null;
  const commercialFiles = useQuery(
    api.crm.commercialRecordChainReads.listForEntryPoint,
    commercialEntryPoint?.entityId ? commercialEntryPoint : "skip"
  );
  const linkedCommercialFiles = (commercialFiles ?? []).filter((file) => file.readOnly);

  return (
    <>
      {modal === "queryAttachments" && (
        <div className="md:col-span-2">
          <QueryAttachmentsPanel
            attachments={queryAttachments}
            attachQueryFile={attachQueryFile}
            canManage={has(P.MANAGE_QUERIES)}
            generateQueryUploadUrl={generateQueryUploadUrl}
            getQueryAttachmentUrl={getQueryAttachmentUrl}
            isLoadingMore={queryAttachmentPage.status === "LoadingMore"}
            onLoadMore={() => queryAttachmentPage.loadMore(50)}
            queryId={form.queryId}
            removeQueryAttachment={removeQueryAttachment}
            showLoadMore={queryAttachmentPage.status === "CanLoadMore"}
          />
          <LinkedCommercialFiles files={linkedCommercialFiles} />
        </div>
      )}
      {modal === "proposalAttachments" && (
        <div className="md:col-span-2">
          <QueryAttachmentsPanel
            attachmentKind="proposal"
            attachments={
              proposals.find((proposal) => proposal.id === form.proposalId)?.attachments || []
            }
            attachQueryFile={attachProposalFile}
            canManage={has(P.MANAGE_PROPOSALS)}
            entityId={form.proposalId}
            generateQueryUploadUrl={generateProposalUploadUrl}
            getQueryAttachmentUrl={getProposalAttachmentUrl}
            idField="proposalId"
            removeQueryAttachment={removeProposalAttachment}
            uploadLabel="Upload Working File"
          />
          <LinkedCommercialFiles files={linkedCommercialFiles} />
        </div>
      )}
      {modal === "proposalFinalizedPdf" && (
        <div className="md:col-span-2">
          <FinalizedProposalPdfPanel
            attachFinalizedPdf={attachFinalizedPdf}
            canSend={has(P.SEND_PROPOSALS) || has(P.MANAGE_PROPOSALS)}
            finalizedPdf={
              proposals.find((proposal) => proposal.id === form.proposalId)?.finalizedPdf || null
            }
            generateFinalizedPdfUploadUrl={generateFinalizedPdfUploadUrl}
            getFinalizedPdfUrl={getFinalizedPdfUrl}
            proposalId={form.proposalId}
            removeFinalizedPdf={removeFinalizedPdf}
          />
        </div>
      )}
    </>
  );
}
