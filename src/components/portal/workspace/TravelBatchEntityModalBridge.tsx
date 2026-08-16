"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { EntityModal } from "@/components/portal/EntityModal";
import { usePortalToast } from "@/components/portal/PortalToast";
import { createProductionModalCommandAdapter } from "@/lib/portal/modalCommandAdapter";
import { executeModalCommand } from "@/lib/portal/modalCommandExecutor";
import { JOB_CARD_MODALS } from "@/lib/portal/modalLifecycle";
import { runMutation } from "@/lib/portal/runMutation";
import { SPREADSHEET_MODALS, TRAVEL_BATCH_MODAL } from "@/lib/portal/workspaceContract";
import type { PortalTravelBatchModalWorkspaceSlice } from "./portalModalWorkspaceTypes";
import { formatConvexError } from "./portalWorkspaceListHelpers";

export function TravelBatchEntityModalBridge({
  workspace,
}: {
  workspace: PortalTravelBatchModalWorkspaceSlice;
}) {
  const toast = usePortalToast();
  const createTravelBatch = useMutation(api.crm.jobCards.createTravelBatch);
  const updateTravelBatch = useMutation(api.crm.jobCards.updateTravelBatch);
  const [travelBatchError, setTravelBatchError] = useState("");
  const [travelBatchSaving, setTravelBatchSaving] = useState(false);
  const [travelBatchSaveFlash, setTravelBatchSaveFlash] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (workspace.modal !== TRAVEL_BATCH_MODAL) {
      return workspace.submit(event);
    }
    event.preventDefault();
    setTravelBatchSaving(true);
    setTravelBatchError("");
    return runMutation(
      {
        label: "Save",
        onError: (message: string) => setTravelBatchError(message),
        showToast: toast,
        successMessage: "Saved",
      },
      () =>
        executeModalCommand({
          adapter: createProductionModalCommandAdapter({
            administration: {},
            commercial: {},
            operations: {
              createTravelBatch,
              team: workspace.team,
              updateTravelBatch,
            },
            policy: {
              access: workspace.access,
              has: workspace.has,
              jobCardModals: JOB_CARD_MODALS,
            },
          }),
          form: workspace.form,
          modal: TRAVEL_BATCH_MODAL,
        })
    )
      .then(
        () =>
          new Promise<void>((resolve) => {
            setTravelBatchSaveFlash(true);
            setTimeout(resolve, 420);
          })
      )
      .then(() => workspace.closeModal())
      .catch((err) => {
        setTravelBatchError(formatConvexError(err, "Unable to save."));
      })
      .finally(() => {
        setTravelBatchSaveFlash(false);
        setTravelBatchSaving(false);
      });
  }

  return (
    <EntityModal
      access={workspace.access}
      attachFinalizedPdf={workspace.attachFinalizedPdf}
      attachProposalFile={workspace.attachProposalFile}
      attachQueryFile={workspace.attachQueryFile}
      close={workspace.closeModal}
      error={workspace.modal === TRAVEL_BATCH_MODAL ? travelBatchError : workspace.error}
      fieldErrors={workspace.modal === TRAVEL_BATCH_MODAL ? {} : workspace.fieldErrors}
      form={workspace.form}
      generateFinalizedPdfUploadUrl={workspace.generateFinalizedPdfUploadUrl}
      generateProposalUploadUrl={workspace.generateProposalUploadUrl}
      generateQueryUploadUrl={workspace.generateQueryUploadUrl}
      getExpenseAttachmentUrl={workspace.getExpenseAttachmentUrl}
      getFinalizedPdfUrl={workspace.getFinalizedPdfUrl}
      getProposalAttachmentUrl={workspace.getProposalAttachmentUrl}
      getQueryAttachmentUrl={workspace.getQueryAttachmentUrl}
      has={workspace.has}
      isSaving={workspace.modal === TRAVEL_BATCH_MODAL ? travelBatchSaving : workspace.isSaving}
      jobCards={workspace.jobCards}
      leaveBalances={workspace.leaveBalances}
      leaveHeadApproverCandidates={workspace.leaveHeadApproverCandidates}
      modal={
        SPREADSHEET_MODALS.some((modal) => modal === workspace.modal) ||
        workspace.modal === "commercialFiles"
          ? null
          : workspace.modal
      }
      patchForm={workspace.patchForm}
      pendingExpenseProofFiles={workspace.pendingExpenseProofFiles}
      pendingProposalFiles={workspace.pendingProposalFiles}
      pendingQueryFiles={workspace.pendingQueryFiles}
      pnrs={workspace.pnrs}
      proposals={workspace.proposals}
      queries={workspace.queries}
      removeExpenseProof={workspace.removeExpenseProof}
      removeFinalizedPdf={workspace.removeFinalizedPdf}
      removeProposalAttachment={workspace.removeProposalAttachment}
      removeQueryAttachment={workspace.removeQueryAttachment}
      saveFlash={
        workspace.modal === TRAVEL_BATCH_MODAL ? travelBatchSaveFlash : workspace.saveFlash
      }
      setPendingExpenseProofFiles={workspace.setPendingExpenseProofFiles}
      setPendingProposalFiles={workspace.setPendingProposalFiles}
      setPendingQueryFiles={workspace.setPendingQueryFiles}
      submit={submit}
      team={workspace.team}
      travellers={workspace.travellers}
      travellersWithoutVisa={workspace.travellersWithoutVisa}
      updateForm={workspace.updateForm}
      visas={workspace.visas}
    />
  );
}
