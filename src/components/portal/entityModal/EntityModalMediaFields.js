"use client";

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
  return (
    <>
      {modal === "queryAttachments" && (
        <div className="md:col-span-2">
          <QueryAttachmentsPanel
            attachments={queries.find((q) => q.id === form.queryId)?.attachments || []}
            attachQueryFile={attachQueryFile}
            canManage={has(P.MANAGE_QUERIES)}
            generateQueryUploadUrl={generateQueryUploadUrl}
            getQueryAttachmentUrl={getQueryAttachmentUrl}
            queryId={form.queryId}
            removeQueryAttachment={removeQueryAttachment}
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
