"use client";

import { api } from "@convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import {
  FinalizedProposalPdfPanel,
  QueryAttachmentsPanel,
} from "@/components/portal/PortalModalForm";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

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
