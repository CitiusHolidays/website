"use client";

import {
  ContractingCostFields,
  FinalizedProposalPdfPanel,
  Input,
  isQueryConfirmed,
  MAX_QUERY_NOTES_WORDS,
  MultiSelect,
  money,
  proposalCostPerPax,
  QueryAttachmentsPanel,
  QueryFilePicker,
  Select,
  Textarea,
} from "@/components/portal/PortalModalForm";
import {
  CONTRACTING_STATUS_SELECT_OPTIONS,
  LOST_REASONS,
  QUERY_SOURCES,
  SALES_DECISION_OPTIONS,
  TRAVEL_TYPES,
} from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";
import {
  canAssignContracting,
  canAssignQueryTicketing,
  canAssignTicketing,
  getQueryTypeOptions,
} from "@/lib/portal/permissions";

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
            queryId={form.queryId}
            attachments={queries.find((q) => q.id === form.queryId)?.attachments || []}
            canManage={has(P.MANAGE_QUERIES)}
            generateQueryUploadUrl={generateQueryUploadUrl}
            attachQueryFile={attachQueryFile}
            getQueryAttachmentUrl={getQueryAttachmentUrl}
            removeQueryAttachment={removeQueryAttachment}
          />
        </div>
      )}
      {modal === "proposalAttachments" && (
        <div className="md:col-span-2">
          <QueryAttachmentsPanel
            entityId={form.proposalId}
            idField="proposalId"
            attachments={
              proposals.find((proposal) => proposal.id === form.proposalId)?.attachments || []
            }
            canManage={has(P.MANAGE_PROPOSALS)}
            uploadLabel="Upload Working File"
            generateQueryUploadUrl={generateProposalUploadUrl}
            attachQueryFile={attachProposalFile}
            getQueryAttachmentUrl={getProposalAttachmentUrl}
            attachmentKind="proposal"
            removeQueryAttachment={removeProposalAttachment}
          />
        </div>
      )}
      {modal === "proposalFinalizedPdf" && (
        <div className="md:col-span-2">
          <FinalizedProposalPdfPanel
            proposalId={form.proposalId}
            finalizedPdf={
              proposals.find((proposal) => proposal.id === form.proposalId)?.finalizedPdf || null
            }
            canSend={has(P.SEND_PROPOSALS) || has(P.MANAGE_PROPOSALS)}
            generateFinalizedPdfUploadUrl={generateFinalizedPdfUploadUrl}
            attachFinalizedPdf={attachFinalizedPdf}
            getFinalizedPdfUrl={getFinalizedPdfUrl}
            removeFinalizedPdf={removeFinalizedPdf}
          />
        </div>
      )}
    </>
  );
}
