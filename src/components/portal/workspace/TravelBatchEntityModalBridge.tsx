"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { EntityModal } from "@/components/portal/EntityModal";
import { usePortalToast } from "@/components/portal/PortalToast";
import { createProductionModalCommandAdapter } from "@/lib/portal/modalCommandAdapter";
import { executeModalCommand } from "@/lib/portal/modalCommandExecutor";
import { JOB_CARD_MODALS } from "@/lib/portal/modalLifecycle";
import { runMutation } from "@/lib/portal/runMutation";
import { SPREADSHEET_MODALS, TRAVEL_BATCH_MODAL } from "@/lib/portal/workspaceContract";
import type { PortalTravelBatchModalWorkspaceSlice } from "./portalModalWorkspaceTypes";
import { formatConvexError } from "./portalWorkspaceListHelpers";

type TravelBatchActionState = "idle" | "saved" | "saving";

export function TravelBatchEntityModalBridge({
  workspace,
}: {
  workspace: PortalTravelBatchModalWorkspaceSlice;
}) {
  const toast = usePortalToast();
  const createTravelBatch = useMutation(api.crm.jobCards.createTravelBatch);
  const updateTravelBatch = useMutation(api.crm.jobCards.updateTravelBatch);
  const [travelBatchError, setTravelBatchError] = useState("");
  const [travelBatchActionState, setTravelBatchActionState] =
    useState<TravelBatchActionState>("idle");
  const actionInFlightRef = useRef<number | null>(null);
  const modalInstanceRef = useRef(workspace.modalInstanceId);

  useEffect(() => {
    modalInstanceRef.current = workspace.modalInstanceId;
    return () => {
      actionInFlightRef.current = null;
      modalInstanceRef.current = null;
    };
  }, [workspace.modalInstanceId]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (workspace.modal !== TRAVEL_BATCH_MODAL) {
      return workspace.submit(event);
    }
    event.preventDefault();
    const modalInstance = workspace.modalInstanceId;
    if (modalInstance === null || actionInFlightRef.current === modalInstance) {
      return;
    }
    actionInFlightRef.current = modalInstance;
    setTravelBatchActionState("saving");
    setTravelBatchError("");
    return runMutation(
      {
        label: "Save",
        onError: (message: string) => {
          if (modalInstanceRef.current === modalInstance) {
            setTravelBatchError(message);
          }
        },
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
      .then(async () => {
        if (modalInstanceRef.current !== modalInstance) {
          return;
        }
        setTravelBatchActionState("saved");
        await new Promise<void>((resolve) => setTimeout(resolve, 420));
        workspace.closeModal(modalInstance);
      })
      .catch((err) => {
        if (modalInstanceRef.current === modalInstance) {
          setTravelBatchError(formatConvexError(err, "Unable to save."));
        }
      })
      .finally(() => {
        if (actionInFlightRef.current === modalInstance) {
          actionInFlightRef.current = null;
        }
        if (modalInstanceRef.current === modalInstance) {
          setTravelBatchActionState("idle");
        }
      });
  };

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
      getFinalizedPdfUrl={workspace.getFinalizedPdfUrl}
      getProposalAttachmentUrl={workspace.getProposalAttachmentUrl}
      getQueryAttachmentUrl={workspace.getQueryAttachmentUrl}
      has={workspace.has}
      isSaving={
        workspace.modal === TRAVEL_BATCH_MODAL
          ? travelBatchActionState === "saving"
          : workspace.isSaving
      }
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
      removeFinalizedPdf={workspace.removeFinalizedPdf}
      removeProposalAttachment={workspace.removeProposalAttachment}
      removeQueryAttachment={workspace.removeQueryAttachment}
      saveFlash={
        workspace.modal === TRAVEL_BATCH_MODAL
          ? travelBatchActionState === "saved"
          : workspace.saveFlash
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
