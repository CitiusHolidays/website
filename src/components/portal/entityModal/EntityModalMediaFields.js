"use client";

import { api } from "@convex/_generated/api";
import { FileText, Paperclip } from "lucide-react";
import { useEffect, useReducer } from "react";

import {
  FinalizedProposalPdfPanel,
  formatDate,
  formatFileSize,
  QueryAttachmentsPanel,
} from "@/components/portal/PortalModalForm";
import {
  commercialFilePagerReducer,
  commercialFileRowsForPage,
  createCommercialFilePagerState,
} from "@/components/portal/workspace/modals/commercialFilesModalState";
import { commercialFileUrl } from "@/lib/portal/commercialFileRoutes";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { requestDocumentPreview } from "@/lib/portal/documentPreview";
import {
  useTrackedPaginatedQuery as usePaginatedQuery,
  useTrackedQuery as useQuery,
} from "@/lib/portal/trackedConvexSubscriptions";

function commercialEntryPointFor(modal, form) {
  if (modal === "queryAttachments") {
    return { entityId: form.queryId, entryPoint: "query" };
  }
  if (modal === "proposalAttachments") {
    return { entityId: form.proposalId, entryPoint: "proposal" };
  }
  return null;
}

function LinkedCommercialFiles({ files, nextCursor, onLoadMore }) {
  if (!(files?.length || nextCursor)) {
    return null;
  }
  return (
    <div className="mt-5 border-brand-border border-t pt-4">
      <h3 className="font-heading font-semibold text-brand-dark text-sm">
        Linked commercial files
      </h3>
      <p className="mt-1 text-brand-muted text-xs">
        {files.length
          ? "Read-only files shared from linked Queries and Proposals."
          : "No linked files on this loaded page. More records are available."}
      </p>
      <ul className="mt-3 space-y-2">
        {files.map((file) => {
          const handleView = () => {
            requestDocumentPreview({
              fileName: file.fileName,
              mimeType: file.mimeType,
              sourceUrl: commercialFileUrl(file.id),
            });
          };
          return (
            <li
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3"
              key={file.id}
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
              <button className="portal-small-btn shrink-0" onClick={handleView} type="button">
                View
              </button>
            </li>
          );
        })}
      </ul>
      {nextCursor ? (
        <button className="portal-outline-btn mt-3" onClick={onLoadMore} type="button">
          Load more linked files
        </button>
      ) : null}
    </div>
  );
}

export function EntityModalMediaFields({
  modal,
  form,

  has,

  proposals,

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
}) {
  const queryAttachmentPage = usePaginatedQuery(
    api.crm.queryAttachments.listForQuery,
    modal === "queryAttachments" && form.queryId ? { queryId: form.queryId } : "skip",
    { initialNumItems: 50 }
  );
  const queryAttachments =
    queryAttachmentPage.status === "LoadingFirstPage" ? [] : queryAttachmentPage.results;
  const commercialEntryPoint = commercialEntryPointFor(modal, form);
  const commercialSignature = JSON.stringify({ ...commercialEntryPoint, linkedOnly: true });
  const [commercialPager, dispatchCommercialPager] = useReducer(
    commercialFilePagerReducer,
    commercialSignature,
    createCommercialFilePagerState
  );
  useEffect(() => {
    dispatchCommercialPager({ signature: commercialSignature, type: "reset" });
  }, [commercialSignature]);
  const commercialFilePage = useQuery(
    api.crm.commercialFiles.listForEntryPoint,
    commercialEntryPoint?.entityId
      ? {
          ...commercialEntryPoint,
          cursor:
            commercialPager.signature === commercialSignature ? commercialPager.cursor : undefined,
          includeDeleted: false,
          includeHistory: false,
          limit: 25,
          linkedOnly: true,
        }
      : "skip"
  );
  const linkedCommercialFiles = commercialFileRowsForPage(
    commercialPager,
    commercialSignature,
    commercialFilePage?.items ?? []
  );
  const handleLoadMore = () => {
    queryAttachmentPage.loadMore(50);
  };
  const handleLoadMoreCommercialFiles = () => {
    if (!commercialFilePage?.nextCursor) {
      return;
    }
    dispatchCommercialPager({
      cursor: commercialFilePage.nextCursor,
      rows: linkedCommercialFiles,
      signature: commercialSignature,
      type: "loadMore",
    });
  };

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
            onLoadMore={handleLoadMore}
            queryId={form.queryId}
            removeQueryAttachment={removeQueryAttachment}
            showLoadMore={queryAttachmentPage.status === "CanLoadMore"}
          />
          <LinkedCommercialFiles
            files={linkedCommercialFiles}
            nextCursor={commercialFilePage?.nextCursor}
            onLoadMore={handleLoadMoreCommercialFiles}
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
            canManage={false}
            entityId={form.proposalId}
            generateQueryUploadUrl={generateProposalUploadUrl}
            getQueryAttachmentUrl={getProposalAttachmentUrl}
            idField="proposalId"
            removeQueryAttachment={removeProposalAttachment}
            uploadLabel="Upload Working File"
          />
          <LinkedCommercialFiles
            files={linkedCommercialFiles}
            nextCursor={commercialFilePage?.nextCursor}
            onLoadMore={handleLoadMoreCommercialFiles}
          />
        </div>
      )}
      {modal === "proposalFinalizedPdf" && (
        <div className="md:col-span-2">
          <FinalizedProposalPdfPanel
            attachFinalizedPdf={attachFinalizedPdf}
            canSend={false}
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
